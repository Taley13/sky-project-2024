/**
 * Sky — Services Catalog
 * Premium card design with icons, features, gradients
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for i18n
    let retries = 0;
    const waitForI18n = () => new Promise(resolve => {
        if (typeof i18n !== 'undefined') { resolve(); return; }
        const check = setInterval(() => {
            retries++;
            if (typeof i18n !== 'undefined' || retries >= 50) { clearInterval(check); resolve(); }
        }, 100);
    });
    await waitForI18n();

    let allProducts = [];
    let categories = [];
    const lang = () => (typeof i18n !== 'undefined') ? i18n.getCurrentLang() : 'en';

    // --- SVG icons map ---
    const ICONS = {
        cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>',
        diamond: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 13L2 9z"/><path d="M2 9h20"/><path d="M10 3l-4 6 6 13 6-13-4-6"/></svg>',
        rocket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>',
        layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
        grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
        calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>'
    };

    // --- Load products ---
    async function loadProducts() {
        try {
            const res = await fetch('/data/products.json');
            if (!res.ok) return;
            const data = await res.json();
            allProducts = (data.products || []).filter(p => p.visible);
            allProducts.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
            categories = data.categories || [];
            renderFilters();
            renderGrid('all');
        } catch(e) {
            console.error('Failed to load products:', e);
        }
    }

    // --- Render filter buttons ---
    function renderFilters() {
        const container = document.getElementById('catalogFilters');
        if (!container) return;
        container.innerHTML = '';
        categories.forEach((cat, idx) => {
            const btn = document.createElement('button');
            btn.className = 'catalog-filter-btn' + (idx === 0 ? ' active' : '');
            btn.dataset.category = cat.id;
            btn.textContent = cat['name_' + lang()] || cat.name_en;
            btn.addEventListener('click', () => {
                container.querySelectorAll('.catalog-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderGrid(cat.id);
            });
            container.appendChild(btn);
        });
    }

    // --- Render product grid ---
    function renderGrid(category) {
        const grid = document.getElementById('catalogGrid');
        const empty = document.getElementById('catalogEmpty');
        if (!grid) return;

        let products = category === 'all' ? allProducts : allProducts.filter(p => p.category === category);
        grid.innerHTML = '';

        if (products.length === 0) {
            if (empty) empty.style.display = 'block';
            return;
        }
        if (empty) empty.style.display = 'none';

        products.forEach(product => {
            const tr = product.translations[lang()] || product.translations['en'] || {};
            const cartItems = SkyCart.getItems();
            const inCart = cartItems.some(i => i.id === product.id);
            const features = product['features_' + lang()] || product.features_en || [];
            const timeline = product['timeline_' + lang()] || product.timeline_en || '';
            const statusText = product['status_' + lang()] || product.status_en || '';
            const iconSvg = ICONS[product.icon] || ICONS.grid;
            const gradient = product.gradient || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

            const card = document.createElement('div');
            card.className = 'catalog-card';
            card.dataset.productId = product.id;

            // Tags
            let tagsHtml = '';
            if (product.tags && product.tags.length) {
                tagsHtml = product.tags.map(tag => {
                    const cls = tag === 'sale' ? 'tag-sale' : tag === 'new' ? 'tag-new' : tag === 'popular' ? 'tag-popular' : 'tag-default';
                    const label = tag === 'sale' ? (lang() === 'ru' ? 'СКИДКА' : 'SALE')
                        : tag === 'new' ? (lang() === 'ru' ? 'НОВОЕ' : 'NEW')
                        : tag === 'popular' ? (lang() === 'ru' ? 'ХИТ' : 'HOT')
                        : tag.toUpperCase();
                    return `<span class="catalog-tag ${cls}">${label}</span>`;
                }).join('');
            }

            // Features list (max 4 on card)
            const featuresHtml = features.slice(0, 4).map(f =>
                `<li><span class="feature-check">&#10003;</span> ${f}</li>`
            ).join('');
            const moreCount = features.length > 4 ? features.length - 4 : 0;

            card.innerHTML = `
                <div class="card-gradient-bar" style="background: ${gradient}"></div>
                <div class="card-icon-area">
                    <div class="card-icon" style="color: ${gradient.match(/#[a-f0-9]{6}/i)?.[0] || '#667eea'}">${iconSvg}</div>
                    <div class="catalog-card-tags">${tagsHtml}</div>
                </div>
                <div class="catalog-card-content">
                    <h3 class="catalog-card-title">${tr.title || product.sku}</h3>
                    <p class="catalog-card-subtitle">${tr.subtitle || ''}</p>
                    <ul class="card-features">${featuresHtml}${moreCount > 0 ? `<li class="features-more">+${moreCount} ${lang() === 'ru' ? 'ещё' : 'more'}...</li>` : ''}</ul>
                    <div class="card-bottom">
                        <div class="card-meta">
                            <div class="catalog-card-pricing">
                                ${product.old_price ? `<span class="catalog-price-old">${SkyCart.fmtPrice(product.old_price)}</span>` : ''}
                                <span class="catalog-price-current">${SkyCart.fmtPrice(product.price)}</span>
                            </div>
                            <div class="card-info-row">
                                ${statusText ? `<span class="card-status">${statusText}</span>` : ''}
                                ${timeline ? `<span class="card-timeline">${timeline}</span>` : ''}
                            </div>
                        </div>
                        <div class="catalog-card-actions">
                            <button class="catalog-btn-details">${lang() === 'ru' ? 'Подробнее' : 'Details'}</button>
                            <button class="catalog-btn-cart ${inCart ? 'in-cart' : ''}" data-id="${product.id}">
                                ${inCart ? (lang() === 'ru' ? '✓ В корзине' : '✓ In cart') : (lang() === 'ru' ? 'Заказать' : 'Order')}
                            </button>
                        </div>
                    </div>
                </div>`;

            // Details button
            card.querySelector('.catalog-btn-details').addEventListener('click', (e) => {
                e.stopPropagation();
                openModal(product);
            });

            // Order button
            card.querySelector('.catalog-btn-cart').addEventListener('click', (e) => {
                e.stopPropagation();
                SkyCart.addItem(product, 1);
                showToast(lang() === 'ru'
                    ? `${tr.title} — добавлен в корзину`
                    : `${tr.title} — added to cart`);
                renderGrid(document.querySelector('.catalog-filter-btn.active')?.dataset.category || 'all');
            });

            grid.appendChild(card);
        });
    }

    // --- Product modal ---
    function openModal(product) {
        const modal = document.getElementById('catalogModal');
        const body = document.getElementById('catalogModalBody');
        if (!modal || !body) return;

        const tr = product.translations[lang()] || product.translations['en'] || {};
        const cartItems = SkyCart.getItems();
        const inCart = cartItems.find(i => i.id === product.id);
        const features = product['features_' + lang()] || product.features_en || [];
        const timeline = product['timeline_' + lang()] || product.timeline_en || '';
        const statusText = product['status_' + lang()] || product.status_en || '';
        const iconSvg = ICONS[product.icon] || ICONS.grid;
        const gradient = product.gradient || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

        const featuresHtml = features.map(f =>
            `<li><span class="feature-check">&#10003;</span> ${f}</li>`
        ).join('');

        body.innerHTML = `
            <div class="modal-header-gradient" style="background: ${gradient}">
                <div class="modal-icon">${iconSvg}</div>
            </div>
            <h2>${tr.title || product.sku}</h2>
            <p class="modal-subtitle">${tr.subtitle || ''}</p>
            <p class="modal-description">${tr.description || ''}</p>
            <ul class="modal-features">${featuresHtml}</ul>
            <div class="modal-pricing">
                ${product.old_price ? `<span class="catalog-price-old">${SkyCart.fmtPrice(product.old_price)}</span>` : ''}
                <span class="catalog-price-current modal-price-large">${SkyCart.fmtPrice(product.price)}</span>
            </div>
            <div class="modal-meta-row">
                ${statusText ? `<span class="card-status">${statusText}</span>` : ''}
                ${timeline ? `<span class="card-timeline">${timeline}</span>` : ''}
            </div>
            <button class="modal-add-btn" style="background: ${gradient.match(/#[a-f0-9]{6}/i)?.[0] || 'var(--secondary-color)'}">
                ${inCart
                    ? (lang() === 'ru' ? '✓ Уже в корзине' : '✓ Already in cart')
                    : (lang() === 'ru' ? 'Заказать' : 'Order now')}
            </button>`;

        // Order button
        body.querySelector('.modal-add-btn').addEventListener('click', () => {
            if (!inCart) {
                SkyCart.addItem(product, 1);
            }
            showToast(lang() === 'ru'
                ? `${tr.title} — добавлен в корзину`
                : `${tr.title} — added to cart`);
            closeModal();
            renderGrid(document.querySelector('.catalog-filter-btn.active')?.dataset.category || 'all');
        });

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        const modal = document.getElementById('catalogModal');
        if (modal) { modal.classList.remove('active'); document.body.style.overflow = ''; }
    }

    // --- Toast ---
    function showToast(msg) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2500);
    }

    // --- Modal close handlers ---
    document.getElementById('catalogModalClose')?.addEventListener('click', closeModal);
    document.querySelector('.catalog-modal-overlay')?.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    // --- Init ---
    loadProducts();

    // Re-render on language change
    window.addEventListener('langChanged', () => {
        renderFilters();
        renderGrid(document.querySelector('.catalog-filter-btn.active')?.dataset.category || 'all');
    });

    // Re-render on cart change
    window.addEventListener('cartChanged', () => {
        renderGrid(document.querySelector('.catalog-filter-btn.active')?.dataset.category || 'all');
    });
});
