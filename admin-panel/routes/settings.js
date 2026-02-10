const express = require('express');
const https = require('https');

module.exports = function(db, requireAuth, requireAdmin) {
    const router = express.Router();

    // Get settings for a site (admin only)
    router.get('/:site', requireAdmin, (req, res) => {
        const { site } = req.params;

        const settings = {};
        const rows = db.all('SELECT key, value FROM settings WHERE key LIKE ?', [site + '_%']);

        rows.forEach(row => {
            const key = row.key.replace(site + '_', '');
            settings[key] = row.value;
        });

        res.json(settings);
    });

    // Update settings (admin only)
    router.put('/:site', requireAdmin, (req, res) => {
        const { site } = req.params;
        const updates = req.body;

        Object.entries(updates).forEach(([key, value]) => {
            const fullKey = site + '_' + key;
            const existing = db.get('SELECT key FROM settings WHERE key = ?', [fullKey]);

            if (existing) {
                db.run('UPDATE settings SET value = ? WHERE key = ?', [value, fullKey]);
            } else {
                db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [fullKey, value]);
            }
        });

        res.json({ success: true });
    });

    // Test Telegram connection (admin only)
    router.post('/:site/test-telegram', requireAdmin, (req, res) => {
        const { site } = req.params;

        const botToken = db.get('SELECT value FROM settings WHERE key = ?', [site + '_telegram_bot_token']);
        const chatId = db.get('SELECT value FROM settings WHERE key = ?', [site + '_telegram_chat_id']);

        if (!botToken?.value || !chatId?.value) {
            return res.status(400).json({ success: false, error: 'Telegram settings not configured' });
        }

        const message = encodeURIComponent('Test message from Admin Panel');
        const url = `https://api.telegram.org/bot${botToken.value}/sendMessage?chat_id=${chatId.value}&text=${message}`;

        https.get(url, (response) => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.ok) {
                        res.json({ success: true, message: 'Test message sent successfully' });
                    } else {
                        res.json({ success: false, error: result.description || 'Failed to send message' });
                    }
                } catch (e) {
                    res.json({ success: false, error: 'Invalid response from Telegram' });
                }
            });
        }).on('error', (err) => {
            res.json({ success: false, error: err.message });
        });
    });

    // Public endpoint to send message to Telegram (for website)
    router.post('/:site/send-telegram', (req, res) => {
        const { site } = req.params;
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ success: false, error: 'Message is required' });
        }

        const botToken = db.get('SELECT value FROM settings WHERE key = ?', [site + '_telegram_bot_token']);
        const chatId = db.get('SELECT value FROM settings WHERE key = ?', [site + '_telegram_chat_id']);

        if (!botToken?.value || !chatId?.value) {
            return res.status(400).json({ success: false, error: 'Telegram not configured' });
        }

        const encodedMessage = encodeURIComponent(message);
        const url = `https://api.telegram.org/bot${botToken.value}/sendMessage?chat_id=${chatId.value}&text=${encodedMessage}&parse_mode=HTML`;

        https.get(url, (response) => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    if (result.ok) {
                        res.json({ success: true });
                    } else {
                        res.json({ success: false, error: result.description });
                    }
                } catch (e) {
                    res.json({ success: false, error: 'Invalid response' });
                }
            });
        }).on('error', (err) => {
            res.json({ success: false, error: err.message });
        });
    });

    return router;
};
