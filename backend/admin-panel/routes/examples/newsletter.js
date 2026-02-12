/**
 * Sky Template - Newsletter Example Module
 * Email subscription management with campaigns
 *
 * Tables created: newsletter_subscribers, newsletter_campaigns
 *
 * Usage: Copy to ../newsletter.js and add to server.js:
 *   const newsletterRoutes = require('./routes/newsletter');
 *   app.use('/api/newsletter', newsletterRoutes(dbHelpers, requireAuth));
 */

const express = require('express');
const crypto = require('crypto');

module.exports = function(dbHelpers, requireAuth) {
    const router = express.Router();

    // === Initialize Tables ===
    (function initTables() {
        try {
            dbHelpers.run(`CREATE TABLE IF NOT EXISTS newsletter_subscribers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL UNIQUE,
                status TEXT DEFAULT 'active',
                unsubscribe_token TEXT UNIQUE,
                subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                unsubscribed_at DATETIME
            )`);

            dbHelpers.run(`CREATE TABLE IF NOT EXISTS newsletter_campaigns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                subject TEXT,
                description TEXT,
                status TEXT DEFAULT 'draft',
                sent_at DATETIME,
                recipient_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
        } catch (e) {}
    })();

    // === PUBLIC: Subscribe ===
    router.post('/subscribe', (req, res) => {
        try {
            const { email } = req.body;

            if (!email || !email.includes('@')) {
                return res.status(400).json({ error: 'Valid email is required' });
            }

            const existing = dbHelpers.get("SELECT * FROM newsletter_subscribers WHERE email = ?", [email]);

            if (existing) {
                if (existing.status === 'unsubscribed') {
                    const token = crypto.randomBytes(32).toString('hex');
                    dbHelpers.run(
                        "UPDATE newsletter_subscribers SET status = 'active', unsubscribe_token = ?, unsubscribed_at = NULL, subscribed_at = CURRENT_TIMESTAMP WHERE id = ?",
                        [token, existing.id]
                    );
                }
                // Always return success (don't reveal subscription status)
                return res.json({ message: 'Subscribed successfully' });
            }

            const token = crypto.randomBytes(32).toString('hex');
            dbHelpers.run(
                "INSERT INTO newsletter_subscribers (email, unsubscribe_token) VALUES (?, ?)",
                [email, token]
            );

            res.status(201).json({ message: 'Subscribed successfully' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === PUBLIC: Unsubscribe by token ===
    router.get('/unsubscribe/:token', (req, res) => {
        try {
            const sub = dbHelpers.get("SELECT * FROM newsletter_subscribers WHERE unsubscribe_token = ?", [req.params.token]);

            if (!sub) {
                return res.status(404).send('<html><body><h2>Invalid unsubscribe link</h2></body></html>');
            }

            dbHelpers.run(
                "UPDATE newsletter_subscribers SET status = 'unsubscribed', unsubscribed_at = CURRENT_TIMESTAMP WHERE id = ?",
                [sub.id]
            );

            res.send('<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>Unsubscribed</h2><p>You have been successfully unsubscribed.</p></body></html>');
        } catch (e) {
            res.status(500).send('<html><body><h2>Error</h2></body></html>');
        }
    });

    // === ADMIN: Get subscribers ===
    router.get('/admin/subscribers', requireAuth, (req, res) => {
        try {
            const { status } = req.query;
            let sql = "SELECT id, email, status, subscribed_at, unsubscribed_at FROM newsletter_subscribers WHERE 1=1";
            const params = [];

            if (status) { sql += " AND status = ?"; params.push(status); }
            sql += " ORDER BY subscribed_at DESC";

            res.json(dbHelpers.all(sql, params));
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Export subscribers as CSV ===
    router.get('/admin/subscribers/export', requireAuth, (req, res) => {
        try {
            const subs = dbHelpers.all(
                "SELECT email, status, subscribed_at, unsubscribed_at FROM newsletter_subscribers WHERE status = 'active' ORDER BY subscribed_at DESC"
            );

            let csv = 'email,subscribed_at,status\n';
            subs.forEach(s => {
                csv += `${s.email},${s.subscribed_at},${s.status}\n`;
            });

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="subscribers.csv"');
            res.send(csv);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Delete subscriber ===
    router.delete('/admin/subscribers/:id', requireAuth, (req, res) => {
        try {
            dbHelpers.run("DELETE FROM newsletter_subscribers WHERE id = ?", [req.params.id]);
            res.json({ message: 'Subscriber deleted' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Get campaigns ===
    router.get('/admin/campaigns', requireAuth, (req, res) => {
        try {
            res.json(dbHelpers.all("SELECT * FROM newsletter_campaigns ORDER BY created_at DESC"));
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Create campaign ===
    router.post('/admin/campaigns', requireAuth, (req, res) => {
        try {
            const { name, subject, description } = req.body;
            if (!name) return res.status(400).json({ error: 'Name is required' });

            dbHelpers.run(
                "INSERT INTO newsletter_campaigns (name, subject, description) VALUES (?, ?, ?)",
                [name, subject || '', description || '']
            );
            res.status(201).json({ message: 'Campaign created' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Update campaign ===
    router.put('/admin/campaigns/:id', requireAuth, (req, res) => {
        try {
            const { name, subject, description } = req.body;
            dbHelpers.run(
                "UPDATE newsletter_campaigns SET name=?, subject=?, description=? WHERE id=?",
                [name, subject, description, req.params.id]
            );
            res.json({ message: 'Campaign updated' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Mark campaign as sent ===
    router.patch('/admin/campaigns/:id/send', requireAuth, (req, res) => {
        try {
            const count = dbHelpers.get("SELECT COUNT(*) as count FROM newsletter_subscribers WHERE status = 'active'");

            dbHelpers.run(
                "UPDATE newsletter_campaigns SET status = 'sent', sent_at = CURRENT_TIMESTAMP, recipient_count = ? WHERE id = ?",
                [count?.count || 0, req.params.id]
            );
            res.json({ message: 'Campaign marked as sent', recipients: count?.count || 0 });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Delete campaign ===
    router.delete('/admin/campaigns/:id', requireAuth, (req, res) => {
        try {
            dbHelpers.run("DELETE FROM newsletter_campaigns WHERE id = ?", [req.params.id]);
            res.json({ message: 'Campaign deleted' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Stats ===
    router.get('/admin/stats', requireAuth, (req, res) => {
        try {
            const active = dbHelpers.get("SELECT COUNT(*) as count FROM newsletter_subscribers WHERE status = 'active'");
            const unsubscribed = dbHelpers.get("SELECT COUNT(*) as count FROM newsletter_subscribers WHERE status = 'unsubscribed'");
            const thisMonth = dbHelpers.get(
                "SELECT COUNT(*) as count FROM newsletter_subscribers WHERE status = 'active' AND subscribed_at >= date('now', 'start of month')"
            );

            res.json({
                active: active?.count || 0,
                unsubscribed: unsubscribed?.count || 0,
                new_this_month: thisMonth?.count || 0
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
};
