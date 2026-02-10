const express = require('express');

module.exports = function(db, requireAuth, requireAdmin) {
    const router = express.Router();

    // Get contacts for a site (admin only)
    router.get('/:site', requireAdmin, (req, res) => {
        const { site } = req.params;
        const contact = db.get('SELECT * FROM contacts WHERE site = ?', [site]);

        if (!contact) {
            return res.status(404).json({ error: 'Contacts not found' });
        }

        res.json(contact);
    });

    // Update contacts for a site (admin only)
    router.put('/:site', requireAdmin, (req, res) => {
        const { site } = req.params;
        const { phone, email, address, address_line2, nip, telegram, contact_person } = req.body;

        // Validate required fields
        if (!phone || !email) {
            return res.status(400).json({ error: 'Phone and email are required' });
        }

        // Check if contact exists
        const existing = db.get('SELECT id FROM contacts WHERE site = ?', [site]);

        if (existing) {
            // Update
            db.run(`UPDATE contacts SET
                phone = ?,
                email = ?,
                address = ?,
                address_line2 = ?,
                nip = ?,
                telegram = ?,
                contact_person = ?,
                updated_at = CURRENT_TIMESTAMP
                WHERE site = ?`,
                [phone, email, address, address_line2, nip, telegram, contact_person, site]
            );
        } else {
            // Insert
            db.run(`INSERT INTO contacts (site, phone, email, address, address_line2, nip, telegram, contact_person)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [site, phone, email, address, address_line2, nip, telegram, contact_person]
            );
        }

        const updated = db.get('SELECT * FROM contacts WHERE site = ?', [site]);
        res.json({ success: true, message: 'Contacts updated', data: updated });
    });

    // Get all contacts (admin only)
    router.get('/', requireAdmin, (req, res) => {
        const contacts = db.all('SELECT * FROM contacts ORDER BY site');
        res.json(contacts);
    });

    return router;
};
