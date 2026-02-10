const express = require('express');

module.exports = function(db, requireAuth, requireAdmin) {
    const router = express.Router();

    // Get all hexagons for a site (auth required)
    router.get('/:site', requireAuth, (req, res) => {
        const { site } = req.params;
        const hexagons = db.all('SELECT * FROM hexagons WHERE site = ? ORDER BY sort_order', [site]);
        res.json(hexagons);
    });

    // Get single hexagon (auth required)
    router.get('/:site/:id', requireAuth, (req, res) => {
        const { site, id } = req.params;
        const hexagon = db.get('SELECT * FROM hexagons WHERE site = ? AND id = ?', [site, id]);
        if (!hexagon) {
            return res.status(404).json({ error: 'Hexagon not found' });
        }
        res.json(hexagon);
    });

    // Create hexagon (auth required)
    router.post('/:site', requireAuth, (req, res) => {
        const { site } = req.params;
        const { key, name_pl, name_en, name_de, name_ru, icon_number } = req.body;

        if (!key || !name_en) {
            return res.status(400).json({ error: 'Key and English name are required' });
        }

        // Get max sort order
        const maxOrder = db.get('SELECT MAX(sort_order) as max FROM hexagons WHERE site = ?', [site]);
        const sortOrder = (maxOrder?.max || 0) + 1;

        db.run(`INSERT INTO hexagons (site, key, name_pl, name_en, name_de, name_ru, icon_number, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [site, key, name_pl, name_en || '', name_de || '', name_ru || '', icon_number || 0, sortOrder]
        );

        const newHexagon = db.get('SELECT * FROM hexagons WHERE site = ? ORDER BY id DESC LIMIT 1', [site]);
        res.json({ success: true, data: newHexagon });
    });

    // Update hexagon (auth required)
    router.put('/:site/:id', requireAuth, (req, res) => {
        const { site, id } = req.params;
        const { key, name_pl, name_en, name_de, name_ru, icon_number, visible } = req.body;

        db.run(`UPDATE hexagons SET
            key = ?, name_pl = ?, name_en = ?, name_de = ?, name_ru = ?, icon_number = ?, visible = ?
            WHERE site = ? AND id = ?`,
            [key, name_pl, name_en, name_de, name_ru, icon_number, visible ? 1 : 0, site, id]
        );

        const updated = db.get('SELECT * FROM hexagons WHERE id = ?', [id]);
        res.json({ success: true, data: updated });
    });

    // Update visibility (auth required)
    router.patch('/:site/:id/visibility', requireAuth, (req, res) => {
        const { site, id } = req.params;
        const { visible } = req.body;

        db.run('UPDATE hexagons SET visible = ? WHERE site = ? AND id = ?', [visible ? 1 : 0, site, id]);
        res.json({ success: true });
    });

    // Reorder hexagons (auth required)
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
            db.run('UPDATE hexagons SET sort_order = ? WHERE site = ? AND id = ?', [sortOrder, site, id]);
        });

        res.json({ success: true });
    });

    // Delete hexagon (admin only)
    router.delete('/:site/:id', requireAdmin, (req, res) => {
        const { site, id } = req.params;
        db.run('DELETE FROM hexagons WHERE site = ? AND id = ?', [site, id]);
        res.json({ success: true });
    });

    return router;
};
