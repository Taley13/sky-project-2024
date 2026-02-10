require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const multer = require('multer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const csrf = require('csurf');

const app = express();

// Trust proxy for rate limiting behind nginx
app.set('trust proxy', 1);

// Security: Helmet for HTTP headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'", "https://cdn.jsdelivr.net"],
        },
    },
    crossOriginEmbedderPolicy: false,
}));

// CSP Violation Reporting
app.post('/api/csp-violation', express.json({ type: 'application/csp-report' }), (req, res) => {
    if (req.body && process.env.NODE_ENV !== 'production') {
        console.warn('CSP Violation:', JSON.stringify(req.body, null, 2));
    }
    res.status(204).end();
});

// Rate limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Too many login attempts. Try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
});

const passwordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: { error: 'Too many password change attempts. Try again in 1 hour.' },
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/change-password', passwordLimiter);
app.use('/api/users/:id/password', passwordLimiter);

// Input sanitization
const sanitizeInput = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (let key in obj) {
        if (typeof obj[key] === 'string') {
            obj[key] = obj[key].replace(/['"\\;]/g, '');
        } else if (typeof obj[key] === 'object') {
            sanitizeInput(obj[key]);
        }
    }
};

app.use((req, res, next) => {
    sanitizeInput(req.body);
    sanitizeInput(req.query);
    sanitizeInput(req.params);
    next();
});

// Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        if (allowedTypes.test(path.extname(file.originalname).toLowerCase()) && allowedTypes.test(file.mimetype)) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed'));
    }
});

const PORT = process.env.PORT || 7001;
const DB_PATH = path.join(__dirname, 'database.sqlite');
const SITE_KEY = process.env.SITE_KEY || 'default';

let db;

// Initialize database
async function initDatabase() {
    const SQL = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
        const buffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(buffer);
    } else {
        db = new SQL.Database();
    }

    // Create tables
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Migration: Add role column if not exists
    try {
        const tableInfo = db.exec("PRAGMA table_info(users)");
        if (tableInfo.length > 0) {
            const columns = tableInfo[0].values.map(row => row[1]);
            if (!columns.includes('role')) {
                db.run("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'admin'");
                saveDatabase();
            }
        }
    } catch (e) {}

    db.run(`CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site TEXT NOT NULL DEFAULT '${SITE_KEY}',
        phone TEXT,
        email TEXT,
        address TEXT,
        address_line2 TEXT,
        nip TEXT,
        telegram TEXT,
        contact_person TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site TEXT NOT NULL DEFAULT '${SITE_KEY}',
        key TEXT NOT NULL,
        name_pl TEXT,
        name_en TEXT,
        name_de TEXT,
        name_ru TEXT,
        icon TEXT,
        visible INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site TEXT NOT NULL DEFAULT '${SITE_KEY}',
        category_id INTEGER,
        product_key TEXT NOT NULL,
        image TEXT,
        price TEXT,
        visible INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS product_translations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        lang TEXT NOT NULL,
        title TEXT,
        subtitle TEXT,
        description TEXT,
        advantages TEXT,
        specs TEXT,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site TEXT NOT NULL DEFAULT '${SITE_KEY}',
        name TEXT,
        phone TEXT,
        email TEXT,
        rental_period TEXT,
        comment TEXT,
        page TEXT,
        product_key TEXT,
        status TEXT DEFAULT 'new',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS hexagons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site TEXT NOT NULL DEFAULT '${SITE_KEY}',
        key TEXT NOT NULL UNIQUE,
        name_pl TEXT,
        name_en TEXT,
        name_de TEXT,
        name_ru TEXT,
        icon_number INTEGER,
        visible INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Create demo data only if INIT_DEMO_DATA=true
    if (process.env.INIT_DEMO_DATA === 'true') {
        const catCount = db.exec(`SELECT COUNT(*) FROM categories WHERE site = '${SITE_KEY}'`);
        if ((catCount[0]?.values[0]?.[0] || 0) === 0) {
            const demoCategories = [
                [SITE_KEY, 'category-1', 'Kategoria 1', 'Category 1', 'Kategorie 1', 'Категория 1', '1', 1],
                [SITE_KEY, 'category-2', 'Kategoria 2', 'Category 2', 'Kategorie 2', 'Категория 2', '2', 2],
                [SITE_KEY, 'category-3', 'Kategoria 3', 'Category 3', 'Kategorie 3', 'Категория 3', '3', 3],
            ];
            demoCategories.forEach(cat => {
                db.run(`INSERT INTO categories (site, key, name_pl, name_en, name_de, name_ru, icon, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, cat);
            });
            if (process.env.NODE_ENV !== 'production') console.log('Demo categories created');
            saveDatabase();
        }

        const contactExists = db.exec(`SELECT id FROM contacts WHERE site = '${SITE_KEY}'`);
        if (contactExists.length === 0) {
            db.run(`INSERT INTO contacts (site, phone, email, address, contact_person) VALUES (?, ?, ?, ?, ?)`,
                [SITE_KEY, '+XX XXX XXX XXX', 'contact@example.com', 'Your Address', 'Your Name']);
            if (process.env.NODE_ENV !== 'production') console.log('Demo contacts created');
            saveDatabase();
        }
    }

    // Create default admin user if not exists
    const result = db.exec("SELECT id FROM users WHERE username = 'admin'");
    if (result.length === 0) {
        const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || require('crypto').randomBytes(16).toString('hex');
        const hashedPassword = bcrypt.hashSync(defaultPassword, 10);
        db.run("INSERT INTO users (username, password) VALUES (?, ?)", ['admin', hashedPassword]);
        if (process.env.NODE_ENV !== 'production') {
            console.log('Default admin user created');
            if (!process.env.ADMIN_DEFAULT_PASSWORD) {
                console.log('Generated admin password:', defaultPassword);
                console.log('Set ADMIN_DEFAULT_PASSWORD in .env to use a fixed password.');
            }
        }
        saveDatabase();
    }

    return db;
}

