const express = require('express');
const fs = require('fs');
const path = require('path');

module.exports = function(db, requireAuth, requireAdmin, upload) {
    const router = express.Router();

    // === PUBLIC ENDPOINTS ===

    // GET /api/portfolio/:site/projects - Получить видимые проекты
    router.get('/:site/projects', (req, res) => {
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

            // Получить переводы и изображения для каждого проекта
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
            console.error('Error fetching portfolio projects:', e);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // GET /api/portfolio/:site/projects/:id - Получить один проект
    router.get('/:site/projects/:id', (req, res) => {
        const { site, id } = req.params;

        try {
            const project = db.get(
                'SELECT * FROM portfolio_projects WHERE site = ? AND id = ? AND visible = 1',
                [site, id]
            );

            if (!project) {
                return res.status(404).json({ error: 'Project not found' });
            }

            const translations = db.all(
                'SELECT * FROM portfolio_translations WHERE project_id = ?',
                [project.id]
            );

            const images = db.all(
                'SELECT * FROM portfolio_images WHERE project_id = ? ORDER BY sort_order',
                [project.id]
            );

            project.translations = translations.reduce((acc, t) => {
                acc[t.lang] = {
                    title: t.title,
                    subtitle: t.subtitle,
                    description: t.description
                };
                return acc;
            }, {});
            project.images = images;
            project.technologies = project.technologies ? JSON.parse(project.technologies) : [];

            res.json(project);
        } catch (e) {
            console.error('Error fetching portfolio project:', e);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // === ADMIN ENDPOINTS ===

    // GET /api/portfolio/:site - Получить все проекты (auth required)
    router.get('/:site', requireAuth, (req, res) => {
        const { site } = req.params;

        try {
            const projects = db.all(
                'SELECT * FROM portfolio_projects WHERE site = ? ORDER BY sort_order',
                [site]
            );

            const result = projects.map(project => {
                const translations = db.all(
                    'SELECT * FROM portfolio_translations WHERE project_id = ?',
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
                    }, {})
                };
            });

            res.json(result);
        } catch (e) {
            console.error('Error fetching admin portfolio projects:', e);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // POST /api/portfolio/:site - Создать проект (auth required)
    router.post('/:site', requireAuth, upload.single('cover_image'), (req, res) => {
        const { site } = req.params;
        const { project_key, project_url, category, technologies, visible, translations } = req.body;

        if (!project_key) {
            return res.status(400).json({ error: 'Project key is required' });
        }

        try {
            const cover_image = req.file ? '/uploads/' + req.file.filename : '';

            // Получить максимальный sort_order
            const maxOrder = db.get('SELECT MAX(sort_order) as max FROM portfolio_projects WHERE site = ?', [site]);
            const sortOrder = (maxOrder?.max || 0) + 1;

            // Преобразовать массив технологий в JSON строку
            const techString = technologies ? JSON.stringify(Array.isArray(technologies) ? technologies : JSON.parse(technologies)) : '[]';

            db.run(
                `INSERT INTO portfolio_projects (site, project_key, cover_image, project_url, category, technologies, visible, sort_order)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [site, project_key, cover_image, project_url || '', category || '', techString, visible ? 1 : 0, sortOrder]
            );

            const newProject = db.get('SELECT * FROM portfolio_projects WHERE site = ? ORDER BY id DESC LIMIT 1', [site]);

            // Добавить переводы
            if (translations) {
                const translationsObj = typeof translations === 'string' ? JSON.parse(translations) : translations;
                const langs = ['en', 'ru'];

                langs.forEach(lang => {
                    if (translationsObj[lang]) {
                        const t = translationsObj[lang];
                        db.run(
                            `INSERT INTO portfolio_translations (project_id, lang, title, subtitle, description)
                             VALUES (?, ?, ?, ?, ?)`,
                            [newProject.id, lang, t.title || '', t.subtitle || '', t.description || '']
                        );
                    }
                });
            }

            res.json({ success: true, data: newProject });
        } catch (e) {
            console.error('Error creating portfolio project:', e);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // PUT /api/portfolio/:site/:id - Обновить проект (auth required)
    router.put('/:site/:id', requireAuth, upload.single('cover_image'), (req, res) => {
        const { site, id } = req.params;
        const { project_key, project_url, category, technologies, visible, translations } = req.body;

        try {
            const currentProject = db.get('SELECT * FROM portfolio_projects WHERE site = ? AND id = ?', [site, id]);
            if (!currentProject) {
                return res.status(404).json({ error: 'Project not found' });
            }

            let cover_image = currentProject.cover_image;
            if (req.file) {
                // Удалить старое изображение
                if (currentProject.cover_image) {
                    const oldPath = path.join(__dirname, '..', currentProject.cover_image);
                    if (fs.existsSync(oldPath)) {
                        fs.unlinkSync(oldPath);
                    }
                }
                cover_image = '/uploads/' + req.file.filename;
            }

            const techString = technologies ? JSON.stringify(Array.isArray(technologies) ? technologies : JSON.parse(technologies)) : '[]';

            db.run(
                `UPDATE portfolio_projects SET project_key = ?, cover_image = ?, project_url = ?,
                 category = ?, technologies = ?, visible = ? WHERE site = ? AND id = ?`,
                [project_key, cover_image, project_url || '', category || '', techString, visible ? 1 : 0, site, id]
            );

            // Обновить переводы
            if (translations) {
                const translationsObj = typeof translations === 'string' ? JSON.parse(translations) : translations;
                const langs = ['en', 'ru'];

                langs.forEach(lang => {
                    if (translationsObj[lang]) {
                        const t = translationsObj[lang];
                        const existing = db.get(
                            'SELECT id FROM portfolio_translations WHERE project_id = ? AND lang = ?',
                            [id, lang]
                        );

                        if (existing) {
                            db.run(
                                `UPDATE portfolio_translations SET title = ?, subtitle = ?, description = ?
                                 WHERE project_id = ? AND lang = ?`,
                                [t.title || '', t.subtitle || '', t.description || '', id, lang]
                            );
                        } else {
                            db.run(
                                `INSERT INTO portfolio_translations (project_id, lang, title, subtitle, description)
                                 VALUES (?, ?, ?, ?, ?)`,
                                [id, lang, t.title || '', t.subtitle || '', t.description || '']
                            );
                        }
                    }
                });
            }

            const updated = db.get('SELECT * FROM portfolio_projects WHERE id = ?', [id]);
            res.json({ success: true, data: updated });
        } catch (e) {
            console.error('Error updating portfolio project:', e);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // PATCH /api/portfolio/:site/:id/visibility - Изменить видимость (auth required)
    router.patch('/:site/:id/visibility', requireAuth, (req, res) => {
        const { site, id } = req.params;
        const { visible } = req.body;

        try {
            db.run('UPDATE portfolio_projects SET visible = ? WHERE site = ? AND id = ?', [visible ? 1 : 0, site, id]);
            res.json({ success: true });
        } catch (e) {
            console.error('Error updating visibility:', e);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // POST /api/portfolio/:site/reorder - Переупорядочить проекты (auth required)
    router.post('/:site/reorder', requireAuth, (req, res) => {
        const { site } = req.params;
        const { order } = req.body;

        if (!Array.isArray(order)) {
            return res.status(400).json({ error: 'Order must be an array' });
        }

        try {
            order.forEach((item, index) => {
                const id = typeof item === 'object' ? item.id : item;
                db.run('UPDATE portfolio_projects SET sort_order = ? WHERE site = ? AND id = ?', [index, site, id]);
            });

            res.json({ success: true });
        } catch (e) {
            console.error('Error reordering projects:', e);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // DELETE /api/portfolio/:site/:id - Удалить проект (admin only)
    router.delete('/:site/:id', requireAdmin, (req, res) => {
        const { site, id } = req.params;

        try {
            const project = db.get('SELECT * FROM portfolio_projects WHERE site = ? AND id = ?', [site, id]);
            if (project && project.cover_image) {
                const imagePath = path.join(__dirname, '..', project.cover_image);
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                }
            }

            // Удалить изображения проекта
            const images = db.all('SELECT * FROM portfolio_images WHERE project_id = ?', [id]);
            images.forEach(img => {
                const imgPath = path.join(__dirname, '..', img.image_path);
                if (fs.existsSync(imgPath)) {
                    fs.unlinkSync(imgPath);
                }
            });

            db.run('DELETE FROM portfolio_images WHERE project_id = ?', [id]);
            db.run('DELETE FROM portfolio_translations WHERE project_id = ?', [id]);
            db.run('DELETE FROM portfolio_projects WHERE site = ? AND id = ?', [site, id]);

            res.json({ success: true });
        } catch (e) {
            console.error('Error deleting portfolio project:', e);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // === ADDITIONAL IMAGES ===

    // POST /api/portfolio/:site/:id/images - Загрузить дополнительное изображение
    router.post('/:site/:id/images', requireAuth, upload.single('image'), (req, res) => {
        const { site, id } = req.params;
        const { caption, sort_order } = req.body;

        if (!req.file) {
            return res.status(400).json({ error: 'No image uploaded' });
        }

        try {
            const project = db.get('SELECT id FROM portfolio_projects WHERE site = ? AND id = ?', [site, id]);
            if (!project) {
                return res.status(404).json({ error: 'Project not found' });
            }

            db.run(
                'INSERT INTO portfolio_images (project_id, image_path, caption, sort_order) VALUES (?, ?, ?, ?)',
                [id, '/uploads/' + req.file.filename, caption || '', sort_order || 0]
            );

            res.json({ success: true, filename: req.file.filename });
        } catch (e) {
            console.error('Error uploading portfolio image:', e);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // DELETE /api/portfolio/:site/:project_id/images/:image_id - Удалить изображение
    router.delete('/:site/:project_id/images/:image_id', requireAuth, (req, res) => {
        const { image_id } = req.params;

        try {
            const image = db.get('SELECT * FROM portfolio_images WHERE id = ?', [image_id]);
            if (image && image.image_path) {
                const imagePath = path.join(__dirname, '..', image.image_path);
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                }
            }

            db.run('DELETE FROM portfolio_images WHERE id = ?', [image_id]);
            res.json({ success: true });
        } catch (e) {
            console.error('Error deleting portfolio image:', e);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    return router;
};
