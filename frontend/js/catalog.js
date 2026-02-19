/**
 * Sky Store — Catalog Page
 * Based on portfolio.js, adapted for product catalog with add-to-cart
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
    const t = (key) => (typeof i18n !== 'undefined') ? i18n.t(key) : key;

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

            const card = document.createElement('div');
            card.className = 'catalog-card';
            card.dataset.productId = product.id;

            // Card header with category + tags
            let tagsHtml = '';
            if (product.tags && product.tags.length) {
                tagsHtml = product.tags.map(tag => {
                    const cls = tag === 'sale' ? 'tag-sale' : tag === 'new' ? 'tag-new' : 'tag-default';
                    return `<span class="catalog-tag ${cls}">${tag.toUpperCase()}</span>`;
                }).join('');
            }

            // Service status
            const statusText = product['status_' + lang()] || product.status_en || (lang() === 'ru' ? 'Доступно' : 'Available');
            const stockClass = 'in-stock';

            card.innerHTML = `
                <div class="catalog-card-header">
                    <div class="catalog-card-tags">${tagsHtml}</div>
                </div>
                <div class="catalog-card-content">
                    <h3 class="catalog-card-title">${tr.title || product.sku}</h3>
                    <p class="catalog-card-subtitle">${tr.subtitle || ''}</p>
                    <div class="catalog-card-pricing">
                        ${product.old_price ? `<span class="catalog-price-old">${SkyCart.fmtPrice(product.old_price)}</span>` : ''}
                        <span class="catalog-price-current">${SkyCart.fmtPrice(product.price)}</span>
                    </div>
                    <div class="catalog-card-stock ${stockClass}">${statusText}</div>
                    <div class="catalog-card-actions">
                        <button class="catalog-btn-details">${lang() === 'ru' ? 'Подробнее' : 'Details'}</button>
                        <button class="catalog-btn-cart ${inCart ? 'in-cart' : ''}" data-id="${product.id}">
                            ${inCart ? (lang() === 'ru' ? '✓ В корзине' : '✓ In cart') : (lang() === 'ru' ? 'Заказать' : 'Order')}
                        </button>
                    </div>
                </div>`;

            // Details button opens modal
            card.querySelector('.catalog-btn-details').addEventListener('click', (e) => {
                e.stopPropagation();
                openModal(product);
            });

            // Add to cart button
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

        const statusText = product['status_' + lang()] || product.status_en || (lang() === 'ru' ? 'Доступно' : 'Available');

        body.innerHTML = `
            <h2>${tr.title || product.sku}</h2>
            <p class="modal-subtitle">${tr.subtitle || ''}</p>
            <p class="modal-description">${tr.description || ''}</p>
            <div class="modal-pricing">
                ${product.old_price ? `<span class="catalog-price-old">${SkyCart.fmtPrice(product.old_price)}</span>` : ''}
                <span class="catalog-price-current modal-price-large">${SkyCart.fmtPrice(product.price)}</span>
            </div>
            <div class="modal-stock in-stock">${statusText}</div>
            <button class="modal-add-btn">
                ${inCart
                    ? (lang() === 'ru' ? '✓ Уже в корзине' : '✓ Already in cart')
                    : (lang() === 'ru' ? 'Заказать' : 'Order now')}
            </button>`;

        // Add to cart (services are always qty 1)
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

    // Re-render on cart change (from other tabs or pages)
    window.addEventListener('cartChanged', () => {
        renderGrid(document.querySelector('.catalog-filter-btn.active')?.dataset.category || 'all');
    });
});
