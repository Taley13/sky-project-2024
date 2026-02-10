/**
 * Sky Template - Subscription Example Module
 * Subscription plans and user subscriptions management
 *
 * Tables created: subscription_plans, subscriptions
 *
 * Usage: Copy to ../subscription.js and add to server.js:
 *   const subscriptionRoutes = require('./routes/subscription');
 *   app.use('/api/subscriptions', subscriptionRoutes(dbHelpers, requireAuth));
 */

const express = require('express');

module.exports = function(dbHelpers, requireAuth) {
    const router = express.Router();

    // === Initialize Tables ===
    (function initTables() {
        try {
            dbHelpers.run(`CREATE TABLE IF NOT EXISTS subscription_plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                price REAL NOT NULL,
                currency TEXT DEFAULT 'PLN',
                interval TEXT DEFAULT 'month',
                interval_count INTEGER DEFAULT 1,
                features TEXT,
                active INTEGER DEFAULT 1,
                sort_order INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            dbHelpers.run(`CREATE TABLE IF NOT EXISTS subscriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                plan_id INTEGER NOT NULL,
                client_name TEXT NOT NULL,
                client_email TEXT NOT NULL,
                client_phone TEXT,
                status TEXT DEFAULT 'active',
                start_date TEXT NOT NULL,
                next_billing_date TEXT,
                cancelled_at TEXT,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
            )`);

            dbHelpers.run(`CREATE TABLE IF NOT EXISTS subscription_payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                subscription_id INTEGER NOT NULL,
                amount REAL NOT NULL,
                currency TEXT DEFAULT 'PLN',
                status TEXT DEFAULT 'pending',
                payment_date TEXT,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
            )`);
        } catch (e) {}
    })();

    // === PUBLIC: Get active plans ===
    router.get('/plans', (req, res) => {
        try {
            const plans = dbHelpers.all(
                "SELECT * FROM subscription_plans WHERE active = 1 ORDER BY sort_order, price"
            );
            // Parse features JSON
            plans.forEach(p => {
                try { p.features = JSON.parse(p.features || '[]'); } catch { p.features = []; }
            });
            res.json(plans);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === PUBLIC: Subscribe to a plan ===
    router.post('/subscribe', (req, res) => {
        try {
            const { plan_id, client_name, client_email, client_phone } = req.body;

            if (!plan_id || !client_name || !client_email) {
                return res.status(400).json({ error: 'Required: plan_id, client_name, client_email' });
            }

            const plan = dbHelpers.get("SELECT * FROM subscription_plans WHERE id = ? AND active = 1", [plan_id]);
            if (!plan) return res.status(404).json({ error: 'Plan not found' });

            // Calculate next billing date
            const startDate = new Date().toISOString().split('T')[0];
            const nextBilling = new Date();

            switch (plan.interval) {
                case 'week': nextBilling.setDate(nextBilling.getDate() + 7 * plan.interval_count); break;
                case 'month': nextBilling.setMonth(nextBilling.getMonth() + plan.interval_count); break;
                case 'year': nextBilling.setFullYear(nextBilling.getFullYear() + plan.interval_count); break;
            }

            const nextBillingDate = nextBilling.toISOString().split('T')[0];

            dbHelpers.run(
                `INSERT INTO subscriptions (plan_id, client_name, client_email, client_phone, start_date, next_billing_date)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [plan_id, client_name, client_email, client_phone || null, startDate, nextBillingDate]
            );

            res.status(201).json({
                message: 'Subscription created',
                plan: plan.name,
                next_billing: nextBillingDate
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Get all subscriptions ===
    router.get('/', requireAuth, (req, res) => {
        try {
            const { status } = req.query;
            let sql = `SELECT s.*, p.name as plan_name, p.price as plan_price, p.interval as plan_interval
                        FROM subscriptions s
                        LEFT JOIN subscription_plans p ON s.plan_id = p.id
                        WHERE 1=1`;
            const params = [];

            if (status) { sql += " AND s.status = ?"; params.push(status); }
            sql += " ORDER BY s.created_at DESC";

            const subs = dbHelpers.all(sql, params);

            // Add payment history
            subs.forEach(sub => {
                sub.payments = dbHelpers.all(
                    "SELECT * FROM subscription_payments WHERE subscription_id = ? ORDER BY created_at DESC",
                    [sub.id]
                );
            });

            res.json(subs);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Get subscription stats ===
    router.get('/stats', requireAuth, (req, res) => {
        try {
            const active = dbHelpers.get("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active'");
            const cancelled = dbHelpers.get("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'cancelled'");
            const paused = dbHelpers.get("SELECT COUNT(*) as count FROM subscriptions WHERE status = 'paused'");

            const mrr = dbHelpers.get(`
                SELECT COALESCE(SUM(p.price), 0) as total
                FROM subscriptions s
                JOIN subscription_plans p ON s.plan_id = p.id
                WHERE s.status = 'active'
            `);

            const dueSoon = dbHelpers.all(`
                SELECT s.*, p.name as plan_name, p.price as plan_price
                FROM subscriptions s
                JOIN subscription_plans p ON s.plan_id = p.id
                WHERE s.status = 'active'
                AND s.next_billing_date <= date('now', '+7 days')
                ORDER BY s.next_billing_date
            `);

            res.json({
                active_count: active?.count || 0,
                cancelled_count: cancelled?.count || 0,
                paused_count: paused?.count || 0,
                monthly_revenue: mrr?.total || 0,
                due_soon: dueSoon
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Update subscription status ===
    router.patch('/:id/status', requireAuth, (req, res) => {
        try {
            const { status } = req.body;
            const validStatuses = ['active', 'paused', 'cancelled', 'expired'];

            if (!validStatuses.includes(status)) {
                return res.status(400).json({ error: `Status must be: ${validStatuses.join(', ')}` });
            }

            const updates = { status };
            if (status === 'cancelled') updates.cancelled_at = new Date().toISOString();

            dbHelpers.run(
                `UPDATE subscriptions SET status = ?${status === 'cancelled' ? ', cancelled_at = CURRENT_TIMESTAMP' : ''} WHERE id = ?`,
                [status, req.params.id]
            );

            res.json({ message: 'Subscription updated' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Record payment ===
    router.post('/:id/payments', requireAuth, (req, res) => {
        try {
            const { amount, status, notes } = req.body;
            const sub = dbHelpers.get("SELECT * FROM subscriptions WHERE id = ?", [req.params.id]);
            if (!sub) return res.status(404).json({ error: 'Subscription not found' });

            dbHelpers.run(
                "INSERT INTO subscription_payments (subscription_id, amount, status, payment_date, notes) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)",
                [req.params.id, amount || 0, status || 'completed', notes || null]
            );

            // Update next billing date if payment completed
            if (status === 'completed' || !status) {
                const plan = dbHelpers.get("SELECT * FROM subscription_plans WHERE id = ?", [sub.plan_id]);
                if (plan) {
                    const next = new Date(sub.next_billing_date);
                    switch (plan.interval) {
                        case 'week': next.setDate(next.getDate() + 7 * plan.interval_count); break;
                        case 'month': next.setMonth(next.getMonth() + plan.interval_count); break;
                        case 'year': next.setFullYear(next.getFullYear() + plan.interval_count); break;
                    }
                    dbHelpers.run("UPDATE subscriptions SET next_billing_date = ? WHERE id = ?",
                        [next.toISOString().split('T')[0], req.params.id]);
                }
            }

            res.status(201).json({ message: 'Payment recorded' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: CRUD plans ===
    router.get('/admin/plans', requireAuth, (req, res) => {
        try {
            const plans = dbHelpers.all("SELECT * FROM subscription_plans ORDER BY sort_order, price");
            plans.forEach(p => { try { p.features = JSON.parse(p.features || '[]'); } catch { p.features = []; } });
            res.json(plans);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/admin/plans', requireAuth, (req, res) => {
        try {
            const { name, description, price, currency, interval, interval_count, features } = req.body;
            if (!name || price === undefined) return res.status(400).json({ error: 'Name and price required' });

            dbHelpers.run(
                `INSERT INTO subscription_plans (name, description, price, currency, interval, interval_count, features)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [name, description || '', price, currency || 'PLN', interval || 'month', interval_count || 1, JSON.stringify(features || [])]
            );

            res.status(201).json({ message: 'Plan created' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.put('/admin/plans/:id', requireAuth, (req, res) => {
        try {
            const { name, description, price, currency, interval, interval_count, features, active } = req.body;
            dbHelpers.run(
                `UPDATE subscription_plans SET name=?, description=?, price=?, currency=?, interval=?, interval_count=?, features=?, active=? WHERE id=?`,
                [name, description, price, currency, interval, interval_count, JSON.stringify(features || []), active ?? 1, req.params.id]
            );
            res.json({ message: 'Plan updated' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.delete('/admin/plans/:id', requireAuth, (req, res) => {
        try {
            dbHelpers.run("DELETE FROM subscription_plans WHERE id = ?", [req.params.id]);
            res.json({ message: 'Plan deleted' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
};
