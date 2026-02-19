/**
 * Sky - Minimal Backend
 * Frontend static serving + Leads API to Telegram
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const compression = require('compression');
const initSqlJs = require('sql.js');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 4000;
const DB_PATH = path.join(__dirname, 'database.sqlite');
const WEBHOOK_SECRET = crypto.randomBytes(32).toString('hex');
const TELEGRAM_TIMEOUT = 5000; // 5 seconds
const TELEGRAM_MAX_RETRIES = 3;
const FAILED_QUEUE_PATH = path.join(__dirname, 'failed-messages.json');

let db;
let server; // HTTP server reference for graceful shutdown
let requestsInFlight = 0;
let dbSaveInterval;

// ===== ERROR LOGGING =====
function logError(context, err) {
    const msg = `[${new Date().toISOString()}] [${context}] ${err?.message || err}`;
    console.error(msg);
}

// ===== FAILED MESSAGE QUEUE =====
function saveFailedMessage(method, body) {
    try {
        let queue = [];
        if (fs.existsSync(FAILED_QUEUE_PATH)) {
            queue = JSON.parse(fs.readFileSync(FAILED_QUEUE_PATH, 'utf-8'));
        }
        queue.push({ method, body, timestamp: new Date().toISOString() });
        // Keep max 50 messages
        if (queue.length > 50) queue = queue.slice(-50);
        fs.writeFileSync(FAILED_QUEUE_PATH, JSON.stringify(queue, null, 2));
        logError('TG_QUEUE', `Saved to retry queue (${queue.length} pending)`);
    } catch (e) {
        logError('TG_QUEUE_SAVE', e);
    }
}

async function retryFailedMessages() {
    if (!fs.existsSync(FAILED_QUEUE_PATH)) return;
    try {
        const queue = JSON.parse(fs.readFileSync(FAILED_QUEUE_PATH, 'utf-8'));
        if (!queue.length) return;
        console.log(`Retrying ${queue.length} failed messages...`);
        const remaining = [];
        for (const msg of queue) {
            const result = await telegramRequest(msg.method, msg.body);
            if (result.ok) {
                console.log(`✓ Retry success: ${msg.method}`);
            } else {
                remaining.push(msg);
            }
            await new Promise(r => setTimeout(r, 500));
        }
        if (remaining.length) {
            fs.writeFileSync(FAILED_QUEUE_PATH, JSON.stringify(remaining, null, 2));
            console.log(`${remaining.length} messages still pending`);
        } else {
            fs.unlinkSync(FAILED_QUEUE_PATH);
            console.log('✓ All queued messages sent');
        }
    } catch (e) {
        logError('TG_RETRY', e);
    }
}

// Load modules DB for TZ generation
const MODULES_PATH = path.join(__dirname, '..', '..', 'frontend', 'data', 'modules.json');
let modulesDB = null;
try {
    modulesDB = JSON.parse(fs.readFileSync(MODULES_PATH, 'utf-8'));
    console.log('✓ Modules DB loaded for TZ generation');
} catch (e) {
    logError('STARTUP', e);
}

// ===== SECURITY =====
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));

app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:4000',
    credentials: true
}));

// ===== COMPRESSION =====
app.use(compression());

// ===== PARSING =====
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ===== REQUEST TRACKING (for graceful shutdown) =====
app.use((req, res, next) => {
    requestsInFlight++;
    res.on('finish', () => requestsInFlight--);
    next();
});

// ===== RATE LIMITING =====
const leadsLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 requests per hour
    message: { error: 'Too many lead submissions. Please try again later.' },
});

const webhookLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
    message: 'Too many requests',
});

// ===== DATABASE =====
async function initDatabase() {
    const SQL = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
        try {
            const buffer = fs.readFileSync(DB_PATH);
            db = new SQL.Database(buffer);
            // Integrity check
            const check = db.exec('PRAGMA integrity_check');
            if (check[0]?.values[0]?.[0] !== 'ok') {
                logError('DB_INTEGRITY', 'Database integrity check failed, reinitializing');
                db = new SQL.Database();
            }
        } catch (e) {
            logError('DB_LOAD', e);
            db = new SQL.Database();
        }
    } else {
        db = new SQL.Database();
    }

    // Create orders table (leads)
    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        rental_period TEXT,
        comment TEXT,
        page TEXT,
        product_key TEXT,
        status TEXT DEFAULT 'new',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Add indexes
    try {
        db.run('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)');
        db.run('CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at)');
    } catch (e) {
        logError('DB_INDEX', e);
    }

    saveDatabase();
    console.log('✓ Database initialized');
}

function saveDatabase() {
    try {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(DB_PATH, buffer);
    } catch (e) {
        logError('DB_SAVE', e);
    }
}

// ===== TELEGRAM API (unified with timeout + retry) =====

// Load portfolio for /projects command
const PORTFOLIO_PATH = path.join(__dirname, '..', '..', 'frontend', 'data', 'portfolio-projects.json');
let portfolioDB = null;
try {
    portfolioDB = JSON.parse(fs.readFileSync(PORTFOLIO_PATH, 'utf-8'));
} catch (e) {
    logError('STARTUP', e);
}

const SITE_URL = process.env.RENDER_EXTERNAL_URL || 'https://sky-backend-xisk.onrender.com';

/**
 * Unified Telegram API request with timeout and retry
 * @returns {Promise<object>} Telegram API response
 */
