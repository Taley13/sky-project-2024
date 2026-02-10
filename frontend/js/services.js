/**
 * Sky Template - Services Page
 */
document.addEventListener('DOMContentLoaded', () => {
    const CONFIG = window.SITE_CONFIG || {};
    const API = CONFIG.API_BASE_URL || '/api';
    const SITE = CONFIG.SITE_KEY || 'default';

    let allProducts = [];
    let categories = [];
    let currentCategory = 'all';

    async function loadData() {
        try {
            const catRes = await fetch(`${API}/public/categories/${SITE}`);
            if (catRes.ok) categories = await catRes.json();

            // Build filter buttons
            const filterContainer = document.getElementById('filterButtons');
            if (filterContainer && categories.length > 0) {
                const lang = (typeof i18n !== 'undefined') ? i18n.getCurrentLang() : 'en';
                categories.forEach(cat => {
                    const btn = document.createElement('button');
                    btn.className = 'filter-btn';
                    btn.dataset.category = cat.key;
                    btn.textContent = cat[`name_${lang}`] || cat.name_en || cat.key;
                    btn.addEventListener('click', () => filterByCategory(cat.key));
                    filterContainer.appendChild(btn);
                });
            }

            // Load all products at once
            try {
                const prodRes = await fetch(`${API}/public/products/${SITE}`);
                if (prodRes.ok) {
                    allProducts = await prodRes.json();
                }
            } catch (e) {
                // Products API unavailable
            }

            renderProducts(allProducts);
        } catch (e) {
            // Data loading failed
        }
    }

    function renderProducts(products) {
        const grid = document.getElementById('productsGrid');
        const noResults = document.getElementById('noResults');
        if (!grid) return;

        const lang = (typeof i18n !== 'undefined') ? i18n.getCurrentLang() : 'en';

        grid.innerHTML = '';
        if (products.length === 0) {
            if (noResults) noResults.style.display = 'block';
            return;
        }
        if (noResults) noResults.style.display = 'none';

        products.forEach(product => {
            const translation = product.translations?.find(t => t.lang === lang) || product.translations?.[0] || {};
            const card = document.createElement('div');
            card.className = 'product-card';
            card.dataset.category = product.category_key || '';

            card.innerHTML = `
                <div class="product-card-image"></div>
                <div class="product-card-body">
                    <h3 class="product-card-title">${translation.title || product.product_key}</h3>
                    <p class="product-card-subtitle">${translation.subtitle || ''}</p>
                    ${product.price ? `<p class="product-card-price">${product.price}</p>` : ''}
                </div>
            `;
            grid.appendChild(card);
        });
    }

    function filterByCategory(key) {
        currentCategory = key;
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === key);
        });

        if (key === 'all') {
            renderProducts(allProducts);
        } else {
            renderProducts(allProducts.filter(p => p.category_key === key));
        }
    }

    // Handle hash navigation
    const hash = window.location.hash.slice(1);
    if (hash) {
        setTimeout(() => filterByCategory(hash), 500);
    }

    loadData();
    window.addEventListener('langChanged', () => loadData());
});
