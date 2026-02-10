/**
 * Sky Template - Reviews Example Module
 * Customer reviews with star ratings and moderation
 *
 * Tables created: reviews
 *
 * Usage: Copy to ../reviews.js and add to server.js:
 *   const reviewsRoutes = require('./routes/reviews');
 *   app.use('/api/reviews', reviewsRoutes(dbHelpers, requireAuth));
 */

const express = require('express');

module.exports = function(dbHelpers, requireAuth) {
    const router = express.Router();

    // === Initialize Tables ===
    (function initTables() {
        try {
            dbHelpers.run(`CREATE TABLE IF NOT EXISTS reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                author_name TEXT NOT NULL,
                author_email TEXT,
                rating INTEGER NOT NULL,
                title TEXT,
                content TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
        } catch (e) {}
    })();

    // === PUBLIC: Get approved reviews ===
    router.get('/', (req, res) => {
        try {
            const { limit, offset } = req.query;
            let sql = "SELECT id, author_name, rating, title, content, created_at FROM reviews WHERE status = 'approved' ORDER BY created_at DESC";
            const params = [];

            if (limit) { sql += " LIMIT ?"; params.push(parseInt(limit) || 10); }
            if (offset) { sql += " OFFSET ?"; params.push(parseInt(offset) || 0); }

            const reviews = dbHelpers.all(sql, params);
            const total = dbHelpers.get("SELECT COUNT(*) as count FROM reviews WHERE status = 'approved'");

            res.json({ reviews, total: total?.count || 0 });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === PUBLIC: Get review stats ===
    router.get('/stats', (req, res) => {
        try {
            const stats = dbHelpers.get(`
                SELECT
                    COUNT(*) as total,
                    ROUND(AVG(rating), 1) as average_rating
                FROM reviews WHERE status = 'approved'
            `);

            const distribution = {};
            for (let i = 1; i <= 5; i++) {
                const row = dbHelpers.get(
                    "SELECT COUNT(*) as count FROM reviews WHERE status = 'approved' AND rating = ?", [i]
                );
                distribution[i] = row?.count || 0;
            }

            res.json({
                total: stats?.total || 0,
                average_rating: stats?.average_rating || 0,
                distribution
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === PUBLIC: Submit a review ===
    router.post('/', (req, res) => {
        try {
            const { author_name, author_email, rating, title, content } = req.body;

            if (!author_name || !content || !rating) {
                return res.status(400).json({ error: 'Required: author_name, content, rating' });
            }

            const ratingNum = parseInt(rating);
            if (ratingNum < 1 || ratingNum > 5) {
                return res.status(400).json({ error: 'Rating must be between 1 and 5' });
            }

            dbHelpers.run(
                "INSERT INTO reviews (author_name, author_email, rating, title, content) VALUES (?, ?, ?, ?, ?)",
                [author_name, author_email || null, ratingNum, title || null, content]
            );

            res.status(201).json({ message: 'Review submitted for moderation' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Get all reviews ===
    router.get('/admin/all', requireAuth, (req, res) => {
        try {
            const { status } = req.query;
            let sql = "SELECT * FROM reviews WHERE 1=1";
            const params = [];

            if (status) { sql += " AND status = ?"; params.push(status); }
            sql += " ORDER BY created_at DESC";

            res.json(dbHelpers.all(sql, params));
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Update review status ===
    router.patch('/:id/status', requireAuth, (req, res) => {
        try {
            const { status } = req.body;
            const validStatuses = ['pending', 'approved', 'rejected'];

            if (!validStatuses.includes(status)) {
                return res.status(400).json({ error: `Status must be: ${validStatuses.join(', ')}` });
            }

            dbHelpers.run("UPDATE reviews SET status = ? WHERE id = ?", [status, req.params.id]);
            res.json({ message: 'Review status updated' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Delete review ===
    router.delete('/:id', requireAuth, (req, res) => {
        try {
            dbHelpers.run("DELETE FROM reviews WHERE id = ?", [req.params.id]);
            res.json({ message: 'Review deleted' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
};
