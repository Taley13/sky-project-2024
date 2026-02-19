/**
 * Sky Store — Global Cart System
 * Works on all pages. Stores cart in localStorage.
 * Uses currency system from configurator.
 */
(function() {
    'use strict';

    const CART_KEY = 'sky_cart';
    const CURRENCIES = {
        EUR: { symbol: '€', rate: 1 },
        USD: { symbol: '$', rate: 1.08 },
        RUB: { symbol: '₽', rate: 105 }
    };

    // --- State ---
    let items = [];
    let currency = localStorage.getItem('sky_currency') || 'EUR';

    // Load cart from localStorage on init
    try {
        const saved = JSON.parse(localStorage.getItem(CART_KEY));
        if (saved && Array.isArray(saved.items)) {
            items = saved.items;
            if (saved.currency) currency = saved.currency;
        }
    } catch(e) { /* ignore */ }

    // --- Persistence ---
    function save() {
        localStorage.setItem(CART_KEY, JSON.stringify({ items, currency }));
        localStorage.setItem('sky_currency', currency);
        updateCartBadge();
        window.dispatchEvent(new CustomEvent('cartChanged', { detail: getState() }));
    }

    // --- Price Helpers ---
    function fmtPrice(eurAmount) {
        const cur = CURRENCIES[currency] || CURRENCIES.EUR;
        return cur.symbol + Math.round(eurAmount * cur.rate).toLocaleString();
    }

    function fmtPriceRaw(eurAmount) {
        const cur = CURRENCIES[currency] || CURRENCIES.EUR;
        return Math.round(eurAmount * cur.rate);
    }

    function getCurrencySymbol() {
        return (CURRENCIES[currency] || CURRENCIES.EUR).symbol;
    }

    // --- Cart Operations ---
    function addItem(product, qty) {
        qty = qty || 1;
        const existing = items.find(i => i.id === product.id);
        if (existing) {
            existing.qty += qty;
        } else {
            items.push({
                id: product.id,
                sku: product.sku || '',
                title_en: product.translations?.en?.title || product.title_en || '',
                title_ru: product.translations?.ru?.title || product.title_ru || '',
                price: product.price,
                old_price: product.old_price || null,
                qty: qty,
                cover_image: product.cover_image || ''
            });
        }
        save();
    }

    function removeItem(productId) {
        items = items.filter(i => i.id !== productId);
        save();
    }

    function updateQty(productId, qty) {
        const item = items.find(i => i.id === productId);
        if (!item) return;
        if (qty <= 0) { removeItem(productId); return; }
        item.qty = qty;
        save();
    }

    function clear() {
        items = [];
        save();
    }

    function getItems() { return items; }
    function getCount() { return items.reduce((s, i) => s + i.qty, 0); }

    function getTotal() {
        return items.reduce((s, i) => s + (i.price * i.qty), 0);
    }

    function setCurrency(code) {
        if (CURRENCIES[code]) {
            currency = code;
            save();
        }
    }

    function getCurrency() { return currency; }

    function getState() {
        return { items: [...items], currency, total: getTotal(), count: getCount() };
    }

    // --- Get item title based on current language ---
    function getItemTitle(item) {
        const lang = localStorage.getItem('sky-lang') || 'en';
        return item['title_' + lang] || item.title_en || item.title_ru || '';
    }

    // --- Cart Badge (header icon) ---
    function updateCartBadge() {
        const badge = document.getElementById('cartBadge');
        const count = getCount();
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'flex' : 'none';
        }
    }

    // --- Render mini-cart for checkout ---
    function renderCartSummary(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const lang = localStorage.getItem('sky-lang') || 'en';

        if (items.length === 0) {
            container.innerHTML = `<div class="cart-empty">${lang === 'ru' ? 'Корзина пуста' : 'Cart is empty'}</div>`;
            return;
        }

        let html = '<div class="cart-items-list">';
        items.forEach(item => {
            const title = getItemTitle(item);
            html += `
                <div class="cart-summary-item" data-id="${item.id}">
                    <div class="cart-summary-item-info">
                        <span class="cart-summary-item-title">${title}</span>
                        <span class="cart-summary-item-price">${fmtPrice(item.price)} × ${item.qty}</span>
                    </div>
                    <div class="cart-summary-item-total">${fmtPrice(item.price * item.qty)}</div>
                    <button class="cart-summary-item-remove" data-id="${item.id}">×</button>
                </div>`;
        });
        html += '</div>';

        html += `<div class="cart-summary-total">
            <span>${lang === 'ru' ? 'Итого' : 'Total'}:</span>
            <span class="cart-summary-total-value">${fmtPrice(getTotal())}</span>
        </div>`;

        container.innerHTML = html;

        // Bind remove buttons
        container.querySelectorAll('.cart-summary-item-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                removeItem(Number(btn.dataset.id));
                renderCartSummary(containerId);
            });
        });
    }

    // --- Init badge on DOMContentLoaded ---
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateCartBadge);
    } else {
        updateCartBadge();
    }

    // --- Public API ---
    window.SkyCart = {
        addItem, removeItem, updateQty, clear,
        getItems, getCount, getTotal, getState,
        setCurrency, getCurrency, getCurrencySymbol,
        fmtPrice, fmtPriceRaw, getItemTitle,
        renderCartSummary, updateCartBadge,
        save
    };
})();
