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
            const address = document.getElementById('contactAddress');

            if (phone && data.phone) phone.textContent = data.phone;
            if (email && data.email) email.textContent = data.email;
            if (address) {
                const addr = [data.address, data.address_line2].filter(Boolean).join(', ');
                address.textContent = addr || address.textContent;
            }
        } catch (e) {
            // Contacts API unavailable
        }
    }

    loadContacts();

    // Contact form
    const form = document.getElementById('contactForm');
    const success = document.getElementById('formSuccess');

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            try {
                const res = await fetch(`${API}/telegram/spec-contact`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                if (res.ok) {
                    form.style.display = 'none';
                    if (success) success.style.display = 'block';
                } else {
                    alert('Error sending message. Please try again.');
                }
            } catch (e) {
                alert('Connection error. Please try again later.');
            }
        });
    }
});