function telegramRequest(method, body, retries = 0) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return Promise.resolve({ ok: false, description: 'No token' });

    return new Promise((resolve) => {
        const payload = JSON.stringify(body);
        const options = {
            hostname: 'api.telegram.org',
            path: `/bot${token}/${method}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            },
            timeout: TELEGRAM_TIMEOUT
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    logError('TG_PARSE', e);
                    resolve({ ok: false, description: 'Parse error' });
                }
            });
        });

        req.on('timeout', () => {
            req.destroy();
            if (retries < TELEGRAM_MAX_RETRIES) {
                const delay = (retries + 1) * 1000; // 1s, 2s, 3s
                logError('TG_TIMEOUT', `${method} timeout, retry ${retries + 1}/${TELEGRAM_MAX_RETRIES} in ${delay}ms`);
                setTimeout(() => {
                    telegramRequest(method, body, retries + 1).then(resolve);
                }, delay);
            } else {
                logError('TG_TIMEOUT', `${method} failed after ${TELEGRAM_MAX_RETRIES} retries`);
                if (method === 'sendMessage') saveFailedMessage(method, body);
                resolve({ ok: false, description: 'Timeout after retries' });
            }
        });

        req.on('error', (err) => {
            if (retries < TELEGRAM_MAX_RETRIES) {
                const delay = (retries + 1) * 1000;
                logError('TG_ERROR', `${method} error: ${err.message}, retry ${retries + 1}/${TELEGRAM_MAX_RETRIES}`);
                setTimeout(() => {
                    telegramRequest(method, body, retries + 1).then(resolve);
                }, delay);
            } else {
                logError('TG_ERROR', `${method} failed after ${TELEGRAM_MAX_RETRIES} retries: ${err.message}`);
                if (method === 'sendMessage') saveFailedMessage(method, body);
                resolve({ ok: false, description: err.message });
            }
        });

        req.write(payload);
        req.end();
    });
}

// Register bot commands with Telegram on startup
async function setBotCommands() {
    const result = await telegramRequest('setMyCommands', {
        commands: [
            { command: 'start', description: 'Приветствие' },
            { command: 'help', description: 'Как пользоваться' },
            { command: 'projects', description: 'Наше портфолио' },
            { command: 'orders', description: 'Последние заявки' }
        ]
    });
    if (result.ok) console.log('✓ Bot commands registered');
    else logError('BOT_COMMANDS', result.description);
}

// Send message with optional inline keyboard
function sendTelegramWithButtons(chatId, text, buttons) {
    const body = {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
    };
    if (buttons) body.reply_markup = { inline_keyboard: buttons };
    telegramRequest('sendMessage', body).then(result => {
        if (!result.ok) logError('TG_SEND', result.description);
    });
}

// Handle incoming bot commands
function handleBotUpdate(update) {
    const message = update.message;
    if (!message || !message.text) return;

    const chatId = message.chat.id;
    const text = message.text.trim().split('@')[0]; // strip @BotName

    if (text === '/start') {
        const welcome = [
            `<b>Sky Web Studio</b>`,
            ``,
            `Принимаю заявки на создание сайтов.`,
            `Заполните форму на нашем сайте — сюда придёт готовое техническое задание.`,
            ``,
            `<b>Команды:</b>`,
            `/start — это сообщение`,
            `/help — как пользоваться`,
            `/projects — наше портфолио`,
        ].join('\n');

        sendTelegramWithButtons(chatId, welcome, [
            [{ text: '🛠 Собрать сайт', url: `${SITE_URL}/services.html` }],
            [{ text: '📁 Портфолио', url: `${SITE_URL}/portfolio.html` }],
            [{ text: '✉️ Связаться', url: `${SITE_URL}/contacts.html` }]
        ]);
    } else if (text === '/help') {
        const help = [
            `<b>Как это работает:</b>`,
            ``,
            `1. Откройте конфигуратор на сайте`,
            `2. Выберите тип сайта и модули`,
            `3. Укажите контактные данные и отправьте`,
            `4. Сюда придёт полное ТЗ (техническое задание)`,
            ``,
            `<b>Что входит в ТЗ:</b>`,
            ` • Тип сайта с полным функционалом`,
            ` • Выбранные модули с описанием`,
            ` • Финансовая сводка со скидками`,
        ].join('\n');

        sendTelegramWithButtons(chatId, help, [
            [{ text: '⚙️ Открыть конфигуратор', url: `${SITE_URL}/services.html` }]
        ]);
    } else if (text === '/projects') {
        const projects = portfolioDB?.projects || [];
        if (projects.length === 0) {
            sendTelegramWithButtons(chatId, 'Портфолио обновляется. Актуальные проекты — на сайте.', [
                [{ text: '📁 Портфолио', url: `${SITE_URL}/portfolio.html` }]
            ]);
            return;
        }

        const lines = [`<b>Наши проекты:</b>`, ``];
        const buttons = [];

        projects.forEach((p, i) => {
            const t = p.translations?.ru || p.translations?.en || {};
            const price = p.price ? ` — ${p.currency || '€'}${p.price.toLocaleString()}` : '';
            lines.push(`<b>${i + 1}. ${t.title || p.project_key}</b>${price}`);
            lines.push(`<i>${t.subtitle || ''}</i>`);
            lines.push(``);

            if (p.project_url) {
                buttons.push([{ text: t.title || p.project_key, url: p.project_url }]);
            }
        });

        lines.push(`Все проекты на сайте:`);
        buttons.push([{ text: '📁 Все проекты', url: `${SITE_URL}/portfolio.html` }]);

        sendTelegramWithButtons(chatId, lines.join('\n'), buttons);
    } else if (text === '/orders') {
        if (!db) {
            sendTelegramWithButtons(chatId, '❌ База данных недоступна', []);
            return;
        }

        try {
            const rows = db.exec(`
                SELECT id, name, phone, email, page, created_at
                FROM orders
                ORDER BY id DESC
                LIMIT 10
            `);

            if (!rows.length || !rows[0].values.length) {
                sendTelegramWithButtons(chatId, '📭 Заявок пока нет', [
                    [{ text: '⚙️ Конфигуратор', url: `${SITE_URL}/services.html` }]
                ]);
                return;
            }

            const lines = [`<b>📋 Последние заявки (${rows[0].values.length}):</b>`, ''];

            rows[0].values.forEach(([id, name, phone, email, page, createdAt]) => {
                const date = createdAt ? new Date(createdAt).toLocaleDateString('ru-RU') : '—';
                const source = page === 'configurator' ? '⚙️' : '📝';
                lines.push(`${source} <b>#${id}</b> ${escapeHtml(name)}`);
                lines.push(`   📞 ${escapeHtml(phone)}${email ? ` | 📧 ${escapeHtml(email)}` : ''}`);
                lines.push(`   📅 ${date}`);
                lines.push('');
            });

            sendTelegramWithButtons(chatId, lines.join('\n'), [
                [{ text: '🌐 Админка', url: `${SITE_URL}` }]
            ]);
        } catch (e) {
            logError('BOT_ORDERS', e);
            sendTelegramWithButtons(chatId, '❌ Ошибка загрузки заявок', []);
        }
    }
}

