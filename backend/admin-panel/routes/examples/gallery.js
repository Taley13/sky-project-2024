/**
 * Sky Template - Gallery Example Module
 * Photo albums with lightbox viewer
 *
 * Tables created: gallery_albums, gallery_photos
 *
 * Usage: Copy to ../gallery.js and add to server.js:
 *   const galleryRoutes = require('./routes/gallery');
 *   app.use('/api/gallery', galleryRoutes(dbHelpers, requireAuth, upload));
 */

const express = require('express');

module.exports = function(dbHelpers, requireAuth, upload) {
    const router = express.Router();

    // === Initialize Tables ===
    (function initTables() {
        try {
            dbHelpers.run(`CREATE TABLE IF NOT EXISTS gallery_albums (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                cover_image TEXT,
                visible INTEGER DEFAULT 1,
                sort_order INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            dbHelpers.run(`CREATE TABLE IF NOT EXISTS gallery_photos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                album_id INTEGER NOT NULL,
                image_path TEXT NOT NULL,
                caption TEXT,
                sort_order INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (album_id) REFERENCES gallery_albums(id) ON DELETE CASCADE
            )`);
        } catch (e) {}
    })();

    // === PUBLIC: Get visible albums ===
    router.get('/albums', (req, res) => {
        try {
            const albums = dbHelpers.all(
                "SELECT * FROM gallery_albums WHERE visible = 1 ORDER BY sort_order, id"
            );

            // Attach photo count and cover
            albums.forEach(album => {
                const countRow = dbHelpers.get(
                    "SELECT COUNT(*) as count FROM gallery_photos WHERE album_id = ?", [album.id]
                );
                album.photo_count = countRow?.count || 0;

                if (!album.cover_image) {
                    const firstPhoto = dbHelpers.get(
                        "SELECT image_path FROM gallery_photos WHERE album_id = ? ORDER BY sort_order LIMIT 1", [album.id]
                    );
                    album.cover_image = firstPhoto?.image_path || null;
                }
            });

            res.json(albums);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === PUBLIC: Get album photos ===
    router.get('/albums/:id/photos', (req, res) => {
        try {
            const album = dbHelpers.get("SELECT * FROM gallery_albums WHERE id = ? AND visible = 1", [req.params.id]);
            if (!album) return res.status(404).json({ error: 'Album not found' });

            const photos = dbHelpers.all(
                "SELECT * FROM gallery_photos WHERE album_id = ? ORDER BY sort_order, id",
                [req.params.id]
            );

            res.json({ album, photos });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Get all albums ===
    router.get('/admin/albums', requireAuth, (req, res) => {
        try {
            const albums = dbHelpers.all("SELECT * FROM gallery_albums ORDER BY sort_order, id");
            albums.forEach(album => {
                const countRow = dbHelpers.get("SELECT COUNT(*) as count FROM gallery_photos WHERE album_id = ?", [album.id]);
                album.photo_count = countRow?.count || 0;
            });
            res.json(albums);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Create album ===
    router.post('/admin/albums', requireAuth, (req, res) => {
        try {
            const { name, description, cover_image, sort_order } = req.body;
            if (!name) return res.status(400).json({ error: 'Name is required' });

            dbHelpers.run(
                "INSERT INTO gallery_albums (name, description, cover_image, sort_order) VALUES (?, ?, ?, ?)",
                [name, description || '', cover_image || null, sort_order || 0]
            );
            res.status(201).json({ message: 'Album created' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Update album ===
    router.put('/admin/albums/:id', requireAuth, (req, res) => {
        try {
            const { name, description, cover_image, visible, sort_order } = req.body;
            dbHelpers.run(
                "UPDATE gallery_albums SET name=?, description=?, cover_image=?, visible=?, sort_order=? WHERE id=?",
                [name, description, cover_image, visible ?? 1, sort_order || 0, req.params.id]
            );
            res.json({ message: 'Album updated' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Delete album and its photos ===
    router.delete('/admin/albums/:id', requireAuth, (req, res) => {
        try {
            dbHelpers.run("DELETE FROM gallery_photos WHERE album_id = ?", [req.params.id]);
            dbHelpers.run("DELETE FROM gallery_albums WHERE id = ?", [req.params.id]);
            res.json({ message: 'Album deleted' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Upload photo to album ===
    router.post('/admin/albums/:id/photos', requireAuth, upload.single('image'), (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

            const album = dbHelpers.get("SELECT id FROM gallery_albums WHERE id = ?", [req.params.id]);
            if (!album) return res.status(404).json({ error: 'Album not found' });

            const caption = req.body.caption || '';
            const sortOrder = req.body.sort_order || 0;

            dbHelpers.run(
                "INSERT INTO gallery_photos (album_id, image_path, caption, sort_order) VALUES (?, ?, ?, ?)",
                [req.params.id, req.file.filename, caption, sortOrder]
            );

            res.status(201).json({ message: 'Photo uploaded', filename: req.file.filename });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Update photo ===
    router.put('/admin/photos/:id', requireAuth, (req, res) => {
        try {
            const { caption, sort_order } = req.body;
            dbHelpers.run(
                "UPDATE gallery_photos SET caption=?, sort_order=? WHERE id=?",
                [caption, sort_order || 0, req.params.id]
            );
            res.json({ message: 'Photo updated' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Delete photo ===
    router.delete('/admin/photos/:id', requireAuth, (req, res) => {
        try {
            dbHelpers.run("DELETE FROM gallery_photos WHERE id = ?", [req.params.id]);
            res.json({ message: 'Photo deleted' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Reorder photos in album ===
    router.put('/admin/albums/:id/reorder', requireAuth, (req, res) => {
        try {
            const { photo_ids } = req.body;
            if (!Array.isArray(photo_ids)) return res.status(400).json({ error: 'photo_ids must be an array' });

            photo_ids.forEach((photoId, index) => {
                dbHelpers.run("UPDATE gallery_photos SET sort_order = ? WHERE id = ? AND album_id = ?",
                    [index, photoId, req.params.id]);
            });

            res.json({ message: 'Photos reordered' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
};
