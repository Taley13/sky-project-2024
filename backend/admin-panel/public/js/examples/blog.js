/**
 * Sky Template - Blog Frontend Example
 * Blog listing with post cards, tag filtering, and pagination
 *
 * Required HTML:
 *   <div id="blogWidget"></div>
 *   <script src="js/config.js"></script>
 *   <script src="js/examples/blog.js"></script>
 */
document.addEventListener('DOMContentLoaded', () => {
    const CONFIG = window.SITE_CONFIG || {};
    const API = CONFIG.API_BASE_URL || '/api';

    const widget = document.getElementById('blogWidget');
    if (!widget) return;

    let posts = [];
    let tags = [];
    let pagination = { page: 1, pages: 1, total: 0 };
    let activeTag = null;
    let viewingPost = null;

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    function renderList() {
        widget.innerHTML = `
            <div class="blog-widget">
                <!-- Tags filter -->
                ${tags.length > 0 ? `
                    <div class="blog-tags">
                        <button class="blog-tag ${!activeTag ? 'active' : ''}" data-tag="">All</button>
                        ${tags.map(t => `
                            <button class="blog-tag ${activeTag === t.slug ? 'active' : ''}" data-tag="${t.slug}">
                                ${t.name} <span class="blog-tag-count">${t.post_count}</span>
                            </button>
                        `).join('')}
                    </div>
                ` : ''}

                <!-- Posts grid -->
                <div class="blog-grid">
                    ${posts.length > 0 ? posts.map(post => `
                        <article class="blog-card" data-slug="${post.slug}">
                            ${post.cover_image ? `
                                <div class="blog-card-image" style="background-image:url('${post.cover_image}')"></div>
                            ` : `
                                <div class="blog-card-image blog-card-placeholder"></div>
                            `}
                            <div class="blog-card-body">
                                <div class="blog-card-meta">
                                    <span>${formatDate(post.published_at)}</span>
                                    <span>${post.author || 'Admin'}</span>
                                </div>
                                <h3 class="blog-card-title">${post.title}</h3>
                                <p class="blog-card-excerpt">${(post.excerpt || post.content || '').substring(0, 150)}${(post.content || '').length > 150 ? '...' : ''}</p>
                                ${post.tags?.length ? `
                                    <div class="blog-card-tags">
                                        ${post.tags.map(t => `<span class="blog-card-tag">${t.name}</span>`).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        </article>
                    `).join('') : '<p class="blog-empty">No posts found</p>'}
                </div>

                <!-- Pagination -->
                ${pagination.pages > 1 ? `
                    <div class="blog-pagination">
                        ${pagination.page > 1 ? `<button class="blog-page-btn" data-page="${pagination.page - 1}">&laquo; Previous</button>` : ''}
                        <span class="blog-page-info">Page ${pagination.page} of ${pagination.pages}</span>
                        ${pagination.page < pagination.pages ? `<button class="blog-page-btn" data-page="${pagination.page + 1}">Next &raquo;</button>` : ''}
                    </div>
                ` : ''}
            </div>
        `;

        // Tag click events
        document.querySelectorAll('.blog-tag').forEach(btn => {
            btn.addEventListener('click', () => {
                activeTag = btn.dataset.tag || null;
                pagination.page = 1;
                loadPosts();
            });
        });

        // Card click events
        document.querySelectorAll('.blog-card').forEach(card => {
            card.addEventListener('click', () => loadPost(card.dataset.slug));
        });

        // Pagination events
        document.querySelectorAll('.blog-page-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                pagination.page = parseInt(btn.dataset.page);
                loadPosts();
            });
        });
    }

    function renderPost(post) {
        widget.innerHTML = `
            <div class="blog-widget">
                <button class="blog-back-btn" id="blogBack">&larr; Back to posts</button>
                <article class="blog-post">
                    ${post.cover_image ? `<img class="blog-post-cover" src="${post.cover_image}" alt="${post.title}">` : ''}
                    <div class="blog-post-meta">
                        <span>${formatDate(post.published_at)}</span>
                        <span>${post.author || 'Admin'}</span>
                    </div>
                    <h1 class="blog-post-title">${post.title}</h1>
                    ${post.tags?.length ? `
                        <div class="blog-post-tags">
                            ${post.tags.map(t => `<span class="blog-card-tag">${t.name}</span>`).join('')}
                        </div>
                    ` : ''}
                    <div class="blog-post-content">${post.content || ''}</div>
                </article>
            </div>
        `;

        document.getElementById('blogBack')?.addEventListener('click', () => {
            viewingPost = null;
            renderList();
        });
    }

    async function loadPosts() {
        try {
            let url = `${API}/blog/posts?page=${pagination.page}&limit=9`;
            if (activeTag) url += `&tag=${activeTag}`;

            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                posts = data.posts || [];
                pagination = data.pagination || pagination;
            }
            renderList();
        } catch (e) {
            widget.innerHTML = '<p>Blog unavailable</p>';
        }
    }

    async function loadPost(slug) {
        try {
            const res = await fetch(`${API}/blog/posts/${slug}`);
            if (res.ok) {
                viewingPost = await res.json();
                renderPost(viewingPost);
            }
        } catch (e) {
            widget.innerHTML = '<p>Post unavailable</p>';
        }
    }

    async function loadTags() {
        try {
            const res = await fetch(`${API}/blog/tags`);
            if (res.ok) tags = await res.json();
        } catch (e) {}
    }

    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
        .blog-widget { max-width: 1000px; margin: 0 auto; }
        .blog-tags { display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap; }
        .blog-tag {
            padding: 6px 16px; border: 1px solid #ddd; background: #fff;
            border-radius: 20px; cursor: pointer; font-size: 13px; transition: all 0.3s;
        }
        .blog-tag.active { background: var(--primary-color, #4CAF50); color: #fff; border-color: var(--primary-color, #4CAF50); }
        .blog-tag:hover { border-color: var(--primary-color, #4CAF50); }
        .blog-tag-count { font-size: 11px; opacity: 0.7; margin-left: 4px; }
        .blog-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px; }
        .blog-card { border: 1px solid #e8e8e8; border-radius: 12px; overflow: hidden; cursor: pointer; transition: transform 0.3s, box-shadow 0.3s; }
        .blog-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }
        .blog-card-image { height: 200px; background-size: cover; background-position: center; background-color: #f0f0f0; }
        .blog-card-placeholder { background: linear-gradient(135deg, #e0e0e0, #f5f5f5); }
        .blog-card-body { padding: 20px; }
        .blog-card-meta { display: flex; justify-content: space-between; font-size: 12px; color: #999; margin-bottom: 8px; }
        .blog-card-title { margin: 0 0 8px; font-size: 18px; line-height: 1.3; }
        .blog-card-excerpt { color: #666; font-size: 14px; line-height: 1.5; margin: 0 0 12px; }
        .blog-card-tags { display: flex; gap: 6px; flex-wrap: wrap; }
        .blog-card-tag { font-size: 11px; padding: 2px 10px; background: #f0f0f0; border-radius: 10px; color: #666; }
        .blog-pagination { display: flex; justify-content: center; align-items: center; gap: 16px; margin-top: 32px; }
        .blog-page-btn { padding: 8px 20px; border: 1px solid var(--primary-color, #4CAF50); background: #fff; color: var(--primary-color, #4CAF50); border-radius: 6px; cursor: pointer; }
        .blog-page-btn:hover { background: var(--primary-color, #4CAF50); color: #fff; }
        .blog-page-info { color: #777; font-size: 14px; }
        .blog-empty { text-align: center; color: #999; padding: 40px; }
        .blog-back-btn { background: none; border: none; color: var(--primary-color, #4CAF50); cursor: pointer; font-size: 15px; padding: 8px 0; margin-bottom: 16px; }
        .blog-back-btn:hover { text-decoration: underline; }
        .blog-post-cover { width: 100%; max-height: 400px; object-fit: cover; border-radius: 12px; margin-bottom: 20px; }
        .blog-post-meta { display: flex; gap: 16px; font-size: 14px; color: #999; margin-bottom: 12px; }
        .blog-post-title { font-size: 32px; margin: 0 0 12px; line-height: 1.2; }
        .blog-post-tags { margin-bottom: 24px; display: flex; gap: 6px; }
        .blog-post-content { line-height: 1.8; font-size: 16px; color: #444; }
        @media (max-width: 640px) { .blog-grid { grid-template-columns: 1fr; } .blog-post-title { font-size: 24px; } }
    `;
    document.head.appendChild(style);

    // Initial load
    Promise.all([loadTags(), loadPosts()]);
});
