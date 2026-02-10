const express = require('express');
const router = express.Router();

// Rate limiting - простая реализация в памяти
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 минута
const RATE_LIMIT_MAX = 3; // максимум 3 запроса в минуту (защита от спама)

function checkRateLimit(ip) {
    const now = Date.now();
    const record = rateLimitMap.get(ip);

    if (!record) {
        rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return true;
    }

    if (now > record.resetTime) {
        rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return true;
    }

    if (record.count >= RATE_LIMIT_MAX) {
        return false;
    }

    record.count++;
    return true;
}

// Очистка старых записей каждые 5 минут
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of rateLimitMap.entries()) {
        if (now > record.resetTime) {
            rateLimitMap.delete(ip);
        }
    }
}, 5 * 60 * 1000);

// Функция экранирования HTML для Telegram
function escapeHtml(text) {
    if (!text) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Helper function to send to multiple chats
async function sendToTelegramChats(botToken, message, chatIds) {
    const fetch = (await import("node-fetch")).default;
    const results = [];
    for (const chatId of chatIds) {
        try {
            const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" })
            });
            const result = await response.json();
            results.push({ chatId, success: result.ok });
        } catch (error) {
            console.error(`Failed to send to ${chatId}:`, error);
            results.push({ chatId, success: false });
        }
    }
    return results;
}

// Валидация телефона
function validatePhone(phone) {
    if (!phone) return false;
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 9;
}

// Валидация имени
function validateName(name) {
    return name && name.trim().length >= 2;
}

// Проверка API ключа
function checkApiKey(req) {
    const apiKey = req.headers['x-api-key'] || req.body.apiKey;
    const validKey = process.env.WEBSITE_API_KEY;

    if (!validKey) {
        // Если ключ не настроен в .env - пропускаем проверку (для обратной совместимости)
        return true;
    }

    return apiKey === validKey;
}

