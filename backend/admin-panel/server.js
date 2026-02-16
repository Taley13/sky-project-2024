/**
 * Sky - Minimal Backend
 * Frontend static serving + Leads API to Telegram
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const https = require('https');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const initSqlJs = require('sql.js');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 4000;
const DB_PATH = path.join(__dirname, 'database.sqlite');

let db;

// Load modules DB for TZ generation
const MODULES_PATH = path.join(__dirname, '..', '..', 'frontend', 'data', 'modules.json');
let modulesDB = null;
try {
    modulesDB = JSON.parse(fs.readFileSync(MODULES_PATH, 'utf-8'));
    console.log('✓ Modules DB loaded for TZ generation');
} catch (e) {
    console.error('Failed to load modules.json:', e.message);
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

// ===== PARSING =====
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ===== RATE LIMITING =====
const leadsLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 requests per hour
    message: { error: 'Too many lead submissions. Please try again later.' },
});

// ===== DATABASE =====
async function initDatabase() {
    const SQL = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
        const buffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(buffer);
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
    } catch (e) {}

    saveDatabase();
    console.log('✓ Database initialized');
}

function saveDatabase() {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
}

// ===== TELEGRAM BOT =====

// Load portfolio for /projects command
const PORTFOLIO_PATH = path.join(__dirname, '..', '..', 'frontend', 'data', 'portfolio-projects.json');
let portfolioDB = null;
try {
    portfolioDB = JSON.parse(fs.readFileSync(PORTFOLIO_PATH, 'utf-8'));
} catch (e) {
    console.error('Failed to load portfolio-projects.json:', e.message);
}

const SITE_URL = process.env.RENDER_EXTERNAL_URL || 'https://sky-backend-xisk.onrender.com';

// Register bot commands with Telegram on startup
function setBotCommands() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;

    const payload = JSON.stringify({
        commands: [
            { command: 'start', description: 'Welcome message' },
            { command: 'help', description: 'How to use this bot' },
            { command: 'projects', description: 'Our portfolio' }
        ]
    });

    const options = {
        hostname: 'api.telegram.org',
        path: `/bot${token}/setMyCommands`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    };

    const req = https.request(options, (res) => {
        let d = '';
        res.on('data', chunk => d += chunk);
        res.on('end', () => {
            try {
                const result = JSON.parse(d);
                if (result.ok) console.log('✓ Bot commands registered');
                else console.error('setMyCommands error:', result.description);
            } catch (e) { /* ignore */ }
        });
    });
    req.on('error', () => {});
    req.write(payload);
    req.end();
}

// Send message with optional inline keyboard
function sendTelegramWithButtons(chatId, text, buttons) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;

    const body = {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
    };
    if (buttons) body.reply_markup = { inline_keyboard: buttons };

    const payload = JSON.stringify(body);
    const options = {
        hostname: 'api.telegram.org',
        path: `/bot${token}/sendMessage`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    };

    const req = https.request(options, (res) => {
        let d = '';
        res.on('data', chunk => d += chunk);
        res.on('end', () => {});
    });
    req.on('error', () => {});
    req.write(payload);
    req.end();
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
            `I accept website creation requests.`,
            `Fill out the form on our website, and I'll send a complete technical specification here.`,
            ``,
            `<b>Commands:</b>`,
            `/start — this message`,
            `/help — how to use`,
            `/projects — our portfolio`,
            ``,
            `Want to discuss a project? Write @taleyaliev306`
        ].join('\n');

        sendTelegramWithButtons(chatId, welcome, [
            [{ text: 'Build a Website', url: `${SITE_URL}/services.html` }],
            [{ text: 'Our Portfolio', url: `${SITE_URL}/portfolio.html` }],
            [{ text: 'Contact Us', url: `${SITE_URL}/contacts.html` }]
        ]);
    } else if (text === '/help') {
        const help = [
            `<b>How it works:</b>`,
            ``,
            `1. Go to our configurator`,
            `2. Choose your site type and modules`,
            `3. Enter your contact details and submit`,
            `4. A full TZ (technical specification) arrives in this chat`,
            ``,
            `<b>What the TZ includes:</b>`,
            ` - Site type with all features`,
            ` - Selected modules with descriptions`,
            ` - Financial summary with discounts`,
            ``,
            `Questions? Write @taleyaliev306`
        ].join('\n');

        sendTelegramWithButtons(chatId, help, [
            [{ text: 'Open Configurator', url: `${SITE_URL}/services.html` }]
        ]);
    } else if (text === '/projects') {
        const projects = portfolioDB?.projects || [];
        if (projects.length === 0) {
            sendTelegramWithButtons(chatId, 'Portfolio is being updated. Visit our website for the latest projects.', [
                [{ text: 'View Portfolio', url: `${SITE_URL}/portfolio.html` }]
            ]);
            return;
        }

        const lines = [`<b>Our Projects:</b>`, ``];
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

        lines.push(`Full portfolio on the website:`);
        buttons.push([{ text: 'All Projects', url: `${SITE_URL}/portfolio.html` }]);

        sendTelegramWithButtons(chatId, lines.join('\n'), buttons);
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
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return;

    const payload = JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
    });

    const options = {
        hostname: 'api.telegram.org',
        path: `/bot${token}/sendMessage`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            try {
                const result = JSON.parse(data);
                if (result.ok) {
                    console.log('✓ Telegram message sent');
                } else {
                    console.error('Telegram API error:', result.description);
                }
            } catch (e) {
                console.error('Telegram parse error:', e.message);
            }
        });
    });

    req.on('error', (err) => {
        console.error('Telegram request error:', err.message);
    });

    req.write(payload);
    req.end();
}

