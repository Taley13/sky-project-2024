/**
 * Sky Template - Extended Catalog Example Module
 * Full product catalog with SKU, stock, multiple images
 *
 * Tables created: catalog_products, catalog_images
 *
 * Usage: Copy to ../catalog.js and add to server.js:
 *   const catalogRoutes = require('./routes/catalog');
 *   app.use('/api/catalog', catalogRoutes(dbHelpers, requireAuth, upload));
 */

const express = require('express');

module.exports = function(dbHelpers, requireAuth, upload) {
    const router = express.Router();

    // === Initialize Tables ===
    (function initTables() {
        try {
            dbHelpers.run(`CREATE TABLE IF NOT EXISTS catalog_products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sku TEXT UNIQUE,
                name TEXT NOT NULL,
                description TEXT,
                price REAL NOT NULL DEFAULT 0,
                sale_price REAL,
                currency TEXT DEFAULT 'PLN',
                stock INTEGER DEFAULT 0,
                category TEXT,
                brand TEXT,
                weight REAL,
                dimensions TEXT,
                visible INTEGER DEFAULT 1,
                featured INTEGER DEFAULT 0,
                sort_order INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            dbHelpers.run(`CREATE TABLE IF NOT EXISTS catalog_images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                image_path TEXT NOT NULL,
                is_primary INTEGER DEFAULT 0,
                sort_order INTEGER DEFAULT 0,
                FOREIGN KEY (product_id) REFERENCES catalog_products(id) ON DELETE CASCADE
            )`);
        } catch (e) {}
    })();

    // === PUBLIC: Get all visible products ===
    router.get('/products', (req, res) => {
        try {
            const { category, search, sort, limit, offset } = req.query;
            let sql = "SELECT * FROM catalog_products WHERE visible = 1";
            const params = [];

            if (category) { sql += " AND category = ?"; params.push(category); }
            if (search) { sql += " AND (name LIKE ? OR description LIKE ? OR sku LIKE ?)"; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

            switch (sort) {
                case 'price_asc': sql += " ORDER BY price ASC"; break;
                case 'price_desc': sql += " ORDER BY price DESC"; break;
                case 'name': sql += " ORDER BY name ASC"; break;
                case 'newest': sql += " ORDER BY created_at DESC"; break;
                default: sql += " ORDER BY sort_order ASC, id DESC";
            }

            if (limit) { sql += " LIMIT ?"; params.push(parseInt(limit)); }
            if (offset) { sql += " OFFSET ?"; params.push(parseInt(offset)); }

            const products = dbHelpers.all(sql, params);

            // Attach images
            products.forEach(p => {
                p.images = dbHelpers.all(
                    "SELECT * FROM catalog_images WHERE product_id = ? ORDER BY sort_order",
                    [p.id]
                );
            });

            res.json(products);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === PUBLIC: Get single product ===
    router.get('/products/:id', (req, res) => {
        try {
            const product = dbHelpers.get("SELECT * FROM catalog_products WHERE id = ?", [req.params.id]);
            if (!product) return res.status(404).json({ error: 'Product not found' });

            product.images = dbHelpers.all(
                "SELECT * FROM catalog_images WHERE product_id = ? ORDER BY sort_order",
                [product.id]
            );

            res.json(product);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === PUBLIC: Get categories list ===
    router.get('/categories', (req, res) => {
        try {
            const categories = dbHelpers.all(
                "SELECT DISTINCT category, COUNT(*) as count FROM catalog_products WHERE visible = 1 AND category IS NOT NULL GROUP BY category ORDER BY category"
            );
            res.json(categories);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Get all products (including hidden) ===
    router.get('/admin/products', requireAuth, (req, res) => {
        try {
            const products = dbHelpers.all("SELECT * FROM catalog_products ORDER BY sort_order ASC, id DESC");
            products.forEach(p => {
                p.images = dbHelpers.all("SELECT * FROM catalog_images WHERE product_id = ? ORDER BY sort_order", [p.id]);
            });
            res.json(products);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Create product ===
    router.post('/admin/products', requireAuth, (req, res) => {
        try {
            const { sku, name, description, price, sale_price, currency, stock, category, brand, weight, dimensions } = req.body;

            if (!name || price === undefined) {
                return res.status(400).json({ error: 'Name and price are required' });
            }

            // Auto-generate SKU if not provided
            const finalSku = sku || `SKU-${Date.now()}`;

            dbHelpers.run(
                `INSERT INTO catalog_products (sku, name, description, price, sale_price, currency, stock, category, brand, weight, dimensions)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [finalSku, name, description || '', price, sale_price || null, currency || 'PLN', stock || 0, category || null, brand || null, weight || null, dimensions || null]
            );

            const product = dbHelpers.get("SELECT * FROM catalog_products WHERE sku = ?", [finalSku]);
            res.status(201).json(product);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Update product ===
    router.put('/admin/products/:id', requireAuth, (req, res) => {
        try {
            const { sku, name, description, price, sale_price, currency, stock, category, brand, weight, dimensions, visible, featured } = req.body;

            dbHelpers.run(
                `UPDATE catalog_products SET
                    sku=?, name=?, description=?, price=?, sale_price=?, currency=?,
                    stock=?, category=?, brand=?, weight=?, dimensions=?,
                    visible=?, featured=?, updated_at=CURRENT_TIMESTAMP
                 WHERE id=?`,
                [sku, name, description, price, sale_price, currency, stock, category, brand, weight, dimensions, visible ?? 1, featured ?? 0, req.params.id]
            );

            res.json({ message: 'Product updated' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Delete product ===
    router.delete('/admin/products/:id', requireAuth, (req, res) => {
        try {
            dbHelpers.run("DELETE FROM catalog_images WHERE product_id = ?", [req.params.id]);
            dbHelpers.run("DELETE FROM catalog_products WHERE id = ?", [req.params.id]);
            res.json({ message: 'Product deleted' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Upload product image ===
    router.post('/admin/products/:id/images', requireAuth, upload.single('image'), (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

            const isPrimary = req.body.is_primary === 'true' ? 1 : 0;

            // If this is primary, unset other primaries
            if (isPrimary) {
                dbHelpers.run("UPDATE catalog_images SET is_primary = 0 WHERE product_id = ?", [req.params.id]);
            }

            dbHelpers.run(
                "INSERT INTO catalog_images (product_id, image_path, is_primary) VALUES (?, ?, ?)",
                [req.params.id, req.file.filename, isPrimary]
            );

            res.status(201).json({ message: 'Image uploaded', filename: req.file.filename });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Delete product image ===
    router.delete('/admin/images/:id', requireAuth, (req, res) => {
        try {
            dbHelpers.run("DELETE FROM catalog_images WHERE id = ?", [req.params.id]);
            res.json({ message: 'Image deleted' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Update stock ===
    router.patch('/admin/products/:id/stock', requireAuth, (req, res) => {
        try {
            const { stock } = req.body;
            dbHelpers.run("UPDATE catalog_products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [stock, req.params.id]);
            res.json({ message: 'Stock updated' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
};