// Save database to file
function saveDatabase() {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// Database helpers
const dbHelpers = {
    get(sql, params = []) {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        if (stmt.step()) { const row = stmt.getAsObject(); stmt.free(); return row; }
        stmt.free();
        return null;
    },
    all(sql, params = []) {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        return rows;
    },
    run(sql, params = []) {
        db.run(sql, params);
        saveDatabase();
        return { changes: db.getRowsModified() };
    }
};

// CORS
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
app.use(cors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'change-this-secret-key',
    resave: false,
    saveUninitialized: false,
    name: 'sky.sid',
    proxy: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// CSRF Protection
const csrfProtection = csrf({ cookie: false });

app.use('/api', (req, res, next) => {
    const skipPaths = ['/api/public', '/api/telegram', '/api/auth/login', '/api/csp-violation'];
    const isSkipped = skipPaths.some(p => req.path.startsWith(p.replace('/api', '')));
    if (req.method === 'GET' || isSkipped) return next();
    csrfProtection(req, res, next);
});

app.get('/api/csrf-token', csrfProtection, (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        if (process.env.NODE_ENV !== 'production') {
            console.warn('CSRF attack detected:', req.ip, req.path);
        }
        return res.status(403).json({ error: 'Invalid CSRF token' });
    }
    next(err);
});

// Routes
app.get('/', (req, res) => {
    if (req.session && req.session.userId) {
        res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public', 'login.html'));
    }
});

app.get('/dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.use(express.static(path.join(__dirname, 'public'), { index: false }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Auth middleware
const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) return next();
    if (req.originalUrl.includes("/api") || req.xhr || (req.headers.accept && req.headers.accept.includes("application/json"))) {
        res.status(401).json({ error: "Unauthorized" });
    } else {
        res.redirect("./");
    }
};

const { requireAdmin } = require('./middleware/roles');

// Mount routes
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes(dbHelpers));

const usersRoutes = require('./routes/users');
app.use('/api/users', usersRoutes(dbHelpers, requireAdmin));

const contactsRoutes = require('./routes/contacts');
app.use('/api/contacts', contactsRoutes(dbHelpers, requireAuth, requireAdmin));

const categoriesRoutes = require('./routes/categories');
app.use('/api/categories', categoriesRoutes(dbHelpers, requireAuth, requireAdmin));

const hexagonsRoutes = require('./routes/hexagons');
app.use('/api/hexagons', hexagonsRoutes(dbHelpers, requireAuth, requireAdmin));

const productsRoutes = require('./routes/products');
app.use('/api/products', productsRoutes(dbHelpers, requireAuth, requireAdmin, upload));

const ordersRoutes = require('./routes/orders');
app.use('/api/orders', ordersRoutes(dbHelpers, requireAuth, requireAdmin));

const settingsRoutes = require('./routes/settings');
app.use('/api/settings', settingsRoutes(dbHelpers, requireAuth, requireAdmin));

const publicRoutes = require('./routes/public');
app.use('/api/public', publicRoutes(dbHelpers));

const telegramRoutes = require('./routes/telegram');
app.use('/api/telegram', telegramRoutes(dbHelpers));

const configuratorRoutes = require('./routes/configurator');
app.use('/api/telegram', configuratorRoutes(dbHelpers));

// Business modules
const bookingRoutes = require('./routes/booking');
app.use('/api/bookings', bookingRoutes(dbHelpers, requireAuth));

const catalogRoutes = require('./routes/catalog');
app.use('/api/catalog', catalogRoutes(dbHelpers, requireAuth, upload));

const cartRoutes = require('./routes/cart');
app.use('/api/cart', cartRoutes(dbHelpers, requireAuth));

app.get('/dashboard', (req, res) => res.redirect('/dashboard.html'));

app.get('/api/auth/status', (req, res) => {
    if (req.session && req.session.userId) {
        res.json({ authenticated: true, username: req.session.username });
    } else {
        res.json({ authenticated: false });
    }
});

app.locals.dbHelpers = dbHelpers;
app.locals.requireAuth = requireAuth;

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
initDatabase().then(() => {
    app.listen(PORT, () => {
        if (process.env.NODE_ENV !== 'production') {
            console.log('\n========================================');
            console.log('  Sky Admin Panel');
            console.log('  http://localhost:' + PORT);
            console.log('========================================\n');
        } else {
            console.log(`Sky API started on port ${PORT}`);
        }
    });
}).catch(err => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
});

module.exports = { app, dbHelpers };