// Send multiple Telegram messages sequentially (last message gets inline buttons)
function sendTelegramSequence(messages, lastMessageButtons) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId || !messages.length) return;

    let i = 0;
    function sendNext() {
        if (i >= messages.length) return;
        const isLast = (i === messages.length - 1);
        const body = {
            chat_id: chatId,
            text: messages[i],
            parse_mode: 'HTML'
        };
        if (isLast && lastMessageButtons) {
            body.reply_markup = { inline_keyboard: lastMessageButtons };
        }
        const payload = JSON.stringify(body);
        const options = {
            hostname: 'api.telegram.org',
            path: `/bot${token}/sendMessage`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.ok) {
                        console.log(`✓ TZ message ${i + 1}/${messages.length} sent`);
                    } else {
                        console.error('Telegram API error:', result.description);
                    }
                } catch (e) {
                    console.error('Telegram parse error:', e.message);
                }
                i++;
                if (i < messages.length) setTimeout(sendNext, 300);
            });
        });
        req.on('error', (err) => {
            console.error('Telegram request error:', err.message);
        });
        req.write(payload);
        req.end();
    }
    sendNext();
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
    let pkgDesc = '';
    if (pkgId && siteTypeId && modulesDB?.packages?.[siteTypeId]) {
        const pkgDB = modulesDB.packages[siteTypeId].find(p => p.id === pkgId);
        if (pkgDB) {
            pkgName = pkgDB.name_ru || '';
            pkgDesc = pkgDB.description_ru || '';
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

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'Failed to submit lead' });
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
        console.error('Error submitting configuration:', error);
        res.status(500).json({ error: 'Failed to submit configuration' });
    }
});

// Telegram bot webhook — handles /start, /help, /projects
app.post('/api/telegram/webhook', (req, res) => {
    try {
        handleBotUpdate(req.body);
    } catch (e) {
        console.error('Webhook error:', e.message);
    }
    res.sendStatus(200);
});

// ===== STATIC FILES =====
const frontendPath = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(frontendPath, { index: 'index.html' }));

// SPA fallback - serve index.html for unknown routes
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// ===== ERROR HANDLING =====
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
});

// ===== GRACEFUL SHUTDOWN =====
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    saveDatabase();
    if (db) db.close();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    saveDatabase();
    if (db) db.close();
    process.exit(0);
});

// ===== START SERVER =====
async function start() {
    try {
        await initDatabase();
        app.listen(PORT, () => {
            console.log(`\n🚀 Sky Backend running on http://localhost:${PORT}`);
            console.log(`📁 Frontend served from: ${frontendPath}`);
            console.log(`📊 Database: ${DB_PATH}\n`);

            // Register bot commands on startup
            setBotCommands();

            // Set webhook if in production (RENDER_EXTERNAL_URL available)
            const externalUrl = process.env.RENDER_EXTERNAL_URL;
            if (externalUrl) {
                const webhookUrl = `${externalUrl}/api/telegram/webhook`;
                const token = process.env.TELEGRAM_BOT_TOKEN;
                if (token) {
                    const payload = JSON.stringify({ url: webhookUrl });
                    const options = {
                        hostname: 'api.telegram.org',
                        path: `/bot${token}/setWebhook`,
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
                    };
                    const req = https.request(options, (res) => {
                        let d = '';
                        res.on('data', chunk => d += chunk);
                        res.on('end', () => {
                            try {
                                const result = JSON.parse(d);
                                if (result.ok) console.log(`✓ Webhook set: ${webhookUrl}`);
                                else console.error('setWebhook error:', result.description);
                            } catch (e) { /* ignore */ }
                        });
                    });
                    req.on('error', () => {});
                    req.write(payload);
                    req.end();
                }
            }
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

start();

module.exports = app;
