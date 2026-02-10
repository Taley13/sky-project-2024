/**
 * Sky Template - Blog Example Module
 * Blog with posts, tags, and pagination
 *
 * Tables created: blog_posts, blog_tags, blog_post_tags
 *
 * Usage: Copy to ../blog.js and add to server.js:
 *   const blogRoutes = require('./routes/blog');
 *   app.use('/api/blog', blogRoutes(dbHelpers, requireAuth));
 */

const express = require('express');

module.exports = function(dbHelpers, requireAuth) {
    const router = express.Router();

    // === Initialize Tables ===
    (function initTables() {
        try {
            dbHelpers.run(`CREATE TABLE IF NOT EXISTS blog_posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                content TEXT,
                excerpt TEXT,
                cover_image TEXT,
                author TEXT DEFAULT 'Admin',
                status TEXT DEFAULT 'draft',
                published_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            dbHelpers.run(`CREATE TABLE IF NOT EXISTS blog_tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                slug TEXT NOT NULL UNIQUE
            )`);

            dbHelpers.run(`CREATE TABLE IF NOT EXISTS blog_post_tags (
                post_id INTEGER NOT NULL,
                tag_id INTEGER NOT NULL,
                PRIMARY KEY (post_id, tag_id),
                FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES blog_tags(id) ON DELETE CASCADE
            )`);
        } catch (e) {}
    })();

    // Helper: generate slug
    function generateSlug(text) {
        let slug = text.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();

        // Check uniqueness
        const existing = dbHelpers.get("SELECT id FROM blog_posts WHERE slug = ?", [slug]);
        if (existing) {
            slug = `${slug}-${Date.now()}`;
        }
        return slug;
    }

    // Helper: get tags for a post
    function getPostTags(postId) {
        return dbHelpers.all(
            `SELECT t.* FROM blog_tags t
             JOIN blog_post_tags pt ON t.id = pt.tag_id
             WHERE pt.post_id = ?`,
            [postId]
        );
    }

    // === PUBLIC: List published posts ===
    router.get('/posts', (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const offset = (page - 1) * limit;
            const { tag } = req.query;

            let sql, countSql;
            const params = [];
            const countParams = [];

            if (tag) {
                sql = `SELECT DISTINCT p.* FROM blog_posts p
                       JOIN blog_post_tags pt ON p.id = pt.post_id
                       JOIN blog_tags t ON pt.tag_id = t.id
                       WHERE p.status = 'published' AND t.slug = ?
                       ORDER BY p.published_at DESC LIMIT ? OFFSET ?`;
                params.push(tag, limit, offset);

                countSql = `SELECT COUNT(DISTINCT p.id) as count FROM blog_posts p
                            JOIN blog_post_tags pt ON p.id = pt.post_id
                            JOIN blog_tags t ON pt.tag_id = t.id
                            WHERE p.status = 'published' AND t.slug = ?`;
                countParams.push(tag);
            } else {
                sql = "SELECT * FROM blog_posts WHERE status = 'published' ORDER BY published_at DESC LIMIT ? OFFSET ?";
                params.push(limit, offset);

                countSql = "SELECT COUNT(*) as count FROM blog_posts WHERE status = 'published'";
            }

            const posts = dbHelpers.all(sql, params);
            const total = dbHelpers.get(countSql, countParams);

            // Attach tags to each post
            posts.forEach(post => {
                post.tags = getPostTags(post.id);
            });

            res.json({
                posts,
                pagination: {
                    page,
                    limit,
                    total: total?.count || 0,
                    pages: Math.ceil((total?.count || 0) / limit)
                }
            });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === PUBLIC: Get single post by slug ===
    router.get('/posts/:slug', (req, res) => {
        try {
            const post = dbHelpers.get(
                "SELECT * FROM blog_posts WHERE slug = ? AND status = 'published'",
                [req.params.slug]
            );
            if (!post) return res.status(404).json({ error: 'Post not found' });

            post.tags = getPostTags(post.id);
            res.json(post);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === PUBLIC: Get all tags with post counts ===
    router.get('/tags', (req, res) => {
        try {
            const tags = dbHelpers.all(`
                SELECT t.*, COUNT(pt.post_id) as post_count
                FROM blog_tags t
                LEFT JOIN blog_post_tags pt ON t.id = pt.tag_id
                LEFT JOIN blog_posts p ON pt.post_id = p.id AND p.status = 'published'
                GROUP BY t.id
                ORDER BY t.name
            `);
            res.json(tags);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Get all posts (including drafts) ===
    router.get('/admin/posts', requireAuth, (req, res) => {
        try {
            const posts = dbHelpers.all("SELECT * FROM blog_posts ORDER BY created_at DESC");
            posts.forEach(post => { post.tags = getPostTags(post.id); });
            res.json(posts);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Get single post by ID ===
    router.get('/admin/posts/:id', requireAuth, (req, res) => {
        try {
            const post = dbHelpers.get("SELECT * FROM blog_posts WHERE id = ?", [req.params.id]);
            if (!post) return res.status(404).json({ error: 'Post not found' });
            post.tags = getPostTags(post.id);
            res.json(post);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Create post ===
    router.post('/admin/posts', requireAuth, (req, res) => {
        try {
            const { title, slug, content, excerpt, cover_image, author, status } = req.body;
            if (!title) return res.status(400).json({ error: 'Title is required' });

            const finalSlug = slug || generateSlug(title);
            const finalStatus = status || 'draft';
            const publishedAt = finalStatus === 'published' ? new Date().toISOString() : null;

            dbHelpers.run(
                `INSERT INTO blog_posts (title, slug, content, excerpt, cover_image, author, status, published_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [title, finalSlug, content || '', excerpt || '', cover_image || null, author || 'Admin', finalStatus, publishedAt]
            );

            const post = dbHelpers.get("SELECT * FROM blog_posts WHERE slug = ?", [finalSlug]);
            res.status(201).json(post);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Update post ===
    router.put('/admin/posts/:id', requireAuth, (req, res) => {
        try {
            const { title, slug, content, excerpt, cover_image, author } = req.body;

            dbHelpers.run(
                `UPDATE blog_posts SET title=?, slug=?, content=?, excerpt=?, cover_image=?, author=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
                [title, slug, content, excerpt, cover_image, author, req.params.id]
            );
            res.json({ message: 'Post updated' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Delete post ===
    router.delete('/admin/posts/:id', requireAuth, (req, res) => {
        try {
            dbHelpers.run("DELETE FROM blog_post_tags WHERE post_id = ?", [req.params.id]);
            dbHelpers.run("DELETE FROM blog_posts WHERE id = ?", [req.params.id]);
            res.json({ message: 'Post deleted' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Publish/unpublish post ===
    router.patch('/admin/posts/:id/status', requireAuth, (req, res) => {
        try {
            const { status } = req.body;
            if (!['draft', 'published'].includes(status)) {
                return res.status(400).json({ error: 'Status must be draft or published' });
            }

            const publishedAt = status === 'published' ? new Date().toISOString() : null;
            dbHelpers.run(
                "UPDATE blog_posts SET status = ?, published_at = COALESCE(published_at, ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [status, publishedAt, req.params.id]
            );
            res.json({ message: `Post ${status}` });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Get all tags ===
    router.get('/admin/tags', requireAuth, (req, res) => {
        try {
            res.json(dbHelpers.all("SELECT * FROM blog_tags ORDER BY name"));
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Create tag ===
    router.post('/admin/tags', requireAuth, (req, res) => {
        try {
            const { name } = req.body;
            if (!name) return res.status(400).json({ error: 'Name is required' });

            const slug = name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
            dbHelpers.run("INSERT INTO blog_tags (name, slug) VALUES (?, ?)", [name, slug]);
            res.status(201).json({ message: 'Tag created' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Delete tag ===
    router.delete('/admin/tags/:id', requireAuth, (req, res) => {
        try {
            dbHelpers.run("DELETE FROM blog_post_tags WHERE tag_id = ?", [req.params.id]);
            dbHelpers.run("DELETE FROM blog_tags WHERE id = ?", [req.params.id]);
            res.json({ message: 'Tag deleted' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // === ADMIN: Set tags for a post ===
    router.put('/admin/posts/:id/tags', requireAuth, (req, res) => {
        try {
            const { tag_ids } = req.body;
            if (!Array.isArray(tag_ids)) return res.status(400).json({ error: 'tag_ids must be an array' });

            // Remove existing tags
            dbHelpers.run("DELETE FROM blog_post_tags WHERE post_id = ?", [req.params.id]);

            // Add new tags
            tag_ids.forEach(tagId => {
                dbHelpers.run("INSERT INTO blog_post_tags (post_id, tag_id) VALUES (?, ?)", [req.params.id, tagId]);
            });

            res.json({ message: 'Tags updated' });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    return router;
};
