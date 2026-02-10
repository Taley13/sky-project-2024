/**
 * Sky Template - Subscription Frontend Example
 * Pricing page with plan selection and subscription form
 *
 * Required HTML:
 *   <div id="pricingWidget"></div>
 *   <script src="js/config.js"></script>
 *   <script src="js/examples/subscription.js"></script>
 */
document.addEventListener('DOMContentLoaded', () => {
    const CONFIG = window.SITE_CONFIG || {};
    const API = CONFIG.API_BASE_URL || '/api';

    const widget = document.getElementById('pricingWidget');
    if (!widget) return;

    let plans = [];

    function renderPlans() {
        widget.innerHTML = `
            <div class="pricing-widget">
                <div class="pricing-grid">
                    ${plans.map((plan, i) => `
                        <div class="pricing-card ${i === 1 ? 'featured' : ''}">
                            ${i === 1 ? '<span class="pricing-badge">Popular</span>' : ''}
                            <h3 class="pricing-name">${plan.name}</h3>
                            <div class="pricing-price">
                                <span class="price-amount">${plan.price}</span>
                                <span class="price-currency">${plan.currency}</span>
                                <span class="price-interval">/ ${plan.interval_count > 1 ? plan.interval_count + ' ' : ''}${plan.interval}${plan.interval_count > 1 ? 's' : ''}</span>
                            </div>
                            <p class="pricing-desc">${plan.description || ''}</p>
                            <ul class="pricing-features">
                                ${(plan.features || []).map(f => `<li>${f}</li>`).join('')}
                            </ul>
                            <button class="btn btn-primary pricing-btn" data-plan-id="${plan.id}">
                                Subscribe
                            </button>
                        </div>
                    `).join('')}
                </div>

                <!-- Subscribe Modal -->
                <div id="subscribeModal" class="subscribe-modal" style="display:none;">
                    <div class="subscribe-modal-content">
                        <button class="modal-close" id="modalClose">&times;</button>
                        <h3>Subscribe to <span id="selectedPlanName"></span></h3>
                        <form id="subscribeForm">
                            <input type="hidden" name="plan_id" id="selectedPlanId">
                            <div class="form-group">
                                <label>Full Name *</label>
                                <input type="text" name="client_name" required placeholder="Your name">
                            </div>
                            <div class="form-group">
                                <label>Email *</label>
                                <input type="email" name="client_email" required placeholder="your@email.com">
                            </div>
                            <div class="form-group">
                                <label>Phone</label>
                                <input type="tel" name="client_phone" placeholder="+48...">
                            </div>
                            <button type="submit" class="btn btn-primary">Confirm Subscription</button>
                        </form>
                        <div id="subscribeSuccess" style="display:none;" class="subscribe-success">
                            <h4>Welcome aboard!</h4>
                            <p>Your subscription has been created. We'll send you a confirmation email.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Events
        document.querySelectorAll('.pricing-btn').forEach(btn => {
            btn.addEventListener('click', () => openModal(btn.dataset.planId));
        });

        document.getElementById('modalClose')?.addEventListener('click', closeModal);
        document.getElementById('subscribeModal')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeModal();
        });
        document.getElementById('subscribeForm')?.addEventListener('submit', onSubscribe);
    }

    function openModal(planId) {
        const plan = plans.find(p => p.id == planId);
        if (!plan) return;

        document.getElementById('selectedPlanId').value = planId;
        document.getElementById('selectedPlanName').textContent = plan.name;
        document.getElementById('subscribeModal').style.display = 'flex';
        document.getElementById('subscribeForm').style.display = 'block';
        document.getElementById('subscribeSuccess').style.display = 'none';
    }

    function closeModal() {
        document.getElementById('subscribeModal').style.display = 'none';
    }

    async function onSubscribe(e) {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target).entries());

        try {
            const res = await fetch(`${API}/subscriptions/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                e.target.style.display = 'none';
                document.getElementById('subscribeSuccess').style.display = 'block';
            } else {
                const err = await res.json();
                alert(err.error || 'Subscription failed');
            }
        } catch (e) {
            alert('Connection error');
        }
    }

    async function loadPlans() {
        try {
            const res = await fetch(`${API}/subscriptions/plans`);
            if (res.ok) plans = await res.json();
            if (plans.length > 0) renderPlans();
            else widget.innerHTML = '<p>No plans available</p>';
        } catch (e) {
            widget.innerHTML = '<p>Pricing unavailable</p>';
        }
    }

    loadPlans();
});
