const express = require('express');

module.exports = function(db, requireAuth, requireAdmin) {
    const router = express.Router();

    // Get all orders for a site (accountant can view)
    router.get('/:site', requireAuth, (req, res) => {
        const { site } = req.params;
        const { status, from, to } = req.query;

        let sql = 'SELECT * FROM orders WHERE site = ?';
        const params = [site];

        if (status && status !== 'all') {
            sql += ' AND status = ?';
            params.push(status);
        }

        if (from) {
            sql += ' AND created_at >= ?';
            params.push(from);
        }

        if (to) {
            sql += ' AND created_at <= ?';
            params.push(to + ' 23:59:59');
        }

        sql += ' ORDER BY created_at DESC';

        const orders = db.all(sql, params);
        res.json(orders);
    });

    // Get orders count by status (accountant can view)
    router.get('/:site/stats', requireAuth, (req, res) => {
        const { site } = req.params;

        const total = db.get('SELECT COUNT(*) as count FROM orders WHERE site = ?', [site]);
        const newOrders = db.get("SELECT COUNT(*) as count FROM orders WHERE site = ? AND status = 'new'", [site]);
        const inProgress = db.get("SELECT COUNT(*) as count FROM orders WHERE site = ? AND status = 'in_progress'", [site]);
        const completed = db.get("SELECT COUNT(*) as count FROM orders WHERE site = ? AND status = 'completed'", [site]);

        res.json({
            total: total?.count || 0,
            new: newOrders?.count || 0,
            in_progress: inProgress?.count || 0,
            completed: completed?.count || 0
        });
    });

    // Get orders statistics for charts (last 7 days)
    router.get('/:site/stats/chart', requireAuth, (req, res) => {
        const { site } = req.params;

        // Get orders for last 7 days
        const days = 7;
        const result = [];

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];

            const count = db.get(
                `SELECT COUNT(*) as count FROM orders
                 WHERE site = ? AND DATE(created_at) = ?`,
                [site, dateStr]
            );

            result.push({
                date: dateStr,
                count: count?.count || 0
            });
        }

        res.json(result);
    });

    // Get popular products (top 5 by orders)
    router.get('/:site/stats/popular', requireAuth, (req, res) => {
        const { site } = req.params;

        const popular = db.all(
            `SELECT product_key, COUNT(*) as count
             FROM orders
             WHERE site = ? AND product_key IS NOT NULL AND product_key != ''
             GROUP BY product_key
             ORDER BY count DESC
             LIMIT 5`,
            [site]
        );

        res.json(popular || []);
    });

    // Get single order (accountant can view)
    router.get('/:site/:id', requireAuth, (req, res) => {
        const { site, id } = req.params;
        const order = db.get('SELECT * FROM orders WHERE site = ? AND id = ?', [site, id]);
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.json(order);
    });

    // Create order (public endpoint for website)
    router.post('/:site', (req, res) => {
        const { site } = req.params;
        const { name, phone, email, rental_period, comment, page, product_key } = req.body;

        if (!name || !phone) {
            return res.status(400).json({ error: 'Name and phone are required' });
        }

        db.run(
            `INSERT INTO orders (site, name, phone, email, rental_period, comment, page, product_key, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new')`,
            [site, name, phone, email || '', rental_period || '', comment || '', page || '', product_key || '']
        );

        const newOrder = db.get('SELECT * FROM orders WHERE site = ? ORDER BY id DESC LIMIT 1', [site]);
        res.json({ success: true, data: newOrder });
    });

    // Update order status (accountant can change status)
    router.patch('/:site/:id/status', requireAuth, (req, res) => {
        const { site, id } = req.params;
        const { status } = req.body;

        const validStatuses = ['new', 'in_progress', 'completed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        db.run('UPDATE orders SET status = ? WHERE site = ? AND id = ?', [status, site, id]);
        res.json({ success: true });
    });

    // Update order notes (admin can add notes)
    router.patch('/:site/:id/notes', requireAuth, (req, res) => {
        const { site, id } = req.params;
        const { notes } = req.body;

        db.run('UPDATE orders SET notes = ? WHERE site = ? AND id = ?', [notes || '', site, id]);
        res.json({ success: true });
    });

    // Delete order (admin only)
    router.delete('/:site/:id', requireAdmin, (req, res) => {
        const { site, id } = req.params;
        db.run('DELETE FROM orders WHERE site = ? AND id = ?', [site, id]);
        res.json({ success: true });
    });

    return router;
};
