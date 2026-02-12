const express = require('express');
const fs = require('fs');
const path = require('path');

module.exports = function(db, requireAuth, requireAdmin, upload) {
    const router = express.Router();

    // Get all products for a site with translations (auth required - accountant can view)
    router.get('/:site', requireAuth, (req, res) => {
        const { site } = req.params;
        const { category_id } = req.query;

        let sql = `SELECT p.*, c.name_pl as category_name_pl, c.name_en as category_name_en,
                   c.name_de as category_name_de, c.name_ru as category_name_ru
                   FROM products p
                   LEFT JOIN categories c ON p.category_id = c.id
                   WHERE p.site = ?`;
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
                translations: translations.reduce((acc, t) => {
                    acc[t.lang] = {
                        title: t.title,
                        subtitle: t.subtitle,
                        description: t.description,
                        advantages: t.advantages,
                        specs: t.specs
                    };
                    return acc;
                }, {})
            };
        });

        res.json(result);
    });

    // Get single product with translations (auth required)
    router.get('/:site/:id', requireAuth, (req, res) => {
        const { site, id } = req.params;

        const product = db.get(
            `SELECT p.*, c.name_pl as category_name_pl
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             WHERE p.site = ? AND p.id = ?`,
            [site, id]
        );

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const translations = db.all(
            'SELECT * FROM product_translations WHERE product_id = ?',
            [product.id]
        );

        product.translations = translations.reduce((acc, t) => {
            acc[t.lang] = {
                title: t.title,
                subtitle: t.subtitle,
                description: t.description,
                advantages: t.advantages,
                specs: t.specs
            };
            return acc;
        }, {});

        res.json(product);
    });

    // Create product with translations (accountant can create)
    router.post('/:site', requireAuth, upload.single('image'), (req, res) => {
        const { site } = req.params;
        const { category_id, product_key, price, visible, subcategory_type, translations } = req.body;

        if (!product_key) {
            return res.status(400).json({ error: 'Product key is required' });
        }

        const image = req.file ? '/uploads/' + req.file.filename : '';

        // Get max sort order
        const maxOrder = db.get('SELECT MAX(sort_order) as max FROM products WHERE site = ?', [site]);
        const sortOrder = (maxOrder?.max || 0) + 1;

        db.run(
            `INSERT INTO products (site, category_id, product_key, image, price, visible, sort_order, subcategory_type)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [site, category_id || null, product_key, image, price || '', visible ? 1 : 0, sortOrder, subcategory_type || null]
        );

        const newProduct = db.get('SELECT * FROM products WHERE site = ? ORDER BY id DESC LIMIT 1', [site]);

        // Add translations
        if (translations) {
            const translationsObj = typeof translations === 'string' ? JSON.parse(translations) : translations;
            const langs = ['en', 'de', 'ru'];

            langs.forEach(lang => {
                if (translationsObj[lang]) {
                    const t = translationsObj[lang];
                    db.run(
                        `INSERT INTO product_translations (product_id, lang, title, subtitle, description, advantages, specs)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [newProduct.id, lang, t.title || '', t.subtitle || '', t.description || '', t.advantages || '', t.specs || '']
                    );
                }
            });
        }

        res.json({ success: true, data: newProduct });
    });

    // Update product (accountant can edit)
    router.put('/:site/:id', requireAuth, upload.single('image'), (req, res) => {
        const { site, id } = req.params;
        const { category_id, product_key, price, visible, subcategory_type, translations } = req.body;

        // Get current product
        const currentProduct = db.get('SELECT * FROM products WHERE site = ? AND id = ?', [site, id]);
        if (!currentProduct) {
            return res.status(404).json({ error: 'Product not found' });
        }

        let image = currentProduct.image;
        if (req.file) {
            // Delete old image if exists
            if (currentProduct.image) {
                const oldPath = path.join(__dirname, '..', currentProduct.image);
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }
            image = '/uploads/' + req.file.filename;
        }

        db.run(
            `UPDATE products SET category_id = ?, product_key = ?, image = ?, price = ?, visible = ?, subcategory_type = ?
             WHERE site = ? AND id = ?`,
            [category_id || null, product_key, image, price || '', visible ? 1 : 0, subcategory_type || null, site, id]
        );

        // Update translations
        if (translations) {
            const translationsObj = typeof translations === 'string' ? JSON.parse(translations) : translations;
            const langs = ['en', 'de', 'ru'];

            langs.forEach(lang => {
                if (translationsObj[lang]) {
                    const t = translationsObj[lang];
                    // Check if translation exists
                    const existing = db.get(
                        'SELECT id FROM product_translations WHERE product_id = ? AND lang = ?',
                        [id, lang]
                    );

                    if (existing) {
                        db.run(
                            `UPDATE product_translations SET title = ?, subtitle = ?, description = ?, advantages = ?, specs = ?
                             WHERE product_id = ? AND lang = ?`,
                            [t.title || '', t.subtitle || '', t.description || '', t.advantages || '', t.specs || '', id, lang]
                        );
                    } else {
                        db.run(
                            `INSERT INTO product_translations (product_id, lang, title, subtitle, description, advantages, specs)
                             VALUES (?, ?, ?, ?, ?, ?, ?)`,
                            [id, lang, t.title || '', t.subtitle || '', t.description || '', t.advantages || '', t.specs || '']
                        );
                    }
                }
            });
        }

        const updated = db.get('SELECT * FROM products WHERE id = ?', [id]);
        res.json({ success: true, data: updated });
    });

    // Update visibility (accountant can change)
    router.patch('/:site/:id/visibility', requireAuth, (req, res) => {
        const { site, id } = req.params;
        const { visible } = req.body;

        db.run('UPDATE products SET visible = ? WHERE site = ? AND id = ?', [visible ? 1 : 0, site, id]);
        res.json({ success: true });
    });

    // Batch: Update visibility for multiple products
    router.post('/:site/batch/visibility', requireAuth, (req, res) => {
        const { site } = req.params;
        const { ids, visible } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'IDs array is required' });
        }

        ids.forEach(id => {
            db.run('UPDATE products SET visible = ? WHERE site = ? AND id = ?', [visible ? 1 : 0, site, id]);
        });

        res.json({ success: true, updated: ids.length });
    });

    // Batch: Change category for multiple products
    router.post('/:site/batch/category', requireAuth, (req, res) => {
        const { site } = req.params;
        const { ids, category_id } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'IDs array is required' });
        }

        ids.forEach(id => {
            db.run('UPDATE products SET category_id = ? WHERE site = ? AND id = ?', [category_id, site, id]);
        });

        res.json({ success: true, updated: ids.length });
    });

    // Batch: Delete multiple products (ADMIN ONLY)
    router.post('/:site/batch/delete', requireAdmin, (req, res) => {
        const { site } = req.params;
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'IDs array is required' });
        }

        ids.forEach(id => {
            // Get product to delete image
            const product = db.get('SELECT * FROM products WHERE site = ? AND id = ?', [site, id]);
            if (product && product.image) {
                const imagePath = path.join(__dirname, '..', product.image);
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                }
            }
            // Delete translations first
            db.run('DELETE FROM product_translations WHERE product_id = ?', [id]);
            // Delete product
            db.run('DELETE FROM products WHERE site = ? AND id = ?', [site, id]);
        });

        res.json({ success: true, deleted: ids.length });
    });

    // Reorder products (accountant can reorder)
    router.post('/:site/reorder', requireAuth, (req, res) => {
        const { site } = req.params;
        const { order } = req.body; // Array of {id, sort_order} objects

        if (!Array.isArray(order)) {
            return res.status(400).json({ error: 'Order must be an array' });
        }

        order.forEach((item) => {
            // Support both formats: simple array of IDs or array of objects
            const id = typeof item === 'object' ? item.id : item;
            const sortOrder = typeof item === 'object' ? item.sort_order : order.indexOf(item);
            db.run('UPDATE products SET sort_order = ? WHERE site = ? AND id = ?', [sortOrder, site, id]);
        });

        res.json({ success: true });
    });

    // Delete product (ADMIN ONLY)
    router.delete('/:site/:id', requireAdmin, (req, res) => {
        const { site, id } = req.params;

        // Get product to delete image
        const product = db.get('SELECT * FROM products WHERE site = ? AND id = ?', [site, id]);
        if (product && product.image) {
            const imagePath = path.join(__dirname, '..', product.image);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        // Delete translations first
        db.run('DELETE FROM product_translations WHERE product_id = ?', [id]);
        // Delete product
        db.run('DELETE FROM products WHERE site = ? AND id = ?', [site, id]);

        res.json({ success: true });
    });

    return router;
};
