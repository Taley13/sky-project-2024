/**
 * Sky Template - Cart Frontend Example
 * Floating cart icon with sidebar panel and checkout form
 *
 * Required HTML:
 *   <div id="cartWidget"></div>
 *   <script src="js/config.js"></script>
 *   <script src="js/examples/cart.js"></script>
 *
 * To add items from other scripts:
 *   window.addToCart(productId, productName, productPrice)
 */
document.addEventListener('DOMContentLoaded', () => {
    const CONFIG = window.SITE_CONFIG || {};
    const API = CONFIG.API_BASE_URL || '/api';

    const widget = document.getElementById('cartWidget');
    if (!widget) return;

    let cartItems = [];
    let cartTotal = 0;
    let cartCount = 0;
    let panelOpen = false;
    let checkoutMode = false;
    let orderResult = null;

    // Global function for other scripts to add items
    window.addToCart = async function(productId, productName, productPrice) {
        try {
            const res = await fetch(`${API}/cart/cart`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    product_id: productId,
                    product_name: productName,
                    product_price: productPrice,
                    quantity: 1
                }),
                credentials: 'include'
            });

            if (res.ok) {
                const data = await res.json();
                cartCount = data.count;
                updateBadge();
                await loadCart();
                if (!panelOpen) togglePanel();
            }
        } catch (e) {
            console.error('Add to cart failed:', e);
        }
    };

    function render() {
        widget.innerHTML = `
            <!-- Floating Cart Button -->
            <div class="cart-float-btn" id="cartFloatBtn">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                </svg>
                <span class="cart-badge" id="cartBadge" style="display:${cartCount > 0 ? 'flex' : 'none'}">${cartCount}</span>
            </div>

            <!-- Cart Panel -->
            <div class="cart-overlay ${panelOpen ? 'open' : ''}" id="cartOverlay"></div>
            <div class="cart-panel ${panelOpen ? 'open' : ''}" id="cartPanel">
                <div class="cart-panel-header">
                    <h3>${checkoutMode ? 'Checkout' : orderResult ? 'Order Confirmed' : 'Shopping Cart'}</h3>
                    <button class="cart-panel-close" id="cartPanelClose">&times;</button>
                </div>

                <div class="cart-panel-body">
                    ${orderResult ? renderOrderConfirmation() :
                      checkoutMode ? renderCheckoutForm() :
                      renderCartItems()}
                </div>
            </div>
        `;

        // Events
        document.getElementById('cartFloatBtn')?.addEventListener('click', togglePanel);
        document.getElementById('cartPanelClose')?.addEventListener('click', togglePanel);
        document.getElementById('cartOverlay')?.addEventListener('click', togglePanel);

        // Cart item events
        document.querySelectorAll('.cart-qty-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const dir = parseInt(btn.dataset.dir);
                const item = cartItems.find(i => i.id == id);
                if (item) updateQuantity(id, Math.max(1, item.quantity + dir));
            });
        });

        document.querySelectorAll('.cart-remove-btn').forEach(btn => {
            btn.addEventListener('click', () => removeItem(btn.dataset.id));
        });

        document.getElementById('cartClearBtn')?.addEventListener('click', clearCart);
        document.getElementById('cartCheckoutBtn')?.addEventListener('click', () => {
            checkoutMode = true;
            render();
        });
        document.getElementById('checkoutBackBtn')?.addEventListener('click', () => {
            checkoutMode = false;
            render();
        });
        document.getElementById('checkoutForm')?.addEventListener('submit', onCheckout);
        document.getElementById('orderDoneBtn')?.addEventListener('click', () => {
            orderResult = null;
            checkoutMode = false;
            panelOpen = false;
            render();
        });
    }

    function renderCartItems() {
        if (cartItems.length === 0) {
            return '<p class="cart-empty">Your cart is empty</p>';
        }

        return `
            <div class="cart-items">
                ${cartItems.map(item => `
                    <div class="cart-item">
                        <div class="cart-item-info">
                            <span class="cart-item-name">${item.product_name}</span>
                            <span class="cart-item-price">${item.product_price.toFixed(2)}</span>
                        </div>
                        <div class="cart-item-controls">
                            <button class="cart-qty-btn" data-id="${item.id}" data-dir="-1">−</button>
                            <span class="cart-item-qty">${item.quantity}</span>
                            <button class="cart-qty-btn" data-id="${item.id}" data-dir="1">+</button>
                            <span class="cart-item-subtotal">${(item.product_price * item.quantity).toFixed(2)}</span>
                            <button class="cart-remove-btn" data-id="${item.id}">&times;</button>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="cart-footer">
                <div class="cart-total">
                    <span>Total:</span>
                    <strong>${cartTotal.toFixed(2)}</strong>
                </div>
                <button class="cart-checkout-btn" id="cartCheckoutBtn">Checkout</button>
                <button class="cart-clear-btn" id="cartClearBtn">Clear Cart</button>
            </div>
        `;
    }

    function renderCheckoutForm() {
        return `
            <button class="cart-back-btn" id="checkoutBackBtn">&larr; Back to cart</button>
            <div class="cart-checkout-summary">
                <p>${cartItems.length} item(s) — <strong>${cartTotal.toFixed(2)}</strong></p>
            </div>
            <form id="checkoutForm" class="cart-checkout-form">
                <div class="form-group">
                    <label>Name *</label>
                    <input type="text" name="client_name" required placeholder="Your name">
                </div>
                <div class="form-group">
                    <label>Phone *</label>
                    <input type="tel" name="client_phone" required placeholder="+48...">
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" name="client_email" placeholder="your@email.com">
                </div>
                <div class="form-group">
                    <label>Delivery address</label>
                    <input type="text" name="client_address" placeholder="Address">
                </div>
                <div class="form-group">
                    <label>Notes</label>
                    <textarea name="notes" rows="2" placeholder="Any special requests..."></textarea>
                </div>
                <button type="submit" class="cart-checkout-btn">Place Order</button>
            </form>
        `;
    }

    function renderOrderConfirmation() {
        return `
            <div class="cart-order-confirm">
                <div class="cart-order-check">&#10003;</div>
                <h3>Order Placed!</h3>
                <p>Your order <strong>${orderResult.order_number}</strong> has been created.</p>
                <p>Total: <strong>${orderResult.total.toFixed(2)}</strong></p>
                <p class="cart-order-msg">We'll contact you shortly to confirm your order.</p>
                <button class="cart-checkout-btn" id="orderDoneBtn">Done</button>
            </div>
        `;
    }

    function togglePanel() {
        panelOpen = !panelOpen;
        if (panelOpen && !orderResult) {
            checkoutMode = false;
            loadCart().then(render);
        } else {
            render();
        }
    }

    function updateBadge() {
        const badge = document.getElementById('cartBadge');
        if (badge) {
            badge.textContent = cartCount;
            badge.style.display = cartCount > 0 ? 'flex' : 'none';
        }
    }

    async function loadCart() {
        try {
            const res = await fetch(`${API}/cart/cart`, { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                cartItems = data.items || [];
                cartTotal = data.total || 0;
                cartCount = data.count || 0;
            }
        } catch (e) {}
    }

    async function updateQuantity(id, qty) {
        try {
            await fetch(`${API}/cart/cart/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantity: qty }),
                credentials: 'include'
            });
            await loadCart();
            render();
        } catch (e) {}
    }

    async function removeItem(id) {
        try {
            await fetch(`${API}/cart/cart/${id}`, { method: 'DELETE', credentials: 'include' });
            await loadCart();
            render();
        } catch (e) {}
    }

    async function clearCart() {
        try {
            await fetch(`${API}/cart/cart`, { method: 'DELETE', credentials: 'include' });
            cartItems = [];
            cartTotal = 0;
            cartCount = 0;
            render();
        } catch (e) {}
    }

    async function onCheckout(e) {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());

        try {
            const res = await fetch(`${API}/cart/checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                credentials: 'include'
            });

            if (res.ok) {
                orderResult = await res.json();
                cartItems = [];
                cartTotal = 0;
                cartCount = 0;
                checkoutMode = false;
                render();
            } else {
                const err = await res.json();
                alert(err.error || 'Checkout failed');
            }
        } catch (e) {
            alert('Connection error');
        }
    }

    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
        .cart-float-btn {
            position: fixed; bottom: 24px; right: 24px; width: 56px; height: 56px;
            background: var(--primary-color, #4CAF50); color: #fff; border-radius: 50%;
            display: flex; align-items: center; justify-content: center; cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2); z-index: 9990; transition: transform 0.3s;
        }
        .cart-float-btn:hover { transform: scale(1.1); }
        .cart-badge {
            position: absolute; top: -4px; right: -4px; width: 22px; height: 22px;
            background: #f44336; color: #fff; border-radius: 50%; font-size: 12px;
            display: flex; align-items: center; justify-content: center; font-weight: bold;
        }
        .cart-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.4); z-index: 9991; opacity: 0; pointer-events: none; transition: opacity 0.3s;
        }
        .cart-overlay.open { opacity: 1; pointer-events: all; }
        .cart-panel {
            position: fixed; top: 0; right: -400px; width: 380px; height: 100%;
            background: #fff; z-index: 9992; transition: right 0.3s; display: flex; flex-direction: column;
            box-shadow: -4px 0 20px rgba(0,0,0,0.1);
        }
        .cart-panel.open { right: 0; }
        .cart-panel-header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 16px 20px; border-bottom: 1px solid #eee;
        }
        .cart-panel-header h3 { margin: 0; font-size: 18px; }
        .cart-panel-close { background: none; border: none; font-size: 28px; cursor: pointer; color: #999; }
        .cart-panel-body { flex: 1; overflow-y: auto; padding: 16px 20px; }
        .cart-items { display: flex; flex-direction: column; gap: 12px; }
        .cart-item { padding: 12px; border: 1px solid #eee; border-radius: 8px; }
        .cart-item-info { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .cart-item-name { font-weight: 500; font-size: 14px; }
        .cart-item-price { color: #777; font-size: 13px; }
        .cart-item-controls { display: flex; align-items: center; gap: 8px; }
        .cart-qty-btn {
            width: 28px; height: 28px; border: 1px solid #ddd; background: #f9f9f9;
            border-radius: 4px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center;
        }
        .cart-item-qty { min-width: 20px; text-align: center; font-weight: 500; }
        .cart-item-subtotal { margin-left: auto; font-weight: 600; font-size: 14px; }
        .cart-remove-btn { background: none; border: none; color: #f44336; cursor: pointer; font-size: 20px; padding: 0 4px; }
        .cart-footer { margin-top: 20px; padding-top: 16px; border-top: 1px solid #eee; }
        .cart-total { display: flex; justify-content: space-between; font-size: 18px; margin-bottom: 16px; }
        .cart-checkout-btn {
            width: 100%; padding: 12px; background: var(--primary-color, #4CAF50); color: #fff;
            border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: opacity 0.3s;
        }
        .cart-checkout-btn:hover { opacity: 0.9; }
        .cart-clear-btn {
            width: 100%; padding: 8px; background: none; border: none; color: #999;
            cursor: pointer; font-size: 13px; margin-top: 8px;
        }
        .cart-clear-btn:hover { color: #f44336; }
        .cart-empty { text-align: center; color: #999; padding: 40px 0; }
        .cart-back-btn { background: none; border: none; color: var(--primary-color, #4CAF50); cursor: pointer; font-size: 14px; padding: 0; margin-bottom: 16px; }
        .cart-checkout-summary { padding: 12px; background: #f9f9f9; border-radius: 8px; margin-bottom: 16px; text-align: center; }
        .cart-checkout-form .form-group { margin-bottom: 12px; }
        .cart-checkout-form label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 4px; }
        .cart-checkout-form input, .cart-checkout-form textarea {
            width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; box-sizing: border-box;
        }
        .cart-checkout-form textarea { resize: vertical; }
        .cart-order-confirm { text-align: center; padding: 40px 0; }
        .cart-order-check { font-size: 48px; color: var(--primary-color, #4CAF50); margin-bottom: 16px; }
        .cart-order-confirm h3 { margin: 0 0 12px; }
        .cart-order-msg { color: #777; margin: 16px 0; }
        @media (max-width: 420px) { .cart-panel { width: 100%; right: -100%; } }
    `;
    document.head.appendChild(style);

    // Initial load & render
    loadCart().then(() => render());
});
