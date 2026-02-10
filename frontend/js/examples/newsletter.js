/**
 * Sky Template - Newsletter Frontend Example
 * Email subscription form widget
 *
 * Required HTML:
 *   <div id="newsletterWidget"></div>
 *   <script src="js/config.js"></script>
 *   <script src="js/examples/newsletter.js"></script>
 */
document.addEventListener('DOMContentLoaded', () => {
    const CONFIG = window.SITE_CONFIG || {};
    const API = CONFIG.API_BASE_URL || '/api';

    const widget = document.getElementById('newsletterWidget');
    if (!widget) return;

    function render() {
        widget.innerHTML = `
            <div class="newsletter-widget">
                <div class="newsletter-content">
                    <h3 class="newsletter-title">Stay Updated</h3>
                    <p class="newsletter-desc">Subscribe to our newsletter for the latest news and updates.</p>
                    <form id="newsletterForm" class="newsletter-form">
                        <div class="newsletter-input-group">
                            <input type="email" name="email" required placeholder="Enter your email" class="newsletter-input">
                            <button type="submit" class="newsletter-btn">Subscribe</button>
                        </div>
                        <p class="newsletter-error" id="newsletterError" style="display:none;"></p>
                    </form>
                    <div id="newsletterSuccess" class="newsletter-success" style="display:none;">
                        <span class="newsletter-check">&#10003;</span>
                        <p>Thank you for subscribing!</p>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('newsletterForm')?.addEventListener('submit', onSubscribe);
    }

    async function onSubscribe(e) {
        e.preventDefault();
        const email = e.target.querySelector('[name="email"]').value;
        const errorEl = document.getElementById('newsletterError');
        errorEl.style.display = 'none';

        try {
            const res = await fetch(`${API}/newsletter/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            if (res.ok) {
                document.getElementById('newsletterForm').style.display = 'none';
                document.getElementById('newsletterSuccess').style.display = 'block';
            } else {
                const err = await res.json();
                errorEl.textContent = err.error || 'Subscription failed';
                errorEl.style.display = 'block';
            }
        } catch (e) {
            errorEl.textContent = 'Connection error';
            errorEl.style.display = 'block';
        }
    }

    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
        .newsletter-widget {
            background: linear-gradient(135deg, var(--primary-color, #4CAF50), #2E7D32);
            border-radius: 12px; padding: 40px; text-align: center; color: #fff;
        }
        .newsletter-content { max-width: 500px; margin: 0 auto; }
        .newsletter-title { font-size: 24px; margin: 0 0 8px; }
        .newsletter-desc { margin: 0 0 20px; opacity: 0.9; font-size: 15px; }
        .newsletter-input-group { display: flex; gap: 8px; }
        .newsletter-input {
            flex: 1; padding: 12px 16px; border: none; border-radius: 8px;
            font-size: 15px; outline: none;
        }
        .newsletter-btn {
            padding: 12px 24px; background: #fff; color: var(--primary-color, #4CAF50);
            border: none; border-radius: 8px; font-weight: bold; cursor: pointer;
            font-size: 15px; white-space: nowrap; transition: opacity 0.3s;
        }
        .newsletter-btn:hover { opacity: 0.9; }
        .newsletter-error { color: #ffcdd2; font-size: 13px; margin: 8px 0 0; }
        .newsletter-success { padding: 10px 0; }
        .newsletter-check { font-size: 36px; display: block; margin-bottom: 8px; }
        .newsletter-success p { margin: 0; font-size: 16px; }
        @media (max-width: 480px) {
            .newsletter-input-group { flex-direction: column; }
            .newsletter-widget { padding: 24px; }
        }
    `;
    document.head.appendChild(style);

    render();
});
