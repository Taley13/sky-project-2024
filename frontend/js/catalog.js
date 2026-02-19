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

            // Stock status
            const stockClass = product.stock > 0 ? 'in-stock' : 'out-of-stock';
            const stockText = product.stock > 0
                ? (lang() === 'ru' ? 'В наличии' : 'In stock')
                : (lang() === 'ru' ? 'Нет в наличии' : 'Out of stock');

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
                    <div class="catalog-card-stock ${stockClass}">${stockText}</div>
                    <div class="catalog-card-actions">
                        <button class="catalog-btn-details">${lang() === 'ru' ? 'Подробнее' : 'Details'}</button>
                        <button class="catalog-btn-cart ${inCart ? 'in-cart' : ''}" data-id="${product.id}" ${product.stock <= 0 ? 'disabled' : ''}>
                            ${inCart ? (lang() === 'ru' ? '✓ В корзине' : '✓ In cart') : (lang() === 'ru' ? 'В корзину' : 'Add to cart')}
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
                if (product.stock <= 0) return;
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

        body.innerHTML = `
            <h2>${tr.title || product.sku}</h2>
            <p class="modal-subtitle">${tr.subtitle || ''}</p>
            <p class="modal-description">${tr.description || ''}</p>
            <div class="modal-pricing">
                ${product.old_price ? `<span class="catalog-price-old">${SkyCart.fmtPrice(product.old_price)}</span>` : ''}
                <span class="catalog-price-current modal-price-large">${SkyCart.fmtPrice(product.price)}</span>
            </div>
            <div class="modal-stock ${product.stock > 0 ? 'in-stock' : 'out-of-stock'}">
                ${product.stock > 0
                    ? (lang() === 'ru' ? `В наличии: ${product.stock} шт.` : `In stock: ${product.stock}`)
                    : (lang() === 'ru' ? 'Нет в наличии' : 'Out of stock')}
            </div>
            <div class="modal-qty">
                <label>${lang() === 'ru' ? 'Количество' : 'Quantity'}:</label>
                <div class="qty-controls">
                    <button class="qty-btn qty-minus">−</button>
                    <input type="number" class="qty-input" value="${inCart ? inCart.qty : 1}" min="1" max="${product.stock}">
                    <button class="qty-btn qty-plus">+</button>
                </div>
            </div>
            <button class="modal-add-btn" ${product.stock <= 0 ? 'disabled' : ''}>
                ${inCart
                    ? (lang() === 'ru' ? '✓ Обновить корзину' : '✓ Update cart')
                    : (lang() === 'ru' ? 'Добавить в корзину' : 'Add to cart')}
            </button>`;

        // Qty controls
        const qtyInput = body.querySelector('.qty-input');
        body.querySelector('.qty-minus').addEventListener('click', () => {
            qtyInput.value = Math.max(1, Number(qtyInput.value) - 1);
        });
        body.querySelector('.qty-plus').addEventListener('click', () => {
            qtyInput.value = Math.min(product.stock, Number(qtyInput.value) + 1);
        });

        // Add to cart
        body.querySelector('.modal-add-btn').addEventListener('click', () => {
            const qty = Number(qtyInput.value) || 1;
            if (inCart) {
                SkyCart.updateQty(product.id, qty);
            } else {
                SkyCart.addItem(product, qty);
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
