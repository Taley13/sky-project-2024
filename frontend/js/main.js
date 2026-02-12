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

    // === Smooth Scroll for Anchor Links ===
    function setupAnchorLinks() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            // Clone to remove old listeners
            const newAnchor = anchor.cloneNode(true);
            anchor.parentNode.replaceChild(newAnchor, anchor);

            newAnchor.addEventListener('click', function (e) {
                const href = this.getAttribute('href');
                if (href !== '#') {
                    e.preventDefault();
                    const target = document.querySelector(href);
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth' });
                        // Close mobile menu if open
                        const navMenu = document.getElementById('navMenu');
                        const hamburger = document.getElementById('hamburger');
                        if (navMenu && hamburger) {
                            navMenu.classList.remove('active');
                            hamburger.classList.remove('active');
                        }
                    }
                }
            });
        });
    }

    setupAnchorLinks();

    // === Scroll Progress Bar & Navbar ===
    const progressBar = document.getElementById('scrollProgress');
    const navbar = document.getElementById('navbar');

    const handleScroll = () => {
        if (progressBar) {
            const scrolled = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
            progressBar.style.width = scrolled + '%';
        }
        if (navbar) {
            navbar.classList.toggle('scrolled', window.scrollY > 50);
        }
    };

    // Remove old listener and add fresh one
    window.removeEventListener('scroll', handleScroll);
    window.addEventListener('scroll', handleScroll, { passive: true });

    // === Hamburger Menu ===
    function setupHamburgerMenu() {
        const hamburger = document.getElementById('hamburger');
        const navMenu = document.getElementById('navMenu');
        if (hamburger && navMenu) {
            // Clone to remove old listeners
            const newHamburger = hamburger.cloneNode(true);
            hamburger.parentNode.replaceChild(newHamburger, hamburger);

            newHamburger.addEventListener('click', () => {
                const isOpen = navMenu.classList.toggle('active');
                newHamburger.classList.toggle('active');
                newHamburger.setAttribute('aria-expanded', isOpen);
            });
        }
    }

    setupHamburgerMenu();

    // === Load Categories Dropdown ===
    async function loadCategories() {
        try {
            const res = await fetch(`${API}/public/categories/${SITE}`);
            if (!res.ok) return;
            const categories = await res.json();
            const dropdowns = document.querySelectorAll('#categoriesDropdown');
            const lang = (typeof i18n !== 'undefined') ? i18n.getCurrentLang() : 'en';

            dropdowns.forEach(dropdown => {
                // Clear dropdown
                while (dropdown.firstChild) {
                    dropdown.removeChild(dropdown.firstChild);
                }
                categories.forEach(cat => {
                    const name = cat[`name_${lang}`] || cat.name_en || cat.key;
                    const li = document.createElement('li');
                    const link = document.createElement('a');
                    link.href = `services.html#${cat.key}`;
                    link.textContent = name;
                    li.appendChild(link);
                    dropdown.appendChild(li);
                });
            });
        } catch (e) {
            // Categories API unavailable
        }
    }

    loadCategories();

    // Reload categories on language change (single listener)
    const handleCategoryLanguageChange = () => {
        loadCategories();
        setupAnchorLinks();
    };
    window.removeEventListener('langChanged', handleCategoryLanguageChange);
    window.addEventListener('langChanged', handleCategoryLanguageChange);

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

            // Clear grid
            while (grid.firstChild) {
                grid.removeChild(grid.firstChild);
            }

            hexagons.forEach(hex => {
                const name = hex[`name_${lang}`] || hex.name_en || hex.key;
                const div = document.createElement('div');
                div.className = 'hexagon-item';

                const icon = document.createElement('span');
                icon.className = 'hex-icon';
                icon.textContent = hex.icon_number || '';
                div.appendChild(icon);

                const hexName = document.createElement('span');
                hexName.className = 'hex-name';
                hexName.textContent = name;
                div.appendChild(hexName);

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

    const handleHexagonLanguageChange = () => loadHexagons();
    window.removeEventListener('langChanged', handleHexagonLanguageChange);
    window.addEventListener('langChanged', handleHexagonLanguageChange);

    // === Load Footer Contacts ===
    async function loadContacts() {
        try {
            const res = await fetch(`${API}/public/contacts/${SITE}`);
            if (!res.ok) return;
            const data = await res.json();

            const phone = document.getElementById('footerPhone') || document.getElementById('contactPhone');
            const email = document.getElementById('footerEmail') || document.getElementById('contactEmail');

            if (phone && data.phone) phone.href = data.phone;
            if (email && data.email) email.href = `mailto:${data.email}`;

            // Update all footer phones/emails across all pages
            document.querySelectorAll('#footerPhone').forEach(el => { if (data.phone) el.href = data.phone; });
            document.querySelectorAll('#footerEmail').forEach(el => { if (data.email) el.href = `mailto:${data.email}`; });
        } catch (e) {
            // Contacts API unavailable
        }
    }

    loadContacts();
});
