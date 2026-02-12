/**
 * Sky Template - Booking Example Module
 * Time slot booking API for service-based businesses
 *
 * Tables created: bookings, services, time_slots
 *
 * Usage: Copy to ../booking.js and add to server.js:
 *   const bookingRoutes = require('./routes/booking');
 *   app.use('/api/bookings', bookingRoutes(dbHelpers, requireAuth));
 */

const express = require('express');

module.exports = function(dbHelpers, requireAuth) {
    const router = express.Router();

    // === Initialize Tables ===
    (function initTables() {
        try {
            dbHelpers.run(`CREATE TABLE IF NOT EXISTS services (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                duration_minutes INTEGER DEFAULT 60,
                price REAL DEFAULT 0,
                active INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            dbHelpers.run(`CREATE TABLE IF NOT EXISTS time_slots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                service_id INTEGER,
                day_of_week INTEGER,
                start_time TEXT,
                end_time TEXT,
                max_bookings INTEGER DEFAULT 1,
                FOREIGN KEY (service_id) REFERENCES services(id)
            )`);

            dbHelpers.run(`CREATE TABLE IF NOT EXISTS bookings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                service_id INTEGER NOT NULL,
                datetime TEXT NOT NULL,
                client_name TEXT NOT NULL,
                client_phone TEXT NOT NULL,
                client_email TEXT,
                status TEXT DEFAULT 'pending',
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (service_id) REFERENCES services(id)
            )`);
        } catch (e) {}
    })();

    // === PUBLIC: Get available services ===
    router.get('/services', (req, res) => {
        try {
            const services = dbHelpers.all(
                "SELECT * FROM services WHERE active = 1 ORDER BY name"
            );
            res.json(services);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === PUBLIC: Check availability for a date ===
    router.get('/availability/:serviceId/:date', (req, res) => {
        try {
            const { serviceId, date } = req.params;

            // Get all bookings for this service on this date
            const booked = dbHelpers.all(
                "SELECT datetime FROM bookings WHERE service_id = ? AND datetime LIKE ? AND status != 'cancelled'",
                [serviceId, `${date}%`]
            );

            const bookedTimes = booked.map(b => b.datetime);

            // Get service info
            const service = dbHelpers.get("SELECT * FROM services WHERE id = ?", [serviceId]);

            // Generate available time slots (9:00 - 18:00, based on duration)
            const slots = [];
            const duration = service?.duration_minutes || 60;

            for (let hour = 9; hour < 18; hour++) {
                for (let min = 0; min < 60; min += duration) {
                    if (hour + (min + duration) / 60 > 18) break;

                    const timeStr = `${date}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
                    slots.push({
                        datetime: timeStr,
                        available: !bookedTimes.includes(timeStr)
                    });
                }
            }

            res.json({ date, service_id: serviceId, slots });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === PUBLIC: Create a booking ===
    router.post('/', (req, res) => {
        try {
            const { service_id, datetime, client_name, client_phone, client_email, notes } = req.body;

            if (!service_id || !datetime || !client_name || !client_phone) {
                return res.status(400).json({ error: 'Required: service_id, datetime, client_name, client_phone' });
            }

            // Check if slot is available
            const existing = dbHelpers.get(
                "SELECT id FROM bookings WHERE service_id = ? AND datetime = ? AND status != 'cancelled'",
                [service_id, datetime]
            );

            if (existing) {
                return res.status(409).json({ error: 'Time slot already booked' });
            }

            dbHelpers.run(
                `INSERT INTO bookings (service_id, datetime, client_name, client_phone, client_email, notes)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [service_id, datetime, client_name, client_phone, client_email || null, notes || null]
            );

            res.status(201).json({ message: 'Booking created', status: 'pending' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Get all bookings ===
    router.get('/', requireAuth, (req, res) => {
        try {
            const { status, date, service_id } = req.query;
            let sql = `SELECT b.*, s.name as service_name
                        FROM bookings b
                        LEFT JOIN services s ON b.service_id = s.id
                        WHERE 1=1`;
            const params = [];

            if (status) { sql += " AND b.status = ?"; params.push(status); }
            if (date) { sql += " AND b.datetime LIKE ?"; params.push(`${date}%`); }
            if (service_id) { sql += " AND b.service_id = ?"; params.push(service_id); }

            sql += " ORDER BY b.datetime DESC";

            res.json(dbHelpers.all(sql, params));
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Update booking status ===
    router.patch('/:id/status', requireAuth, (req, res) => {
        try {
            const { status } = req.body;
            const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];

            if (!validStatuses.includes(status)) {
                return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
            }

            dbHelpers.run("UPDATE bookings SET status = ? WHERE id = ?", [status, req.params.id]);
            res.json({ message: 'Status updated' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: CRUD services ===
    router.post('/services', requireAuth, (req, res) => {
        try {
            const { name, description, duration_minutes, price } = req.body;
            if (!name) return res.status(400).json({ error: 'Name is required' });

            dbHelpers.run(
                "INSERT INTO services (name, description, duration_minutes, price) VALUES (?, ?, ?, ?)",
                [name, description || '', duration_minutes || 60, price || 0]
            );
            res.status(201).json({ message: 'Service created' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.put('/services/:id', requireAuth, (req, res) => {
        try {
            const { name, description, duration_minutes, price, active } = req.body;
            dbHelpers.run(
                "UPDATE services SET name=?, description=?, duration_minutes=?, price=?, active=? WHERE id=?",
                [name, description, duration_minutes, price, active ?? 1, req.params.id]
            );
            res.json({ message: 'Service updated' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.delete('/services/:id', requireAuth, (req, res) => {
        try {
            dbHelpers.run("DELETE FROM services WHERE id = ?", [req.params.id]);
            res.json({ message: 'Service deleted' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
};
