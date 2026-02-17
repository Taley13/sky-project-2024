/**
 * Sky Template - Contacts Page
 */
document.addEventListener('DOMContentLoaded', () => {
    const CONFIG = window.SITE_CONFIG || {};
    const API = CONFIG.API_BASE_URL || '/api';
    const SITE = CONFIG.SITE_KEY || 'default';

    // Load contacts from API
    async function loadContacts() {
        try {
            const res = await fetch(`${API}/public/contacts/${SITE}`);
            if (!res.ok) return;
            const data = await res.json();

            const phone = document.getElementById('contactPhone');
            const email = document.getElementById('contactEmail');

            if (phone && data.phone) phone.href = data.phone;
            if (email && data.email) email.href = `mailto:${data.email}`;
        } catch (e) {
            // Contacts API unavailable
        }
    }

    loadContacts();

    // Contact form
    const form = document.getElementById('contactForm');
    const success = document.getElementById('formSuccess');

    if (form) {
        // Validation function
        function validateForm(data) {
            const errors = [];

            // Name validation
            if (!data.name || data.name.trim().length < 2) {
                errors.push('Name must be at least 2 characters');
            }

            // Phone validation (basic - at least 7 digits)
            const phoneDigits = data.phone.replace(/\D/g, '');
            if (!data.phone || phoneDigits.length < 7) {
                errors.push('Phone must have at least 7 digits');
            }

            // Email validation (if provided)
            if (data.email) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(data.email)) {
                    errors.push('Email is invalid');
                }
            }

            // Comment validation (if provided)
            if (data.comment && data.comment.trim().length > 1000) {
                errors.push('Message is too long (max 1000 characters)');
            }

            return errors;
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            // Client-side validation
            const errors = validateForm(data);
            if (errors.length > 0) {
                alert('Please fix the following errors:\n\n' + errors.join('\n'));
                return;
            }

            try {
                const res = await fetch(`${API}/orders`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: data.name.trim(),
                        phone: data.phone.trim(),
                        email: data.email?.trim() || '',
                        comment: data.comment?.trim() || '',
                        page: 'contacts'
                    })
                });

                const contentType = res.headers.get('content-type') || '';
                if (!contentType.includes('application/json')) {
                    // Server cold start — retry once
                    await new Promise(r => setTimeout(r, 3000));
                    const retry = await fetch(`${API}/orders`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            name: data.name.trim(), phone: data.phone.trim(),
                            email: data.email?.trim() || '', comment: data.comment?.trim() || '', page: 'contacts'
                        })
                    });
                    if (retry.ok) { form.style.display = 'none'; if (success) success.style.display = 'block'; }
                    else alert('Server unavailable, please try again.');
                    return;
                }

                if (res.ok) {
                    form.style.display = 'none';
                    if (success) success.style.display = 'block';
                } else {
                    const error = await res.json();
                    alert(error.error || 'Error sending message. Please try again.');
                }
            } catch (e) {
                alert('Connection error. Please try again later.');
            }
        });
    }
});