// ===== TELEGRAM HELPERS =====

function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function sendTelegram(message) {
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!chatId) return;

    telegramRequest('sendMessage', {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
    }).then(result => {
        if (result.ok) console.log('✓ Telegram message sent');
        else logError('TG_SEND', result.description);
    });
}

// Send multiple Telegram messages sequentially (last message gets inline buttons)
async function sendTelegramSequence(messages, lastMessageButtons) {
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!chatId || !messages.length) return;

    for (let i = 0; i < messages.length; i++) {
        const isLast = (i === messages.length - 1);
        const body = {
            chat_id: chatId,
            text: messages[i],
            parse_mode: 'HTML'
        };
        if (isLast && lastMessageButtons) {
            body.reply_markup = { inline_keyboard: lastMessageButtons };
        }

        const result = await telegramRequest('sendMessage', body);
        if (result.ok) {
            console.log(`✓ TZ message ${i + 1}/${messages.length} sent`);
        } else {
            logError('TZ_SEND', `Message ${i + 1}/${messages.length} failed: ${result.description}`);
        }

        // Small delay between messages
        if (i < messages.length - 1) {
            await new Promise(r => setTimeout(r, 300));
        }
    }
}

// Build TZ messages from configurator data
function buildTZMessages(data, orderId) {
    const curr = data.currency || 'EUR';
    const currSymbol = { EUR: '€', USD: '$', RUB: '₽' }[curr] || '€';
    const tzNum = `TZ-${String(orderId).padStart(4, '0')}`;
    const timestamp = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Warsaw' });

    // Look up site type from DB
    const siteTypeId = data.siteType?.id || '';
    const siteTypeDB = modulesDB?.siteTypes?.find(s => s.id === siteTypeId);
    const siteTypeName = siteTypeDB?.name_ru || data.siteType?.name_ru || 'Не указан';
    const siteTypeDesc = siteTypeDB?.description_ru || '';
    const siteTypeFeatures = siteTypeDB?.features_ru || [];
    const timeline = siteTypeDB?.timeline_ru || '';
    const basePrice = siteTypeDB?.basePrice || data.siteType?.basePrice || 0;

    // Look up package
    const pkgId = data.package?.id;
    let pkgName = '';
    if (pkgId && siteTypeId && modulesDB?.packages?.[siteTypeId]) {
        const pkgDB = modulesDB.packages[siteTypeId].find(p => p.id === pkgId);
        if (pkgDB) {
            pkgName = pkgDB.name_ru || '';
        }
    }

    // === MESSAGE 1: Client + Site Type ===
    const msg1Lines = [
        `<b>📋 ТЕХНИЧЕСКОЕ ЗАДАНИЕ #${tzNum}</b>`,
        ``,
        `<b>👤 КЛИЕНТ</b>`,
        `Имя: ${escapeHtml(data.clientName)}`,
        `Телефон: ${escapeHtml(data.clientPhone)}`,
        data.clientEmail ? `Email: ${escapeHtml(data.clientEmail)}` : null,
        ``,
        `<b>🌐 ТИП САЙТА: ${escapeHtml(siteTypeName)}</b>`,
        siteTypeDesc ? `<i>${escapeHtml(siteTypeDesc)}</i>` : null,
    ];

    if (siteTypeFeatures.length > 0) {
        msg1Lines.push(``, `<b>Базовый функционал:</b>`);
        siteTypeFeatures.forEach(f => {
            msg1Lines.push(` • ${escapeHtml(f)}`);
        });
    }

    if (timeline) msg1Lines.push(``, `<b>⏱ Срок:</b> ${escapeHtml(timeline)}`);
    if (pkgName) {
        let pkgLine = `<b>📋 Пакет:</b> ${escapeHtml(pkgName)}`;
        if (data.discount) pkgLine += ` (скидка ${data.discount}%)`;
        msg1Lines.push(pkgLine);
    }

    const msg1 = msg1Lines.filter(l => l !== null).join('\n');

    // === MESSAGE 2: Modules detail ===
    const selectedModules = data.modules || [];
    let msg2 = '';

    if (selectedModules.length > 0) {
        const msg2Lines = [
            `<b>📋 ТЗ #${tzNum} — МОДУЛИ</b>`,
            ``,
            `<b>📦 МОДУЛИ (${selectedModules.length} шт.)</b>`,
        ];

        selectedModules.forEach((mod, idx) => {
            const moduleDB = modulesDB?.modules?.find(m => m.id === mod.id);
            const icon = moduleDB?.icon || mod.icon || '📦';
            const name = moduleDB?.name_ru || mod.name_ru || mod.name_en || mod.id;
            const price = mod.price || 0;

            msg2Lines.push(``);

            // Special handling for telegram_bot with tiers
            if (mod.id === 'telegram_bot' && data.botConfig && moduleDB?.tiers) {
                const tier = moduleDB.tiers.find(t => t.id === data.botConfig.tierId);
                const tierName = tier?.name_ru || data.botConfig.tierId;
                const tierPrice = tier?.price || 0;

                msg2Lines.push(`<b>${icon} ${idx + 1}. ${escapeHtml(name)} — ${currSymbol}${price}</b>`);
                msg2Lines.push(`Уровень: <b>${escapeHtml(tierName)}</b> (${currSymbol}${tierPrice})`);

                if (tier?.features_ru) {
                    tier.features_ru.forEach(f => {
                        msg2Lines.push(` ✓ ${escapeHtml(f)}`);
                    });
                }

                // Addons
                const selectedAddons = data.botConfig.addons || [];
                if (selectedAddons.length > 0 && moduleDB.addons) {
                    msg2Lines.push(`<i>Допы:</i>`);
                    selectedAddons.forEach(addonId => {
                        const addon = moduleDB.addons.find(a => a.id === addonId);
                        if (addon) {
                            msg2Lines.push(` + ${escapeHtml(addon.name_ru)} (+${currSymbol}${addon.price})`);
                        }
                    });
                }
            } else {
                msg2Lines.push(`<b>${icon} ${idx + 1}. ${escapeHtml(name)} — ${currSymbol}${price}</b>`);
                if (moduleDB?.features_ru) {
                    moduleDB.features_ru.forEach(f => {
                        msg2Lines.push(` ✓ ${escapeHtml(f)}`);
                    });
                }
            }
        });

        msg2 = msg2Lines.join('\n');
    }

    // === MESSAGE 3: Financial summary ===
    const msg3Lines = [
        `<b>📋 ТЗ #${tzNum} — ИТОГО</b>`,
        ``,
        `<b>💰 ФИНАНСОВАЯ СВОДКА</b>`,
        ``,
        `База (${escapeHtml(siteTypeName)}): ${currSymbol}${basePrice.toLocaleString()}`,
    ];

    selectedModules.forEach(mod => {
        const moduleDB = modulesDB?.modules?.find(m => m.id === mod.id);
        const name = moduleDB?.name_ru || mod.name_ru || mod.name_en || mod.id;
        msg3Lines.push(`${escapeHtml(name)}: ${currSymbol}${(mod.price || 0).toLocaleString()}`);
    });

    const subtotal = basePrice + selectedModules.reduce((sum, m) => sum + (m.price || 0), 0);
    msg3Lines.push(``);
    msg3Lines.push(`Подитог: ${currSymbol}${subtotal.toLocaleString()}`);

    if (data.discount) {
        const discountAmount = Math.round(subtotal * data.discount / 100);
        msg3Lines.push(`Скидка (${data.discount}%): −${currSymbol}${discountAmount.toLocaleString()}`);
    }

    msg3Lines.push(`<b>ИТОГО: ${currSymbol}${(data.total || 0).toLocaleString()}</b>`);
    msg3Lines.push(``);
    msg3Lines.push(`💱 Валюта: ${curr}`);
    msg3Lines.push(`⏰ ${timestamp}`);
    msg3Lines.push(``);
    msg3Lines.push(`🔗 Собрано в: ${SITE_URL}/services.html`);

    const msg3 = msg3Lines.join('\n');

    // Compile messages (skip empty msg2 if no modules)
    const messages = [msg1];
    if (msg2) messages.push(msg2);
    messages.push(msg3);

    return messages;
}

