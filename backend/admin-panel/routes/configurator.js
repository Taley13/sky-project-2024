const express = require('express');
const router = express.Router();

// Rate limiting - простая реализация в памяти
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 минута
const RATE_LIMIT_MAX = 3; // максимум 3 запроса в минуту

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

module.exports = function(dbHelpers) {

    // Получаем настройки Telegram из базы данных
    async function getTelegramSettings(site = 'mybusiness') {
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

    // POST /api/telegram/configurator - отправка конфигурации сайта
    router.post('/configurator', async (req, res) => {
        try {
            // Rate limiting
            const clientIp = req.ip || req.connection.remoteAddress;
            if (!checkRateLimit(clientIp)) {
                return res.status(429).json({
                    success: false,
                    error: 'Too many requests. Please try again later.'
                });
            }

            const {
                siteType,
                modules,
                package: selectedPackage,
                discount = 0,
                total: clientTotal,
                clientName,
                clientPhone,
                clientEmail,
                site = 'mybusiness',
                currency = 'EUR'
            } = req.body;

            const curSymbol = {EUR:'€', USD:'$', RUB:'₽'}[currency] || '€';

            // Валидация
            if (!validateName(clientName)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid name. Minimum 2 characters.'
                });
            }

            if (!validatePhone(clientPhone)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid phone. Minimum 9 digits.'
                });
            }

            if (!siteType || !siteType.id) {
                return res.status(400).json({
                    success: false,
                    error: 'Site type is required'
                });
            }

            if (!modules || !Array.isArray(modules)) {
                return res.status(400).json({
                    success: false,
                    error: 'Modules must be an array'
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

            // Формирование списка модулей (try localized name first)
            const getModuleName = (m) => m.name_ru || m.name_en || m.name || m.id;
            const modulesList = modules.length > 0
                ? modules.map(m => `  • ${escapeHtml(getModuleName(m))} — ${curSymbol}${m.price}`).join('\n')
                : '  <i>Модули не выбраны</i>';

            // Подсчёт итоговой стоимости
            const modulesTotal = modules.reduce((sum, m) => sum + parseFloat(m.price || 0), 0);
            const subtotal = parseFloat(siteType.basePrice || 0) + modulesTotal;
            const discountAmt = discount > 0 ? Math.round(subtotal * discount / 100) : 0;
            const total = clientTotal || (subtotal - discountAmt);

            // Информация о пакете
            const packageInfo = selectedPackage
                ? `\n📋 <b>Пакет:</b> ${escapeHtml(selectedPackage.name_ru || selectedPackage.name_en || selectedPackage.id)}`
                : '';
            const discountInfo = discount > 0
                ? `\n🏷 <b>Скидка:</b> ${discount}% (−${curSymbol}${discountAmt})`
                : '';

            // Bot configuration info
            const botConfig = req.body.botConfig;
            const botInfo = botConfig
                ? `\n🤖 <b>Telegram-бот:</b> ${escapeHtml(botConfig.tierId)}${botConfig.addons && botConfig.addons.length ? ` + ${botConfig.addons.map(a => escapeHtml(a)).join(', ')}` : ''}`
                : '';

            // Формирование сообщения для Telegram
            const siteTypeName = siteType.name_ru || siteType.name_en || siteType.name || siteType.id;
            const message = `
🔧 <b>НОВАЯ ЗАЯВКА НА САЙТ</b>

🎯 <b>Тип сайта:</b> ${escapeHtml(siteTypeName)}
💰 <b>Базовая стоимость:</b> ${curSymbol}${siteType.basePrice}${packageInfo}

📦 <b>Выбранные модули:</b>
${modulesList}${botInfo}${discountInfo}

💵 <b>ИТОГО:</b> ${curSymbol}${total}

━━━━━━━━━━━━━━━━━━━

👤 <b>Клиент:</b> ${escapeHtml(clientName)}
📞 <b>Телефон:</b> ${escapeHtml(clientPhone)}
${clientEmail ? `📧 <b>Email:</b> ${escapeHtml(clientEmail)}` : ''}

⏰ <b>Время:</b> ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Warsaw' })}
🌐 <b>IP:</b> ${clientIp}
            `.trim();

            // Отправка в Telegram
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

            const telegramResult = await telegramResponse.json();

            if (!telegramResult.ok) {
                console.error('Telegram API error:', telegramResult);
                return res.status(500).json({
                    success: false,
                    error: 'Failed to send to Telegram'
                });
            }

            // Сохранение в БД
            const configurationJson = JSON.stringify({
                siteType,
                modules,
                package: selectedPackage || null,
                discount,
                total,
                botConfig: botConfig || null
            });

            dbHelpers.run(
                `INSERT INTO orders (site, name, phone, email, comment, status, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
                [
                    site,
                    clientName,
                    clientPhone,
                    clientEmail || null,
                    configurationJson,
                    'new'
                ]
            );

            res.json({
                success: true,
                message: 'Configuration sent successfully'
            });

        } catch (error) {
            console.error('Error in /configurator:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    });

    return router;
};
