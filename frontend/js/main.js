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

    // === Load Portfolio ===
    async function loadPortfolio(category = 'all') {
        const grid = document.getElementById('portfolioGrid');
        if (!grid) return;

        try {
            const url = category === 'all'
                ? `${API}/public/portfolio/${SITE}`
                : `${API}/public/portfolio/${SITE}?category=${category}`;

            const res = await fetch(url);
            if (!res.ok) return;

            const projects = await res.json();
            const lang = (typeof i18n !== 'undefined') ? i18n.getCurrentLang() : 'en';

            grid.innerHTML = '';

            if (projects.length === 0) {
                grid.innerHTML = '<p style="text-align: center; color: var(--text-light); grid-column: 1/-1;">No projects yet</p>';
                return;
            }

            projects.forEach(project => {
                const translation = project.translations[lang] || project.translations['en'] || {};
                const title = translation.title || 'Untitled Project';
                const subtitle = translation.subtitle || '';
                const description = translation.description || '';
                const technologies = project.technologies || [];

                const card = document.createElement('div');
                card.className = 'portfolio-card';
                card.dataset.projectId = project.id;

                card.innerHTML = `
                    <div class="portfolio-card-image">
                        ${project.cover_image ? `<img src="${API.replace('/api', '')}${project.cover_image}" alt="${title}">` : '<div style="height: 100%; display: flex; align-items: center; justify-content: center; color: var(--text-light);">No Image</div>'}
                        <div class="portfolio-card-overlay">
                            <span class="portfolio-card-overlay-text" data-i18n="portfolio.view_details">View Details</span>
                        </div>
                    </div>
                    <div class="portfolio-card-content">
                        <h3 class="portfolio-card-title">${title}</h3>
                        ${subtitle ? `<p class="portfolio-card-subtitle">${subtitle}</p>` : ''}
                        ${description ? `<p class="portfolio-card-description">${description}</p>` : ''}
                        <div class="portfolio-card-footer">
                            <div class="portfolio-card-technologies">
                                ${technologies.slice(0, 3).map(tech => `<span class="portfolio-tech-tag">${tech}</span>`).join('')}
                            </div>
                            <a href="#" class="portfolio-card-link" data-i18n="portfolio.view_project">View</a>
                        </div>
                    </div>
                `;

                // Update translations in card
                if (typeof i18n !== 'undefined') {
                    card.querySelectorAll('[data-i18n]').forEach(el => {
                        const key = el.getAttribute('data-i18n');
                        el.textContent = i18n.t(key);
                    });
                }

                // Open modal on click
                card.addEventListener('click', (e) => {
                    e.preventDefault();
                    openPortfolioModal(project, lang);
                });

                grid.appendChild(card);
            });
        } catch (e) {
            console.error('Failed to load portfolio:', e);
        }
    }

    // === Open Portfolio Modal ===
    function openPortfolioModal(project, lang) {
        const modal = document.getElementById('portfolioModal');
        const modalBody = document.getElementById('portfolioModalBody');
        if (!modal || !modalBody) return;

        const translation = project.translations[lang] || project.translations['en'] || {};
        const title = translation.title || 'Untitled Project';
        const subtitle = translation.subtitle || '';
        const description = translation.description || '';
        const technologies = project.technologies || [];

        modalBody.innerHTML = `
            <h2>${title}</h2>
            ${subtitle ? `<h3>${subtitle}</h3>` : ''}
            ${project.cover_image ? `<img src="${API.replace('/api', '')}${project.cover_image}" alt="${title}" class="portfolio-modal-image">` : ''}
            ${description ? `<p>${description}</p>` : ''}
            ${technologies.length > 0 ? `
                <div class="portfolio-modal-technologies">
                    ${technologies.map(tech => `<span class="portfolio-tech-tag">${tech}</span>`).join('')}
                </div>
            ` : ''}
            ${project.project_url ? `
                <a href="${project.project_url}" target="_blank" class="portfolio-modal-btn">
                    <span data-i18n="portfolio.visit_site">Visit Website</span>
                    <span>↗</span>
                </a>
            ` : ''}
        `;

        // Update translations in modal
        if (typeof i18n !== 'undefined') {
            modalBody.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                el.textContent = i18n.t(key);
            });
        }

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    // === Close Portfolio Modal ===
    function closePortfolioModal() {
        const modal = document.getElementById('portfolioModal');
        if (!modal) return;

        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    // === Portfolio Filters ===
    const portfolioFilters = document.querySelectorAll('.portfolio-filter-btn');
    portfolioFilters.forEach(btn => {
        btn.addEventListener('click', () => {
            portfolioFilters.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const category = btn.dataset.category;
            loadPortfolio(category);
        });
    });

    // === Modal Close Handlers ===
    const portfolioModalClose = document.getElementById('portfolioModalClose');
    if (portfolioModalClose) {
        portfolioModalClose.addEventListener('click', closePortfolioModal);
    }

    const portfolioModal = document.getElementById('portfolioModal');
    if (portfolioModal) {
        portfolioModal.querySelector('.portfolio-modal-overlay')?.addEventListener('click', closePortfolioModal);

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && portfolioModal.classList.contains('active')) {
                closePortfolioModal();
            }
        });
    }

    // Load portfolio on page load
    loadPortfolio();

    // Reload portfolio on language change
    window.addEventListener('langChanged', () => {
        const activeFilter = document.querySelector('.portfolio-filter-btn.active');
        const category = activeFilter ? activeFilter.dataset.category : 'all';
        loadPortfolio(category);
    });
});
