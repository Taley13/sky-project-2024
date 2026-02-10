/**
 * Sky Template - Catalog Frontend Example
 * Extended product catalog with filtering, sorting, search
 *
 * Required HTML:
 *   <div id="catalogWidget"></div>
 *   <script src="js/config.js"></script>
 *   <script src="js/examples/catalog.js"></script>
 */
document.addEventListener('DOMContentLoaded', () => {
    const CONFIG = window.SITE_CONFIG || {};
    const API = CONFIG.API_BASE_URL || '/api';

    const widget = document.getElementById('catalogWidget');
    if (!widget) return;

    let products = [];
    let categories = [];
    let currentFilter = { category: '', search: '', sort: 'default' };

    function renderWidget() {
        widget.innerHTML = `
            <div class="catalog-widget">
                <div class="catalog-controls">
                    <input type="text" id="catalogSearch" placeholder="Search products..." class="catalog-search">
                    <select id="catalogCategory" class="catalog-select">
                        <option value="">All Categories</option>
                        ${categories.map(c => `<option value="${c.category}">${c.category} (${c.count})</option>`).join('')}
                    </select>
                    <select id="catalogSort" class="catalog-select">
                        <option value="default">Default</option>
                        <option value="price_asc">Price: Low to High</option>
                        <option value="price_desc">Price: High to Low</option>
                        <option value="name">Name A-Z</option>
                        <option value="newest">Newest First</option>
                    </select>
                </div>
                <div id="catalogGrid" class="catalog-grid"></div>
                <div id="catalogEmpty" class="catalog-empty" style="display:none;">No products found</div>
            </div>
        `;

        document.getElementById('catalogSearch').addEventListener('input', e => {
            currentFilter.search = e.target.value;
            loadProducts();
        });
        document.getElementById('catalogCategory').addEventListener('change', e => {
            currentFilter.category = e.target.value;
            loadProducts();
        });
        document.getElementById('catalogSort').addEventListener('change', e => {
            currentFilter.sort = e.target.value;
            loadProducts();
        });
    }

    function renderProducts() {
        const grid = document.getElementById('catalogGrid');
        const empty = document.getElementById('catalogEmpty');

        if (products.length === 0) {
            grid.innerHTML = '';
            empty.style.display = 'block';
            return;
        }
        empty.style.display = 'none';

        grid.innerHTML = products.map(p => {
            const primaryImage = p.images?.find(i => i.is_primary) || p.images?.[0];
            const imgSrc = primaryImage ? `${API.replace('/api', '')}/uploads/${primaryImage.image_path}` : '';
            const hasDiscount = p.sale_price && p.sale_price < p.price;

            return `
                <div class="catalog-card" data-id="${p.id}">
                    ${hasDiscount ? '<span class="catalog-badge">SALE</span>' : ''}
                    ${imgSrc ? `<img src="${imgSrc}" alt="${p.name}" class="catalog-card-img">` : '<div class="catalog-card-img catalog-placeholder"></div>'}
                    <div class="catalog-card-body">
                        <h4 class="catalog-card-title">${p.name}</h4>
                        ${p.sku ? `<span class="catalog-sku">SKU: ${p.sku}</span>` : ''}
                        <p class="catalog-card-desc">${(p.description || '').slice(0, 100)}${(p.description || '').length > 100 ? '...' : ''}</p>
                        <div class="catalog-card-footer">
                            <div class="catalog-price">
                                ${hasDiscount ? `<span class="price-old">${p.price} ${p.currency}</span>` : ''}
                                <span class="price-current">${hasDiscount ? p.sale_price : p.price} ${p.currency}</span>
                            </div>
                            <span class="catalog-stock ${p.stock > 0 ? 'in-stock' : 'out-of-stock'}">
                                ${p.stock > 0 ? `In stock (${p.stock})` : 'Out of stock'}
                            </span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    async function loadCategories() {
        try {
            const res = await fetch(`${API}/catalog/categories`);
            if (res.ok) categories = await res.json();
        } catch (e) {}
    }

    async function loadProducts() {
        try {
            const params = new URLSearchParams();
            if (currentFilter.category) params.set('category', currentFilter.category);
            if (currentFilter.search) params.set('search', currentFilter.search);
            if (currentFilter.sort !== 'default') params.set('sort', currentFilter.sort);

            const res = await fetch(`${API}/catalog/products?${params}`);
            if (res.ok) products = await res.json();
            renderProducts();
        } catch (e) {
            console.log('Catalog unavailable:', e.message);
        }
    }

    async function init() {
        await loadCategories();
        renderWidget();
        await loadProducts();
    }

    init();
});
