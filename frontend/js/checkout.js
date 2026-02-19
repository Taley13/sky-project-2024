/**
 * Sky Store — Checkout Page
 * Based on contacts.js, extended with cart summary and address
 */
document.addEventListener('DOMContentLoaded', () => {
    const CONFIG = window.SITE_CONFIG || {};
    const API = CONFIG.API_BASE_URL || '/api';

    // Render cart summary
    SkyCart.renderCartSummary('checkoutCartSummary');

    // Re-render on cart changes
    window.addEventListener('cartChanged', () => {
        SkyCart.renderCartSummary('checkoutCartSummary');
    });

    // Phone mask +7 XXX XXX-XX-XX
    const phoneInput = document.querySelector('#checkoutForm input[name="phone"]');
    if (phoneInput) {
        phoneInput.addEventListener('input', () => {
            let digits = phoneInput.value.replace(/\D/g, '');
            if (!digits) { phoneInput.value = ''; return; }
            if (digits.startsWith('8') && digits.length > 1) digits = '7' + digits.slice(1);
            let formatted = '+';
            for (let i = 0; i < Math.min(digits.length, 11); i++) {
                if (i === 1) formatted += ' ';
                if (i === 4) formatted += ' ';
                if (i === 7) formatted += '-';
                if (i === 9) formatted += '-';
                formatted += digits[i];
            }
            phoneInput.value = formatted;
        });
    }

    // Form submission
    const form = document.getElementById('checkoutForm');
    const success = document.getElementById('orderSuccess');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const cartState = SkyCart.getState();
        if (cartState.count === 0) {
            alert(localStorage.getItem('sky-lang') === 'ru'
                ? 'Корзина пуста. Добавьте товары перед оформлением.'
                : 'Cart is empty. Add products before checkout.');
            return;
        }

        const data = Object.fromEntries(new FormData(form).entries());

        // Validation
        if (!data.name || data.name.trim().length < 2) {
            alert('Name must be at least 2 characters'); return;
        }
        const phoneDigits = (data.phone || '').replace(/\D/g, '');
        if (phoneDigits.length < 7) {
            alert('Phone must have at least 7 digits'); return;
        }
        if (!data.city || data.city.trim().length < 2) {
            alert('City is required'); return;
        }
        if (!data.address || data.address.trim().length < 3) {
            alert('Address is required'); return;
        }

        // Build order payload
        const payload = {
            name: data.name.trim(),
            phone: data.phone.trim(),
            email: (data.email || '').trim(),
            city: data.city.trim(),
            address: data.address.trim(),
            comment: (data.comment || '').trim(),
            items: cartState.items.map(i => ({
                id: i.id,
                sku: i.sku,
                title: SkyCart.getItemTitle(i),
                price: i.price,
                qty: i.qty
            })),
            total: cartState.total,
            currency: cartState.currency,
            page: 'checkout'
        };

        const submitBtn = form.querySelector('button[type="submit"]');
        try {
            submitBtn.disabled = true;
            submitBtn.textContent = localStorage.getItem('sky-lang') === 'ru' ? 'Отправка...' : 'Sending...';

            const res = await fetch(`${API}/shop/order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            // Handle cold start (non-JSON response)
            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                await new Promise(r => setTimeout(r, 3000));
                const retry = await fetch(`${API}/shop/order`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!retry.ok) throw new Error('Server unavailable');
                SkyCart.clear();
                form.style.display = 'none';
                if (success) success.style.display = 'block';
                return;
            }

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Order failed');
            }

            SkyCart.clear();
            form.style.display = 'none';
            if (success) success.style.display = 'block';
            // Also hide cart summary
            const cartSection = document.querySelector('.checkout-cart');
            if (cartSection) cartSection.style.display = 'none';

        } catch (err) {
            submitBtn.disabled = false;
            submitBtn.textContent = localStorage.getItem('sky-lang') === 'ru' ? 'Оформить заказ' : 'Place Order';
            alert(err.message || 'Connection error');
        }
    });
});
