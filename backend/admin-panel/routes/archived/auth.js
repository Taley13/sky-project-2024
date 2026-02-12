const express = require('express');
const bcrypt = require('bcryptjs');

module.exports = function(db) {
    const router = express.Router();

    // Login
    router.post('/login', (req, res) => {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Введите логин и пароль' });
        }

        const user = db.get('SELECT * FROM users WHERE username = ?', [username]);

        if (!user) {
            return res.status(401).json({ error: 'Неверный логин или пароль' });
        }

        const validPassword = bcrypt.compareSync(password, user.password);

        if (!validPassword) {
            return res.status(401).json({ error: 'Неверный логин или пароль' });
        }

        // Security: Regenerate session ID to prevent session fixation attacks
        req.session.regenerate((err) => {
            if (err) {
                console.error('Session regeneration error:', err);
                return res.status(500).json({ error: 'Ошибка авторизации' });
            }

            // Save user info in session including role
            req.session.userId = user.id;
            req.session.username = user.username;
            req.session.role = user.role || 'admin';

            // Redirect based on role
            const redirect = user.role === 'accountant' ? '/admin/dashboard#products' : '/admin/dashboard';

            // Explicitly save session before responding
            req.session.save((saveErr) => {
                if (saveErr) {
                    console.error('Session save error:', saveErr);
                    return res.status(500).json({ error: 'Ошибка авторизации' });
                }

                res.json({
                    success: true,
                    message: 'Авторизация успешна',
                    redirect: redirect,
                    role: user.role || 'admin'
                });
            });
        });
    });

    // Get current user info
    router.get('/me', (req, res) => {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Не авторизован' });
        }

        res.json({
            id: req.session.userId,
            username: req.session.username,
            role: req.session.role || 'admin'
        });
    });

    // Logout
    router.post('/logout', (req, res) => {
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ error: 'Ошибка выхода' });
            }
            res.json({ success: true, redirect: '/admin/' });
        });
    });

    // Change password
    router.post('/change-password', (req, res) => {
        if (!req.session || !req.session.userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Заполните все поля' });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Пароль должен быть минимум 6 символов' });
        }

        const user = db.get('SELECT * FROM users WHERE id = ?', [req.session.userId]);

        if (!bcrypt.compareSync(currentPassword, user.password)) {
            return res.status(401).json({ error: 'Неверный текущий пароль' });
        }

        const hashedPassword = bcrypt.hashSync(newPassword, 10);
        db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.session.userId]);

        res.json({ success: true, message: 'Пароль успешно изменён' });
    });

    return router;
};
