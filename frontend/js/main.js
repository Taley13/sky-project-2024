/**
 * Sky Template - Main Script
 */
document.addEventListener('DOMContentLoaded', () => {
    const CONFIG = window.SITE_CONFIG || {};
    const API = CONFIG.API_BASE_URL || '/api';
    const SITE = CONFIG.SITE_KEY || 'default';

    // Current year
    const yearEl = document.getElementById('currentYear');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // === Scroll Progress Bar ===
    const progressBar = document.getElementById('scrollProgress');
    if (progressBar) {
        window.addEventListener('scroll', () => {
            const scrolled = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
            progressBar.style.width = scrolled + '%';
        });
    }

    // === Navbar ===
    const navbar = document.getElementById('navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            navbar.classList.toggle('scrolled', window.scrollY > 50);
        });
    }

    // === Hamburger Menu ===
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('navMenu');
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            hamburger.classList.toggle('active');
        });
    }

    // === Load Categories Dropdown ===
    async function loadCategories() {
        try {
            const res = await fetch(`${API}/public/categories/${SITE}`);
            if (!res.ok) return;
            const categories = await res.json();
            const dropdowns = document.querySelectorAll('#categoriesDropdown');
            const lang = (typeof i18n !== 'undefined') ? i18n.getCurrentLang() : 'en';

            dropdowns.forEach(dropdown => {
                dropdown.innerHTML = '';
                categories.forEach(cat => {
                    const name = cat[`name_${lang}`] || cat.name_en || cat.key;
                    const li = document.createElement('li');
                    li.innerHTML = `<a href="services.html#${cat.key}">${name}</a>`;
                    dropdown.appendChild(li);
                });
            });
        } catch (e) {
            // Categories API unavailable
        }
    }

    loadCategories();

    // Reload categories on language change
    window.addEventListener('langChanged', () => loadCategories());

    // === Load Hexagons ===
    async function loadHexagons() {
        if (!CONFIG.ENABLE_HEXAGONS) return;
        const grid = document.getElementById('hexagonsGrid');
        if (!grid) return;

        try {
            const res = await fetch(`${API}/public/hexagons/${SITE}/active`);
            if (!res.ok) return;
            const hexagons = await res.json();
            const lang = (typeof i18n !== 'undefined') ? i18n.getCurrentLang() : 'en';

            grid.innerHTML = '';
            hexagons.forEach(hex => {
                const name = hex[`name_${lang}`] || hex.name_en || hex.key;
                const div = document.createElement('div');
                div.className = 'hexagon-item';
                div.innerHTML = `
                    <span class="hex-icon">${hex.icon_number || ''}</span>
                    <span class="hex-name">${name}</span>
                `;
                div.addEventListener('click', () => {
                    window.location.href = `services.html#${hex.key}`;
                });
                grid.appendChild(div);
            });
        } catch (e) {
            // Hexagons API unavailable
        }
    }

    loadHexagons();
    window.addEventListener('langChanged', () => loadHexagons());

    // === Load Footer Contacts ===
    async function loadContacts() {
        try {
            const res = await fetch(`${API}/public/contacts/${SITE}`);
            if (!res.ok) return;
            const data = await res.json();

            const phone = document.getElementById('footerPhone') || document.getElementById('contactPhone');
            const email = document.getElementById('footerEmail') || document.getElementById('contactEmail');
            const address = document.getElementById('footerAddress') || document.getElementById('contactAddress');

            if (phone && data.phone) phone.textContent = data.phone;
            if (email && data.email) email.textContent = data.email;
            if (address && data.address) address.textContent = data.address;

            // Update all footer phones/emails across all pages
            document.querySelectorAll('#footerPhone').forEach(el => { if (data.phone) el.textContent = data.phone; });
            document.querySelectorAll('#footerEmail').forEach(el => { if (data.email) el.textContent = data.email; });
        } catch (e) {
            // Contacts API unavailable
        }
    }

    loadContacts();
});
