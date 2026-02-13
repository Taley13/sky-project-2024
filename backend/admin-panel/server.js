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

// Configurator lead
app.post('/api/telegram/configurator', leadsLimiter, (req, res) => {
    const {
        siteType, modules, package: pkg, discount, total, botConfig,
        clientName, clientPhone, clientEmail, site, currency
    } = req.body;

    if (!clientName || !clientPhone) {
        return res.status(400).json({ error: 'Name and phone are required' });
    }

    try {
        // Build modules list for message
        const curr = currency || 'EUR';
        const modulesList = (modules || [])
            .map(m => {
                const name = m.name_ru || m.name_en || m.id || 'Module';
                return `  • ${escapeHtml(name)} — ${m.price || 0} ${curr}`;
            })
            .join('\n');

        const timestamp = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Warsaw' });

        const message = [
            `<b>🔧 ЗАЯВКА С КОНФИГУРАТОРА</b>`,
            ``,
            `<b>👤 Клиент:</b> ${escapeHtml(clientName)}`,
            `<b>📞 Телефон:</b> ${escapeHtml(clientPhone)}`,
            clientEmail ? `<b>📧 Email:</b> ${escapeHtml(clientEmail)}` : null,
            ``,
            `<b>🌐 Тип сайта:</b> ${escapeHtml(siteType || 'Не указан')}`,
            modulesList ? `\n<b>📦 Модули:</b>\n${modulesList}` : null,
            pkg ? `\n<b>📋 Пакет:</b> ${escapeHtml(pkg)}` : null,
            discount ? `<b>🏷 Скидка:</b> ${discount}%` : null,
            total != null ? `<b>💰 Итого:</b> ${total} ${curr}` : null,
            botConfig ? `\n<b>🤖 Telegram-бот:</b> ${escapeHtml(JSON.stringify(botConfig))}` : null,
            ``,
            `<b>⏰</b> ${timestamp}`,
        ].filter(Boolean).join('\n');

        sendTelegram(message);

        // Save to database
        const comment = `Configurator: ${siteType || ''} | Modules: ${(modules || []).length} | Total: ${total || 0} ${curr}`;
        db.run(
            `INSERT INTO orders (name, phone, email, comment, page, product_key, status)
             VALUES (?, ?, ?, ?, ?, ?, 'new')`,
            [clientName, clientPhone, clientEmail || '', comment, 'configurator', 'configurator', ]
        );
        saveDatabase();

        res.json({ success: true, message: 'Configuration submitted successfully!' });
    } catch (error) {
        console.error('Error submitting configuration:', error);
        res.status(500).json({ error: 'Failed to submit configuration' });
    }
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
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

start();

module.exports = app;