module.exports = function(dbHelpers) {

    // Получаем настройки Telegram из базы данных
    async function getTelegramSettings(site = 'mattress') {
        const settings = dbHelpers.get(
            "SELECT value FROM settings WHERE key = ?",
            [`telegram_${site}`]
        );

        if (settings && settings.value) {
            try {
                return JSON.parse(settings.value);
            } catch (e) {
                console.error('Failed to parse Telegram settings:', e);
            }
        }

        // Fallback на переменные окружения
        return {
            botToken: process.env.TELEGRAM_BOT_TOKEN,
            chatId: process.env.TELEGRAM_CHAT_ID
        };
    }

    // POST /api/telegram/order - отправка заказа
    router.post('/order', async (req, res) => {
        try {
            // Проверка API ключа
            if (!checkApiKey(req)) {
                return res.status(403).json({
                    success: false,
                    error: 'Invalid API key'
                });
            }

            // Rate limiting
            const clientIp = req.ip || req.connection.remoteAddress;
            if (!checkRateLimit(clientIp)) {
                return res.status(429).json({
                    success: false,
                    error: 'Too many requests. Please try again later.'
                });
            }

            const {
                name,
                phone,
                email,
                address,
                product,
                productId,
                price,
                size,
                quantity,
                site = 'mattress',
                items // для корзины - массив товаров
            } = req.body;

            // Валидация
            if (!validateName(name)) {
                return res.status(400).json({
                    success: false,
                    error: 'Name must be at least 2 characters'
                });
            }

            if (!validatePhone(phone)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid phone number (minimum 9 digits)'
                });
            }

            // Получаем настройки Telegram
            const telegramSettings = await getTelegramSettings(site);

            if (!telegramSettings.botToken || !telegramSettings.chatId) {
                console.error('Telegram settings not configured');
                return res.status(500).json({
                    success: false,
                    error: 'Telegram not configured'
                });
            }

            // Формируем сообщение
            let message;

            if (items && Array.isArray(items) && items.length > 0) {
                // Заказ из корзины
                const itemsList = items.map(item =>
                    `• ${escapeHtml(item.name)} ${item.size ? `(${escapeHtml(item.size)})` : ''} - ${item.qty}шт × ${item.price} zł`
                ).join('\n');

                const total = items.reduce((sum, item) => sum + (item.price * item.qty), 0);

                message = `
🛒 <b>НОВЫЙ ЗАКАЗ ИЗ КОРЗИНЫ</b>

📦 <b>Товары:</b>
${itemsList}

💰 <b>Итого:</b> ${total} zł

👤 <b>Клиент:</b> ${escapeHtml(name)}
📞 <b>Телефон:</b> ${escapeHtml(phone)}
${email ? `📧 <b>Email:</b> ${escapeHtml(email)}` : ''}
${address ? `📍 <b>Адрес:</b> ${escapeHtml(address)}` : ''}

⏰ <b>Время:</b> ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Warsaw' })}
🌐 <b>IP:</b> ${clientIp}
                `.trim();
            } else {
                // Одиночный заказ
                message = `
🛒 <b>НОВЫЙ ЗАКАЗ</b>

📦 <b>Товар:</b> ${escapeHtml(product || 'Не указан')}
${productId ? `🆔 <b>ID:</b> ${escapeHtml(productId)}` : ''}
${price ? `💰 <b>Цена:</b> ${price} zł` : ''}
${size ? `📏 <b>Размер:</b> ${escapeHtml(size)}` : ''}
${quantity ? `🔢 <b>Количество:</b> ${quantity} шт` : ''}

👤 <b>Клиент:</b> ${escapeHtml(name)}
📞 <b>Телефон:</b> ${escapeHtml(phone)}
${email ? `📧 <b>Email:</b> ${escapeHtml(email)}` : ''}
${address ? `📍 <b>Адрес:</b> ${escapeHtml(address)}` : ''}

⏰ <b>Время:</b> ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Warsaw' })}
🌐 <b>IP:</b> ${clientIp}
                `.trim();
            }

            // Отправляем в Telegram
            const fetch = (await import('node-fetch')).default;
            const telegramResponse = await fetch(
                `https://api.telegram.org/bot${telegramSettings.botToken}/sendMessage`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: telegramSettings.chatId,
                        text: message,
                        parse_mode: 'HTML'
                    })
                }
            );

            const result = await telegramResponse.json();
            // Also send to personal chat if configured
            const personalChatId = process.env.TELEGRAM_PERSONAL_CHAT_ID;
            if (personalChatId) {
                try {
                    await fetch(`https://api.telegram.org/bot${telegramSettings.botToken}/sendMessage`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ chat_id: personalChatId, text: message, parse_mode: "HTML" })
                    });
                } catch (e) { console.error("Personal chat send failed:", e); }
            }

            if (!result.ok) {
                console.error('Telegram API error:', result);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to send message to Telegram'
                });
            }

            // Сохраняем заказ в базу данных
            try {
                dbHelpers.run(
                    `INSERT INTO orders (site, name, phone, email, comment, product_key, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        site,
                        name,
                        phone,
                        email || null,
                        items ? JSON.stringify(items) : (product || ''),
                        productId || null,
                        'new'
                    ]
                );
            } catch (dbError) {
                console.error('Failed to save order to database:', dbError);
                // Не возвращаем ошибку - заказ уже отправлен в Telegram
            }

            res.json({ success: true, message: 'Order sent successfully' });

        } catch (error) {
            console.error('Telegram proxy error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    });

    // POST /api/telegram/cart-order - заказ из корзины
    router.post('/cart-order', async (req, res) => {
        try {
            // Проверка API ключа
            if (!checkApiKey(req)) {
                return res.status(403).json({
                    success: false,
                    error: 'Invalid API key'
                });
            }

            const clientIp = req.ip || req.connection.remoteAddress;
            if (!checkRateLimit(clientIp)) {
                return res.status(429).json({
                    success: false,
                    error: 'Too many requests. Please try again later.'
                });
            }

            const { name, phone, email, address, items, total, site = 'mattress' } = req.body;

            // Валидация
            if (!validateName(name)) {
                return res.status(400).json({
                    success: false,
                    error: 'Name must be at least 2 characters'
                });
            }

            if (!validatePhone(phone)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid phone number (minimum 9 digits)'
                });
            }

            if (!items || !Array.isArray(items) || items.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Cart is empty'
                });
            }

            const telegramSettings = await getTelegramSettings(site);

            if (!telegramSettings.botToken || !telegramSettings.chatId) {
                return res.status(500).json({
                    success: false,
                    error: 'Telegram not configured'
                });
            }

            // Формируем список товаров
            const itemsList = items.map(item =>
                `• ${escapeHtml(item.name)} ${item.size ? `(${escapeHtml(item.size)})` : ''} - ${item.qty}шт × ${item.price} zł`
            ).join('\n');

            const message = `
🛒 <b>НОВЫЙ ЗАКАЗ ИЗ КОРЗИНЫ</b>

📦 <b>Товары:</b>
${itemsList}

💰 <b>Итого:</b> ${total || items.reduce((sum, i) => sum + (i.price * i.qty), 0)} zł

👤 <b>Клиент:</b> ${escapeHtml(name)}
📞 <b>Телефон:</b> ${escapeHtml(phone)}
${email ? `📧 <b>Email:</b> ${escapeHtml(email)}` : ''}
${address ? `📍 <b>Адрес:</b> ${escapeHtml(address)}` : ''}

⏰ <b>Время:</b> ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Warsaw' })}
            `.trim();

            const fetch = (await import('node-fetch')).default;
            const telegramResponse = await fetch(
                `https://api.telegram.org/bot${telegramSettings.botToken}/sendMessage`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: telegramSettings.chatId,
                        text: message,
                        parse_mode: 'HTML'
                    })
                }
            );

            const result = await telegramResponse.json();
            // Also send to personal chat if configured
            const personalChatId = process.env.TELEGRAM_PERSONAL_CHAT_ID;
            if (personalChatId) {
                try {
                    await fetch(`https://api.telegram.org/bot${telegramSettings.botToken}/sendMessage`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ chat_id: personalChatId, text: message, parse_mode: "HTML" })
                    });
                } catch (e) { console.error("Personal chat send failed:", e); }
            }

            if (!result.ok) {
                console.error('Telegram API error:', result);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to send message'
                });
            }

            // Сохраняем заказ
            try {
                dbHelpers.run(
                    `INSERT INTO orders (site, name, phone, email, comment, status)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [site, name, phone, email || null, JSON.stringify(items), 'new']
                );
            } catch (dbError) {
                console.error('DB error:', dbError);
            }

            res.json({ success: true, message: 'Order sent successfully' });

        } catch (error) {
            console.error('Cart order error:', error);
            res.status(500).json({ success: false, error: 'Internal server error' });
        }
    });

    // POST /api/telegram/contact - отправка сообщения с формы контактов
    router.post('/contact', async (req, res) => {
        try {
            // Проверка API ключа
            if (!checkApiKey(req)) {
                return res.status(403).json({
                    success: false,
                    error: 'Invalid API key'
                });
            }

            const clientIp = req.ip || req.connection.remoteAddress;
            if (!checkRateLimit(clientIp)) {
                return res.status(429).json({
                    success: false,
                    error: 'Too many requests'
                });
            }

            const { name, email, phone, message: userMessage, site = 'mattress' } = req.body;

            if (!validateName(name)) {
                return res.status(400).json({ success: false, error: 'Invalid name' });
            }

            if (!userMessage || userMessage.trim().length < 10) {
                return res.status(400).json({ success: false, error: 'Message too short' });
            }

            const telegramSettings = await getTelegramSettings(site);

            if (!telegramSettings.botToken || !telegramSettings.chatId) {
                return res.status(500).json({ success: false, error: 'Telegram not configured' });
            }

            const telegramMessage = `
📩 <b>СООБЩЕНИЕ С САЙТА</b>

👤 <b>Имя:</b> ${escapeHtml(name)}
${email ? `📧 <b>Email:</b> ${escapeHtml(email)}` : ''}
${phone ? `📞 <b>Телефон:</b> ${escapeHtml(phone)}` : ''}

💬 <b>Сообщение:</b>
${escapeHtml(userMessage)}

⏰ ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Warsaw' })}
            `.trim();

            const fetch = (await import('node-fetch')).default;
            const response = await fetch(
                `https://api.telegram.org/bot${telegramSettings.botToken}/sendMessage`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: telegramSettings.chatId,
                        text: telegramMessage,
                        parse_mode: 'HTML'
                    })
                }
            );

            const result = await response.json();

            if (!result.ok) {
                return res.status(500).json({ success: false, error: 'Failed to send' });
            }

            res.json({ success: true });

        } catch (error) {
            console.error('Contact form error:', error);
            res.status(500).json({ success: false, error: 'Internal error' });
        }
    });

    // POST /api/telegram/spec-request - заявка с сайта спецтехники (Babylon)
    router.post('/spec-request', async (req, res) => {
        try {
            // Проверка API ключа
            if (!checkApiKey(req)) {
                return res.status(403).json({
                    success: false,
                    error: 'Invalid API key'
                });
            }

            const clientIp = req.ip || req.connection.remoteAddress;
            if (!checkRateLimit(clientIp)) {
                return res.status(429).json({
                    success: false,
                    error: 'Too many requests'
                });
            }

            const { name, phone, email, equipment, period, comment, page } = req.body;

            if (!validateName(name)) {
                return res.status(400).json({ success: false, error: 'Invalid name' });
            }

            if (!validatePhone(phone)) {
                return res.status(400).json({ success: false, error: 'Invalid phone' });
            }

            // Получаем настройки для babylon
            const telegramSettings = await getTelegramSettings('babylon');

            if (!telegramSettings.botToken || !telegramSettings.chatId) {
                return res.status(500).json({ success: false, error: 'Telegram not configured' });
            }

            const message = `
🔔 <b>НОВАЯ ЗАЯВКА - СПЕЦТЕХНИКА</b>

👤 <b>Имя:</b> ${escapeHtml(name)}
📞 <b>Телефон:</b> ${escapeHtml(phone)}
${email ? `📧 <b>Email:</b> ${escapeHtml(email)}` : ''}
${equipment ? `🚜 <b>Техника:</b> ${escapeHtml(equipment)}` : ''}
${period ? `📅 <b>Срок аренды:</b> ${escapeHtml(period)}` : ''}
${comment ? `💬 <b>Комментарий:</b> ${escapeHtml(comment)}` : ''}

📍 <b>Страница:</b> ${escapeHtml(page || 'Главная')}
⏰ <b>Время:</b> ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Warsaw' })}
            `.trim();

            const fetch = (await import('node-fetch')).default;
            const response = await fetch(
                `https://api.telegram.org/bot${telegramSettings.botToken}/sendMessage`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: telegramSettings.chatId,
                        text: message,
                        parse_mode: 'HTML'
                    })
                }
            );

            const result = await response.json();

            if (!result.ok) {
                console.error('Telegram API error:', result);
                return res.status(500).json({ success: false, error: 'Failed to send' });
            }

            // Сохраняем заявку в БД
            try {
                dbHelpers.run(
                    `INSERT INTO orders (site, name, phone, email, rental_period, comment, page, status)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    ['babylon', name, phone, email || null, period || null, comment || null, page || 'index', 'new']
                );
            } catch (dbError) {
                console.error('DB error:', dbError);
            }

            res.json({ success: true });

        } catch (error) {
            console.error('Spec request error:', error);
            res.status(500).json({ success: false, error: 'Internal error' });
        }
    });

    // POST /api/telegram/spec-contact - форма контактов спецтехники
    router.post('/spec-contact', async (req, res) => {
        try {
            // Проверка API ключа
            if (!checkApiKey(req)) {
                return res.status(403).json({
                    success: false,
                    error: 'Invalid API key'
                });
            }

            const clientIp = req.ip || req.connection.remoteAddress;
            if (!checkRateLimit(clientIp)) {
                return res.status(429).json({ success: false, error: 'Too many requests' });
            }

            const { name, phone, email, subject, message: userMessage } = req.body;

            if (!validateName(name)) {
                return res.status(400).json({ success: false, error: 'Invalid name' });
            }

            if (!validatePhone(phone)) {
                return res.status(400).json({ success: false, error: 'Invalid phone' });
            }

            const telegramSettings = await getTelegramSettings('babylon');

            if (!telegramSettings.botToken || !telegramSettings.chatId) {
                return res.status(500).json({ success: false, error: 'Telegram not configured' });
            }

            const subjectLabels = {
                'rental': 'Wynajem sprzętu',
                'partnership': 'Długoterminowa współpraca',
                'payment': 'Pytanie o płatność',
                'other': 'Inne'
            };

            const message = `
📩 <b>КОНТАКТНАЯ ФОРМА - СПЕЦТЕХНИКА</b>

👤 <b>Имя:</b> ${escapeHtml(name)}
📞 <b>Телефон:</b> ${escapeHtml(phone)}
${email ? `📧 <b>Email:</b> ${escapeHtml(email)}` : ''}
📋 <b>Тема:</b> ${escapeHtml(subjectLabels[subject] || subject || 'Не указана')}

💬 <b>Сообщение:</b>
${escapeHtml(userMessage || 'Нет сообщения')}

⏰ ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Warsaw' })}
            `.trim();

            const fetch = (await import('node-fetch')).default;
            const response = await fetch(
                `https://api.telegram.org/bot${telegramSettings.botToken}/sendMessage`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: telegramSettings.chatId,
                        text: message,
                        parse_mode: 'HTML'
                    })
                }
            );

            const result = await response.json();

            if (!result.ok) {
                return res.status(500).json({ success: false, error: 'Failed to send' });
            }

            // Сохраняем в БД
            try {
                dbHelpers.run(
                    `INSERT INTO orders (site, name, phone, email, comment, status)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    ['babylon', name, phone, email || null, `[${subject}] ${userMessage || ''}`, 'new']
                );
            } catch (dbError) {
                console.error('DB error:', dbError);
            }

            res.json({ success: true });

        } catch (error) {
            console.error('Spec contact error:', error);
            res.status(500).json({ success: false, error: 'Internal error' });
        }
    });

    return router;
};