// ===== API ROUTES =====

// Health check with diagnostics
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: Math.round(process.uptime()),
        database: db ? 'connected' : 'disconnected',
        modules: modulesDB ? 'loaded' : 'missing',
        portfolio: portfolioDB ? 'loaded' : 'missing',
        requestsInFlight
    });
});

// List orders (read-only, for admin checks)
app.get('/api/orders', (req, res) => {
    try {
        const rows = db.exec('SELECT id, name, phone, email, comment, page, product_key, status, created_at FROM orders ORDER BY id DESC LIMIT 50');
        if (!rows.length) return res.json([]);
        const columns = rows[0].columns;
        const orders = rows[0].values.map(row => {
            const obj = {};
            columns.forEach((col, i) => obj[col] = row[i]);
            return obj;
        });
        res.json(orders);
    } catch (e) {
        logError('ORDERS_LIST', e);
        res.json([]);
    }
});

// Create lead (contact form)
app.post('/api/orders', leadsLimiter, (req, res) => {
    const { name, phone, email, rental_period, comment, page, product_key } = req.body;

    if (!name || !phone) {
        return res.status(400).json({ error: 'Name and phone are required' });
    }

    // Input length validation
    if (name.length > 100 || phone.length > 50) {
        return res.status(400).json({ error: 'Input too long' });
    }
    if (comment && comment.length > 2000) {
        return res.status(400).json({ error: 'Message too long (max 2000 characters)' });
    }
    if (email && email.length > 100) {
        return res.status(400).json({ error: 'Email too long' });
    }

    try {
        // Save to database
        db.run(
            `INSERT INTO orders (name, phone, email, rental_period, comment, page, product_key, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'new')`,
            [name, phone, email || '', rental_period || '', comment || '', page || '', product_key || '']
        );
        saveDatabase();

        // Send to Telegram
        const timestamp = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Warsaw' });
        const message = [
            `<b>📩 НОВАЯ ЗАЯВКА С САЙТА</b>`,
            ``,
            `<b>👤 Имя:</b> ${escapeHtml(name)}`,
            `<b>📞 Телефон:</b> ${escapeHtml(phone)}`,
            email ? `<b>📧 Email:</b> ${escapeHtml(email)}` : null,
            page ? `<b>📍 Страница:</b> ${escapeHtml(page)}` : null,
            product_key ? `<b>📦 Продукт:</b> ${escapeHtml(product_key)}` : null,
            rental_period ? `<b>📅 Период:</b> ${escapeHtml(rental_period)}` : null,
            comment ? `\n<b>💬 Сообщение:</b>\n${escapeHtml(comment)}` : null,
            ``,
            `<b>⏰</b> ${timestamp}`,
        ].filter(Boolean).join('\n');

        sendTelegram(message);

        res.json({ success: true, message: 'Lead submitted successfully!' });
    } catch (error) {
        logError('ORDER_CREATE', error);
        res.status(500).json({ error: 'Failed to submit lead' });
    }
});

