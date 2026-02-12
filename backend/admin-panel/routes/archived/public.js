const express = require('express');
const https = require('https');

module.exports = function(db) {
    const router = express.Router();

    // Get contacts for a site
    router.get('/contacts/:site', (req, res) => {
        const { site } = req.params;
        const contact = db.get('SELECT * FROM contacts WHERE site = ?', [site]);
        res.json(contact || {});
    });

    // Get visible categories for a site
    router.get('/categories/:site', (req, res) => {
        const { site } = req.params;
        const categories = db.all(
            'SELECT * FROM categories WHERE site = ? AND visible = 1 ORDER BY sort_order',
            [site]
        );
        res.json(categories);
    });

    // Get visible hexagons for a site
    router.get('/hexagons/:site/active', (req, res) => {
        const { site } = req.params;
        const hexagons = db.all(
            'SELECT * FROM hexagons WHERE site = ? AND visible = 1 ORDER BY sort_order',
            [site]
        );
        res.json(hexagons);
    });

    // Get visible portfolio projects for a site
    router.get('/portfolio/:site', (req, res) => {
        const { site } = req.params;
        const { category } = req.query;

        let sql = `SELECT * FROM portfolio_projects WHERE site = ? AND visible = 1`;
        const params = [site];

        if (category) {
            sql += ' AND category = ?';
            params.push(category);
        }

        sql += ' ORDER BY sort_order';

        try {
            const projects = db.all(sql, params);

            // Get translations and images for each project
            const result = projects.map(project => {
                const translations = db.all(
                    'SELECT * FROM portfolio_translations WHERE project_id = ?',
                    [project.id]
                );

                const images = db.all(
                    'SELECT * FROM portfolio_images WHERE project_id = ? ORDER BY sort_order',
                    [project.id]
                );

                return {
                    ...project,
                    technologies: project.technologies ? JSON.parse(project.technologies) : [],
                    translations: translations.reduce((acc, t) => {
                        acc[t.lang] = {
                            title: t.title,
                            subtitle: t.subtitle,
                            description: t.description
                        };
                        return acc;
                    }, {}),
                    images: images
                };
            });

            res.json(result);
        } catch (e) {
            console.error('Error fetching portfolio:', e);
            res.json([]);
        }
    });

    // Get visible products for a site
    router.get('/products/:site', (req, res) => {
        const { site } = req.params;
        const { category_id } = req.query;

        let sql = `SELECT p.*, c.key as category_key, c.name_pl as category_name_pl,
                   c.name_en as category_name_en, c.name_de as category_name_de, c.name_ru as category_name_ru
                   FROM products p
                   LEFT JOIN categories c ON p.category_id = c.id
                   WHERE p.site = ? AND p.visible = 1`;
        const params = [site];

        if (category_id) {
            sql += ' AND p.category_id = ?';
            params.push(category_id);
        }

        sql += ' ORDER BY p.sort_order';

        const products = db.all(sql, params);

        // Get translations for each product
        const result = products.map(product => {
            const translations = db.all(
                'SELECT * FROM product_translations WHERE product_id = ?',
                [product.id]
            );
            return {
                ...product,
                translations: translations
            };
        });

        res.json(result);
    });

    // Create order and send to Telegram
    router.post('/orders/:site', (req, res) => {
        const { site } = req.params;
        const { name, phone, email, rental_period, comment, page, product_key } = req.body;

        if (!name || !phone) {
            return res.status(400).json({ success: false, error: 'Name and phone are required' });
        }

        // Save to database
        db.run(
            `INSERT INTO orders (site, name, phone, email, rental_period, comment, page, product_key, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new')`,
            [site, name, phone, email || '', rental_period || '', comment || '', page || '', product_key || '']
        );

        // Send to Telegram
        const botToken = db.get('SELECT value FROM settings WHERE key = ?', [site + '_telegram_bot_token']);
        const chatId = db.get('SELECT value FROM settings WHERE key = ?', [site + '_telegram_chat_id']);

        if (botToken?.value && chatId?.value) {
            const message = `
<b>Новая заявка!</b>

<b>Имя:</b> ${name}
<b>Телефон:</b> ${phone}
${email ? `<b>Email:</b> ${email}\n` : ''}${rental_period ? `<b>Период:</b> ${rental_period}\n` : ''}${product_key ? `<b>Товар:</b> ${product_key}\n` : ''}${page ? `<b>Страница:</b> ${page}\n` : ''}${comment ? `<b>Комментарий:</b> ${comment}` : ''}
            `.trim();

            const encodedMessage = encodeURIComponent(message);
            const url = `https://api.telegram.org/bot${botToken.value}/sendMessage?chat_id=${chatId.value}&text=${encodedMessage}&parse_mode=HTML`;

            https.get(url, (response) => {
                let data = '';
                response.on('data', chunk => data += chunk);
                response.on('end', () => {
                    // Telegram send complete
                });
            }).on('error', () => {
                // Telegram error - but order is saved
            });
        }

        res.json({ success: true });
    });

    return router;
};
