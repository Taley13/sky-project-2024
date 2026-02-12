/**
 * Sky Template - FAQ Example Module
 * FAQ with categories and accordion display
 *
 * Tables created: faq_categories, faq_items
 *
 * Usage: Copy to ../faq.js and add to server.js:
 *   const faqRoutes = require('./routes/faq');
 *   app.use('/api/faq', faqRoutes(dbHelpers, requireAuth));
 */

const express = require('express');

module.exports = function(dbHelpers, requireAuth) {
    const router = express.Router();

    // === Initialize Tables ===
    (function initTables() {
        try {
            dbHelpers.run(`CREATE TABLE IF NOT EXISTS faq_categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                sort_order INTEGER DEFAULT 0
            )`);

            dbHelpers.run(`CREATE TABLE IF NOT EXISTS faq_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category_id INTEGER,
                question TEXT NOT NULL,
                answer TEXT NOT NULL,
                sort_order INTEGER DEFAULT 0,
                visible INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES faq_categories(id) ON DELETE SET NULL
            )`);
        } catch (e) {}
    })();

    // === PUBLIC: Get all visible FAQ grouped by category ===
    router.get('/', (req, res) => {
        try {
            const categories = dbHelpers.all("SELECT * FROM faq_categories ORDER BY sort_order, id");
            const items = dbHelpers.all(
                "SELECT * FROM faq_items WHERE visible = 1 ORDER BY sort_order, id"
            );

            const grouped = categories.map(cat => ({
                category: { id: cat.id, name: cat.name },
                items: items.filter(item => item.category_id === cat.id)
            }));

            // Add uncategorized items
            const uncategorized = items.filter(item => !item.category_id);
            if (uncategorized.length > 0) {
                grouped.push({
                    category: { id: null, name: 'General' },
                    items: uncategorized
                });
            }

            res.json(grouped);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === PUBLIC: Get categories ===
    router.get('/categories', (req, res) => {
        try {
            const categories = dbHelpers.all("SELECT * FROM faq_categories ORDER BY sort_order, id");
            res.json(categories);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Get all FAQ items ===
    router.get('/admin/items', requireAuth, (req, res) => {
        try {
            const { category_id } = req.query;
            let sql = `SELECT f.*, c.name as category_name
                        FROM faq_items f
                        LEFT JOIN faq_categories c ON f.category_id = c.id
                        WHERE 1=1`;
            const params = [];

            if (category_id) { sql += " AND f.category_id = ?"; params.push(category_id); }
            sql += " ORDER BY f.sort_order, f.id";

            res.json(dbHelpers.all(sql, params));
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Create FAQ item ===
    router.post('/admin/items', requireAuth, (req, res) => {
        try {
            const { category_id, question, answer, sort_order, visible } = req.body;
            if (!question || !answer) {
                return res.status(400).json({ error: 'Question and answer are required' });
            }

            dbHelpers.run(
                "INSERT INTO faq_items (category_id, question, answer, sort_order, visible) VALUES (?, ?, ?, ?, ?)",
                [category_id || null, question, answer, sort_order || 0, visible ?? 1]
            );

            res.status(201).json({ message: 'FAQ item created' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Update FAQ item ===
    router.put('/admin/items/:id', requireAuth, (req, res) => {
        try {
            const { category_id, question, answer, sort_order, visible } = req.body;
            dbHelpers.run(
                "UPDATE faq_items SET category_id=?, question=?, answer=?, sort_order=?, visible=? WHERE id=?",
                [category_id || null, question, answer, sort_order || 0, visible ?? 1, req.params.id]
            );
            res.json({ message: 'FAQ item updated' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Delete FAQ item ===
    router.delete('/admin/items/:id', requireAuth, (req, res) => {
        try {
            dbHelpers.run("DELETE FROM faq_items WHERE id = ?", [req.params.id]);
            res.json({ message: 'FAQ item deleted' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Get all categories ===
    router.get('/admin/categories', requireAuth, (req, res) => {
        try {
            const categories = dbHelpers.all("SELECT * FROM faq_categories ORDER BY sort_order, id");
            res.json(categories);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Create category ===
    router.post('/admin/categories', requireAuth, (req, res) => {
        try {
            const { name, sort_order } = req.body;
            if (!name) return res.status(400).json({ error: 'Name is required' });

            dbHelpers.run(
                "INSERT INTO faq_categories (name, sort_order) VALUES (?, ?)",
                [name, sort_order || 0]
            );
            res.status(201).json({ message: 'Category created' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Update category ===
    router.put('/admin/categories/:id', requireAuth, (req, res) => {
        try {
            const { name, sort_order } = req.body;
            dbHelpers.run(
                "UPDATE faq_categories SET name=?, sort_order=? WHERE id=?",
                [name, sort_order || 0, req.params.id]
            );
            res.json({ message: 'Category updated' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Delete category ===
    router.delete('/admin/categories/:id', requireAuth, (req, res) => {
        try {
            dbHelpers.run("UPDATE faq_items SET category_id = NULL WHERE category_id = ?", [req.params.id]);
            dbHelpers.run("DELETE FROM faq_categories WHERE id = ?", [req.params.id]);
            res.json({ message: 'Category deleted' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
};