// Shop order — products from catalog with delivery
app.post('/api/shop/order', leadsLimiter, (req, res) => {
    const { name, phone, email, city, address, comment, items, total, currency } = req.body;

    if (!name || !phone) {
        return res.status(400).json({ error: 'Name and phone are required' });
    }
    if (name.length > 100 || phone.length > 50) {
        return res.status(400).json({ error: 'Input too long' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Cart is empty' });
    }

    try {
        const curr = currency || 'EUR';
        const currSymbol = { EUR: '€', USD: '$', RUB: '₽' }[curr] || '€';
        const itemsSummary = items.map(i => `${i.title} x${i.qty}`).join(', ');

        // Save to database
        db.run(
            `INSERT INTO orders (name, phone, email, comment, page, product_key, status)
             VALUES (?, ?, ?, ?, ?, ?, 'new')`,
            [name, phone, email || '', `Shop: ${itemsSummary} | ${city || ''}, ${address || ''} | ${comment || ''}`, 'shop', 'shop_order']
        );
        saveDatabase();

        const result = db.exec('SELECT last_insert_rowid() as id');
        const orderId = result[0]?.values[0]?.[0] || 0;
        const timestamp = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Warsaw' });

        // Build Telegram message
        const lines = [
            `<b>🛒 ЗАКАЗ ИЗ МАГАЗИНА #${String(orderId).padStart(4, '0')}</b>`,
            ``,
            `<b>👤 ПОКУПАТЕЛЬ</b>`,
            `Имя: ${escapeHtml(name)}`,
            `Телефон: ${escapeHtml(phone)}`,
            email ? `Email: ${escapeHtml(email)}` : null,
            ``,
            `<b>📦 ТОВАРЫ (${items.length} шт.)</b>`,
        ];

        let itemsTotal = 0;
        items.forEach((item, idx) => {
            const lineTotal = (item.price || 0) * (item.qty || 1);
            itemsTotal += lineTotal;
            lines.push(`${idx + 1}. ${escapeHtml(item.title)} × ${item.qty} = ${currSymbol}${lineTotal.toLocaleString()}`);
        });

        lines.push(``);
        lines.push(`<b>💰 ИТОГО: ${currSymbol}${(total || itemsTotal).toLocaleString()}</b>`);
        lines.push(``);

        if (city || address) {
            lines.push(`<b>🚚 ДОСТАВКА</b>`);
            if (city) lines.push(`Город: ${escapeHtml(city)}`);
            if (address) lines.push(`Адрес: ${escapeHtml(address)}`);
            lines.push(``);
        }

        if (comment) {
            lines.push(`<b>💬 Комментарий:</b> ${escapeHtml(comment)}`);
            lines.push(``);
        }

        lines.push(`⏰ ${timestamp}`);

        const buttons = [
            [{ text: '💬 Написать покупателю', url: `https://t.me/+${(phone || '').replace(/[^\d]/g, '')}` }]
        ];

        sendTelegramWithButtons(process.env.TELEGRAM_CHAT_ID, lines.filter(Boolean).join('\n'), buttons);

        res.json({ success: true, message: 'Order placed successfully!' });
    } catch (error) {
        logError('SHOP_ORDER', error);
        res.status(500).json({ error: 'Failed to place order' });
    }
});

// Configurator lead — sends full TZ to Telegram
app.post('/api/telegram/configurator', leadsLimiter, (req, res) => {
    const {
        siteType, modules, package: pkg, discount, total, botConfig,
        clientName, clientPhone, clientEmail, site, currency
    } = req.body;

    if (!clientName || !clientPhone) {
        return res.status(400).json({ error: 'Name and phone are required' });
    }

    if (clientName.length > 100 || clientPhone.length > 50) {
        return res.status(400).json({ error: 'Input too long' });
    }
    if (clientEmail && clientEmail.length > 100) {
        return res.status(400).json({ error: 'Email too long' });
    }

    try {
        const curr = currency || 'EUR';
        const siteTypeName = siteType?.name_ru || siteType?.name_en || '';

        // Save to database first to get order ID for TZ number
        const comment = `Configurator: ${siteTypeName} | Modules: ${(modules || []).length} | Total: ${total || 0} ${curr}`;
        db.run(
            `INSERT INTO orders (name, phone, email, comment, page, product_key, status)
             VALUES (?, ?, ?, ?, ?, ?, 'new')`,
            [clientName, clientPhone, clientEmail || '', comment, 'configurator', 'configurator']
        );
        saveDatabase();

        // Get the order ID for TZ number
        const result = db.exec('SELECT last_insert_rowid() as id');
        const orderId = result[0]?.values[0]?.[0] || 0;

        // Build and send TZ with inline buttons on last message
        if (modulesDB) {
            const messages = buildTZMessages(req.body, orderId);
            const tzButtons = [
                [{ text: '💬 Ответить клиенту', url: `https://t.me/+${(clientPhone || '').replace(/[^\d]/g, '')}` }],
                [
                    { text: '🌐 Сайт', url: `${SITE_URL}` },
                    { text: '⚙️ Конфигуратор', url: `${SITE_URL}/services.html` }
                ]
            ];
            sendTelegramSequence(messages, tzButtons);
        } else {
            // Fallback if modules.json failed to load
            const timestamp = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Warsaw' });
            const fallback = [
                `<b>📋 ЗАЯВКА С КОНФИГУРАТОРА #TZ-${String(orderId).padStart(4, '0')}</b>`,
                ``,
                `<b>👤 Клиент:</b> ${escapeHtml(clientName)}`,
                `<b>📞 Телефон:</b> ${escapeHtml(clientPhone)}`,
                clientEmail ? `<b>📧 Email:</b> ${escapeHtml(clientEmail)}` : null,
                `<b>🌐 Тип:</b> ${escapeHtml(siteTypeName)}`,
                `<b>💰 Итого:</b> ${total || 0} ${curr}`,
                `<b>⏰</b> ${timestamp}`,
            ].filter(Boolean).join('\n');
            sendTelegram(fallback);
        }

        res.json({ success: true, message: 'Configuration submitted successfully!' });
    } catch (error) {
        logError('CONFIG_SUBMIT', error);
        res.status(500).json({ error: 'Failed to submit configuration' });
    }
});

// Telegram bot webhook — handles /start, /help, /projects
app.post('/api/telegram/webhook', webhookLimiter, (req, res) => {
    // Verify webhook secret (set during registration)
    const secret = req.headers['x-telegram-bot-api-secret-token'];
    if (secret && secret !== WEBHOOK_SECRET) {
        return res.sendStatus(403);
    }

    try {
        handleBotUpdate(req.body);
    } catch (e) {
        logError('WEBHOOK', e);
    }
    res.sendStatus(200);
});

// ===== MODULES API (single source of truth) =====
app.get('/api/modules', (req, res) => {
    if (!modulesDB) {
        return res.status(503).json({ error: 'Modules data not loaded' });
    }
    res.json(modulesDB);
});

// ===== STATIC FILES =====
const frontendPath = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(frontendPath, {
    index: 'index.html',
    maxAge: '1h', // Cache static files for 1 hour
}));

// SPA fallback - serve index.html for unknown routes
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// ===== ERROR HANDLING =====
app.use((err, req, res, next) => {
    logError('EXPRESS', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ===== GRACEFUL SHUTDOWN =====
async function gracefulShutdown(signal) {
    console.log(`${signal} received, shutting down gracefully...`);

    // Stop auto-save interval
    if (dbSaveInterval) clearInterval(dbSaveInterval);

    // Stop accepting new connections
    if (server) {
        server.close(() => console.log('✓ HTTP server closed'));
    }

    // Wait for in-flight requests (max 10 seconds)
    let waited = 0;
    while (requestsInFlight > 0 && waited < 10) {
        console.log(`Waiting for ${requestsInFlight} requests to complete...`);
        await new Promise(r => setTimeout(r, 1000));
        waited++;
    }

    // Save database and exit
    saveDatabase();
    if (db) db.close();
    console.log('✓ Database saved, exiting');
    process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ===== START SERVER =====
async function start() {
    try {
        await initDatabase();
        server = app.listen(PORT, async () => {
            console.log(`\n🚀 Sky Backend running on http://localhost:${PORT}`);
            console.log(`📁 Frontend served from: ${frontendPath}`);
            console.log(`📊 Database: ${DB_PATH}\n`);

            // Register bot commands on startup
            await setBotCommands();

            // Set webhook if in production (RENDER_EXTERNAL_URL available)
            const externalUrl = process.env.RENDER_EXTERNAL_URL;
            if (externalUrl) {
                const webhookUrl = `${externalUrl}/api/telegram/webhook`;
                const result = await telegramRequest('setWebhook', {
                    url: webhookUrl,
                    secret_token: WEBHOOK_SECRET
                });
                if (result.ok) console.log(`✓ Webhook set: ${webhookUrl}`);
                else logError('WEBHOOK_SET', result.description);
            }

            // Retry any failed Telegram messages from previous session
            await retryFailedMessages();

            // Auto-save database every 5 minutes
            dbSaveInterval = setInterval(() => {
                saveDatabase();
                console.log('✓ Database auto-saved');
            }, 5 * 60 * 1000);
        });
    } catch (error) {
        logError('STARTUP_FATAL', error);
        process.exit(1);
    }
}

start();

module.exports = app;
