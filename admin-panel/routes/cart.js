/**
 * Sky Template - Cart & Checkout Example Module
 * Shopping cart with session-based items and checkout flow
 *
 * Tables created: cart_items, checkout_orders, checkout_order_items
 *
 * Usage: Copy to ../cart.js and add to server.js:
 *   const cartRoutes = require('./routes/cart');
 *   app.use('/api/cart', cartRoutes(dbHelpers, requireAuth));
 */

const express = require('express');

module.exports = function(dbHelpers, requireAuth) {
    const router = express.Router();

    // === Initialize Tables ===
    (function initTables() {
        try {
            dbHelpers.run(`CREATE TABLE IF NOT EXISTS cart_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                product_id INTEGER NOT NULL,
                product_name TEXT NOT NULL,
                product_price REAL NOT NULL,
                quantity INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            dbHelpers.run(`CREATE TABLE IF NOT EXISTS checkout_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_number TEXT UNIQUE NOT NULL,
                client_name TEXT NOT NULL,
                client_email TEXT,
                client_phone TEXT NOT NULL,
                client_address TEXT,
                notes TEXT,
                total REAL NOT NULL,
                status TEXT DEFAULT 'new',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            dbHelpers.run(`CREATE TABLE IF NOT EXISTS checkout_order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                product_id INTEGER,
                product_name TEXT NOT NULL,
                product_price REAL NOT NULL,
                quantity INTEGER NOT NULL,
                subtotal REAL NOT NULL,
                FOREIGN KEY (order_id) REFERENCES checkout_orders(id) ON DELETE CASCADE
            )`);
        } catch (e) {}
    })();

    // Helper: generate order number
    function generateOrderNumber() {
        const ts = Math.floor(Date.now() / 1000);
        const rand = Math.floor(1000 + Math.random() * 9000);
        return `ORD-${ts}-${rand}`;
    }

    // === PUBLIC: Get cart items ===
    router.get('/cart', (req, res) => {
        try {
            const sessionId = req.sessionID;
            const items = dbHelpers.all(
                "SELECT * FROM cart_items WHERE session_id = ? ORDER BY created_at",
                [sessionId]
            );

            let total = 0;
            items.forEach(item => {
                item.subtotal = item.product_price * item.quantity;
                total += item.subtotal;
            });

            res.json({ items, total, count: items.length });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === PUBLIC: Add to cart ===
    router.post('/cart', (req, res) => {
        try {
            const { product_id, product_name, product_price, quantity } = req.body;
            const sessionId = req.sessionID;

            if (!product_id || !product_name || product_price === undefined) {
                return res.status(400).json({ error: 'Required: product_id, product_name, product_price' });
            }

            // Check if item already in cart
            const existing = dbHelpers.get(
                "SELECT * FROM cart_items WHERE session_id = ? AND product_id = ?",
                [sessionId, product_id]
            );

            if (existing) {
                dbHelpers.run(
                    "UPDATE cart_items SET quantity = quantity + ? WHERE id = ?",
                    [quantity || 1, existing.id]
                );
            } else {
                dbHelpers.run(
                    "INSERT INTO cart_items (session_id, product_id, product_name, product_price, quantity) VALUES (?, ?, ?, ?, ?)",
                    [sessionId, product_id, product_name, parseFloat(product_price), quantity || 1]
                );
            }

            // Return updated cart count
            const count = dbHelpers.get(
                "SELECT COUNT(*) as count FROM cart_items WHERE session_id = ?", [sessionId]
            );

            res.status(201).json({ message: 'Added to cart', count: count?.count || 0 });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === PUBLIC: Update item quantity ===
    router.put('/cart/:id', (req, res) => {
        try {
            const { quantity } = req.body;
            const sessionId = req.sessionID;

            if (!quantity || quantity < 1) {
                return res.status(400).json({ error: 'Quantity must be at least 1' });
            }

            dbHelpers.run(
                "UPDATE cart_items SET quantity = ? WHERE id = ? AND session_id = ?",
                [quantity, req.params.id, sessionId]
            );
            res.json({ message: 'Cart updated' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === PUBLIC: Remove item from cart ===
    router.delete('/cart/:id', (req, res) => {
        try {
            const sessionId = req.sessionID;
            dbHelpers.run(
                "DELETE FROM cart_items WHERE id = ? AND session_id = ?",
                [req.params.id, sessionId]
            );
            res.json({ message: 'Item removed' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === PUBLIC: Clear entire cart ===
    router.delete('/cart', (req, res) => {
        try {
            dbHelpers.run("DELETE FROM cart_items WHERE session_id = ?", [req.sessionID]);
            res.json({ message: 'Cart cleared' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === PUBLIC: Checkout ===
    router.post('/checkout', (req, res) => {
        try {
            const { client_name, client_phone, client_email, client_address, notes } = req.body;
            const sessionId = req.sessionID;

            if (!client_name || !client_phone) {
                return res.status(400).json({ error: 'Required: client_name, client_phone' });
            }

            // Get cart items
            const items = dbHelpers.all(
                "SELECT * FROM cart_items WHERE session_id = ?", [sessionId]
            );

            if (items.length === 0) {
                return res.status(400).json({ error: 'Cart is empty' });
            }

            // Calculate total
            let total = 0;
            items.forEach(item => { total += item.product_price * item.quantity; });

            // Create order
            const orderNumber = generateOrderNumber();
            dbHelpers.run(
                `INSERT INTO checkout_orders (order_number, client_name, client_email, client_phone, client_address, notes, total)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [orderNumber, client_name, client_email || null, client_phone, client_address || null, notes || null, total]
            );

            const order = dbHelpers.get("SELECT id FROM checkout_orders WHERE order_number = ?", [orderNumber]);

            // Create order items
            items.forEach(item => {
                dbHelpers.run(
                    "INSERT INTO checkout_order_items (order_id, product_id, product_name, product_price, quantity, subtotal) VALUES (?, ?, ?, ?, ?, ?)",
                    [order.id, item.product_id, item.product_name, item.product_price, item.quantity, item.product_price * item.quantity]
                );
            });

            // Clear cart
            dbHelpers.run("DELETE FROM cart_items WHERE session_id = ?", [sessionId]);

            res.status(201).json({
                message: 'Order created',
                order_number: orderNumber,
                total
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === PUBLIC: Track order by number ===
    router.get('/order/:orderNumber', (req, res) => {
        try {
            const order = dbHelpers.get(
                "SELECT order_number, status, total, created_at FROM checkout_orders WHERE order_number = ?",
                [req.params.orderNumber]
            );

            if (!order) return res.status(404).json({ error: 'Order not found' });
            res.json(order);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Get all orders ===
    router.get('/admin/orders', requireAuth, (req, res) => {
        try {
            const { status } = req.query;
            let sql = "SELECT * FROM checkout_orders WHERE 1=1";
            const params = [];

            if (status) { sql += " AND status = ?"; params.push(status); }
            sql += " ORDER BY created_at DESC";

            res.json(dbHelpers.all(sql, params));
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Get order details ===
    router.get('/admin/orders/:id', requireAuth, (req, res) => {
        try {
            const order = dbHelpers.get("SELECT * FROM checkout_orders WHERE id = ?", [req.params.id]);
            if (!order) return res.status(404).json({ error: 'Order not found' });

            order.items = dbHelpers.all(
                "SELECT * FROM checkout_order_items WHERE order_id = ?", [order.id]
            );

            res.json(order);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Update order status ===
    router.patch('/admin/orders/:id/status', requireAuth, (req, res) => {
        try {
            const { status } = req.body;
            const validStatuses = ['new', 'processing', 'shipped', 'completed', 'cancelled'];

            if (!validStatuses.includes(status)) {
                return res.status(400).json({ error: `Status must be: ${validStatuses.join(', ')}` });
            }

            dbHelpers.run("UPDATE checkout_orders SET status = ? WHERE id = ?", [status, req.params.id]);
            res.json({ message: 'Order status updated' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Delete order ===
    router.delete('/admin/orders/:id', requireAuth, (req, res) => {
        try {
            dbHelpers.run("DELETE FROM checkout_order_items WHERE order_id = ?", [req.params.id]);
            dbHelpers.run("DELETE FROM checkout_orders WHERE id = ?", [req.params.id]);
            res.json({ message: 'Order deleted' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Order stats ===
    router.get('/admin/stats', requireAuth, (req, res) => {
        try {
            const total = dbHelpers.get("SELECT COUNT(*) as count FROM checkout_orders");
            const revenue = dbHelpers.get("SELECT COALESCE(SUM(total), 0) as sum FROM checkout_orders WHERE status != 'cancelled'");

            const byStatus = {};
            ['new', 'processing', 'shipped', 'completed', 'cancelled'].forEach(s => {
                const row = dbHelpers.get("SELECT COUNT(*) as count FROM checkout_orders WHERE status = ?", [s]);
                byStatus[s] = row?.count || 0;
            });

            const thisMonth = dbHelpers.get(
                "SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as revenue FROM checkout_orders WHERE created_at >= date('now', 'start of month') AND status != 'cancelled'"
            );

            res.json({
                total_orders: total?.count || 0,
                total_revenue: revenue?.sum || 0,
                by_status: byStatus,
                this_month: {
                    orders: thisMonth?.count || 0,
                    revenue: thisMonth?.revenue || 0
                }
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
};
