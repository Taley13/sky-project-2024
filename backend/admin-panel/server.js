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

// ===== API ROUTES =====

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Create lead (order)
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
        if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
            const message = `
<b>🚀 New Lead!</b>

<b>Name:</b> ${name}
<b>Phone:</b> ${phone}
${email ? `<b>Email:</b> ${email}\n` : ''}${rental_period ? `<b>Period:</b> ${rental_period}\n` : ''}${product_key ? `<b>Product:</b> ${product_key}\n` : ''}${page ? `<b>Page:</b> ${page}\n` : ''}${comment ? `<b>Comment:</b> ${comment}` : ''}
            `.trim();

            const encodedMessage = encodeURIComponent(message);
            const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${process.env.TELEGRAM_CHAT_ID}&text=${encodedMessage}&parse_mode=HTML`;

            https.get(url, () => {
                console.log(`✓ Lead sent to Telegram: ${name}`);
            }).on('error', (err) => {
                console.error('Telegram error:', err.message);
                // But order is saved, so we don't fail the response
            });
        }

        res.json({ success: true, message: 'Lead submitted successfully!' });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'Failed to submit lead' });
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
