const express = require('express');

module.exports = function(db, requireAuth, requireAdmin) {
    const router = express.Router();

    // Get all categories for a site (auth required for accountant to see products)
    router.get('/:site', requireAuth, (req, res) => {
        const { site } = req.params;
        const categories = db.all('SELECT * FROM categories WHERE site = ? ORDER BY sort_order', [site]);
        res.json(categories);
    });

    // Get single category (auth required)
    router.get('/:site/:id', requireAuth, (req, res) => {
        const { site, id } = req.params;
        const category = db.get('SELECT * FROM categories WHERE site = ? AND id = ?', [site, id]);
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }
        res.json(category);
    });

    // Create category (accountant can create)
    router.post('/:site', requireAuth, (req, res) => {
        const { site } = req.params;
        const { key, name_pl, name_en, name_de, name_ru, icon } = req.body;

        if (!key || !name_en) {
            return res.status(400).json({ error: 'Key and English name are required' });
        }

        // Get max sort order
        const maxOrder = db.get('SELECT MAX(sort_order) as max FROM categories WHERE site = ?', [site]);
        const sortOrder = (maxOrder?.max || 0) + 1;

        db.run(`INSERT INTO categories (site, key, name_pl, name_en, name_de, name_ru, icon, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [site, key, name_pl, name_en || '', name_de || '', name_ru || '', icon || '', sortOrder]
        );

        const newCategory = db.get('SELECT * FROM categories WHERE site = ? ORDER BY id DESC LIMIT 1', [site]);
        res.json({ success: true, data: newCategory });
    });

    // Update category (accountant can edit)
    router.put('/:site/:id', requireAuth, (req, res) => {
        const { site, id } = req.params;
        const { key, name_pl, name_en, name_de, name_ru, icon, visible } = req.body;

        db.run(`UPDATE categories SET
            key = ?, name_pl = ?, name_en = ?, name_de = ?, name_ru = ?, icon = ?, visible = ?
            WHERE site = ? AND id = ?`,
            [key, name_pl, name_en, name_de, name_ru, icon, visible ? 1 : 0, site, id]
        );

        const updated = db.get('SELECT * FROM categories WHERE id = ?', [id]);
        res.json({ success: true, data: updated });
    });

    // Update visibility (accountant can change)
    router.patch('/:site/:id/visibility', requireAuth, (req, res) => {
        const { site, id } = req.params;
        const { visible } = req.body;

        db.run('UPDATE categories SET visible = ? WHERE site = ? AND id = ?', [visible ? 1 : 0, site, id]);
        res.json({ success: true });
    });

    // Reorder categories (accountant can reorder)
    router.post('/:site/reorder', requireAuth, (req, res) => {
        const { site } = req.params;
        const { order } = req.body; // Array of {id, sort_order} objects

        if (!Array.isArray(order)) {
            return res.status(400).json({ error: 'Order must be an array' });
        }

        order.forEach((item) => {
            // Support both formats: simple array of IDs or array of objects
            const id = typeof item === 'object' ? item.id : item;
            const sortOrder = typeof item === 'object' ? item.sort_order : order.indexOf(item);
            db.run('UPDATE categories SET sort_order = ? WHERE site = ? AND id = ?', [sortOrder, site, id]);
        });

        res.json({ success: true });
    });

    // Delete category (admin only)
    router.delete('/:site/:id', requireAdmin, (req, res) => {
        const { site, id } = req.params;
        db.run('DELETE FROM categories WHERE site = ? AND id = ?', [site, id]);
        res.json({ success: true });
    });

    return router;
};
