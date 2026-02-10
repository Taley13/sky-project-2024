const express = require('express');
const bcrypt = require('bcryptjs');

module.exports = function(db, requireAdmin) {
    const router = express.Router();

    // Get all users (admin only)
    router.get('/', requireAdmin, (req, res) => {
        const users = db.all('SELECT id, username, role, created_at FROM users ORDER BY id');
        res.json(users);
    });

    // Get single user (admin only)
    router.get('/:id', requireAdmin, (req, res) => {
        const { id } = req.params;
        const user = db.get('SELECT id, username, role, created_at FROM users WHERE id = ?', [id]);

        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        res.json(user);
    });

    // Create user (admin only)
    router.post('/', requireAdmin, (req, res) => {
        const { username, password, role } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Логин и пароль обязательны' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Пароль должен быть минимум 6 символов' });
        }

        // Check if username exists
        const existing = db.get('SELECT id FROM users WHERE username = ?', [username]);
        if (existing) {
            return res.status(400).json({ error: 'Пользователь с таким логином уже существует' });
        }

        // Validate role
        const validRoles = ['admin', 'accountant'];
        const userRole = validRoles.includes(role) ? role : 'accountant';

        const hashedPassword = bcrypt.hashSync(password, 10);
        db.run(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            [username, hashedPassword, userRole]
        );

        const newUser = db.get('SELECT id, username, role, created_at FROM users ORDER BY id DESC LIMIT 1');
        res.json({ success: true, data: newUser });
    });

    // Update user (admin only)
    router.put('/:id', requireAdmin, (req, res) => {
        const { id } = req.params;
        const { role } = req.body;

        const user = db.get('SELECT * FROM users WHERE id = ?', [id]);
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        // Prevent changing own role
        if (parseInt(id) === req.session.userId && role !== user.role) {
            return res.status(400).json({ error: 'Нельзя изменить свою роль' });
        }

        // Validate role
        const validRoles = ['admin', 'accountant'];
        if (role && !validRoles.includes(role)) {
            return res.status(400).json({ error: 'Неверная роль' });
        }

        if (role) {
            db.run('UPDATE users SET role = ? WHERE id = ?', [role, id]);
        }

        const updated = db.get('SELECT id, username, role, created_at FROM users WHERE id = ?', [id]);
        res.json({ success: true, data: updated });
    });

    // Change user password (admin only)
    router.post('/:id/password', requireAdmin, (req, res) => {
        const { id } = req.params;
        const { password } = req.body;

        if (!password || password.length < 6) {
            return res.status(400).json({ error: 'Пароль должен быть минимум 6 символов' });
        }

        const user = db.get('SELECT id FROM users WHERE id = ?', [id]);
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        const hashedPassword = bcrypt.hashSync(password, 10);
        db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, id]);

        res.json({ success: true, message: 'Пароль изменён' });
    });

    // Delete user (admin only)
    router.delete('/:id', requireAdmin, (req, res) => {
        const { id } = req.params;

        // Prevent deleting self
        if (parseInt(id) === req.session.userId) {
            return res.status(400).json({ error: 'Нельзя удалить свой аккаунт' });
        }

        const user = db.get('SELECT id FROM users WHERE id = ?', [id]);
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        db.run('DELETE FROM users WHERE id = ?', [id]);
        res.json({ success: true });
    });

    return router;
};
