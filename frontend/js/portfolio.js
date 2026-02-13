/**
 * Sky Template - Portfolio Page
 * Dynamic portfolio loading and management
 */

document.addEventListener('DOMContentLoaded', async () => {
    // Wait for i18n to be ready with timeout
    let retries = 0;
    const maxRetries = 50; // 5 seconds max wait

    const waitForI18n = () => {
        return new Promise((resolve) => {
            if (typeof i18n !== 'undefined') {
                resolve();
                return;
            }

            const checkI18n = setInterval(() => {
                retries++;
                if (typeof i18n !== 'undefined') {
                    clearInterval(checkI18n);
                    resolve();
                } else if (retries >= maxRetries) {
                    clearInterval(checkI18n);
                    console.error('i18n failed to load after 5 seconds');
                    resolve(); // Continue anyway
                }
            }, 100);
        });
    };

    await waitForI18n();

    const API = window.SITE_CONFIG?.API_BASE_URL || '/api';
    const SITE = window.SITE_CONFIG?.SITE_KEY || 'mybusiness';

    // === Load Portfolio ===
    async function loadPortfolio(category = 'all') {
        const grid = document.getElementById('portfolioGrid');
        if (!grid) return;

        try {
            // Load from static JSON instead of API
            const res = await fetch('/data/portfolio-projects.json');
            if (!res.ok) return;

            const data = await res.json();
            let projects = data.projects || [];

            // Client-side filtering by category
            if (category !== 'all') {
                projects = projects.filter(p => p.category === category && p.visible);
            } else {
                projects = projects.filter(p => p.visible);
            }

            // Sort by sort_order
            projects.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

            const lang = i18n.getCurrentLang();

            // Clear grid
            while (grid.firstChild) {
                grid.removeChild(grid.firstChild);
            }

            if (projects.length === 0) {
                const noProjectsMsg = document.createElement('p');
                noProjectsMsg.style.textAlign = 'center';
                noProjectsMsg.style.color = 'var(--text-light)';
                noProjectsMsg.style.gridColumn = '1 / -1';
                noProjectsMsg.textContent = 'No projects yet';
                grid.appendChild(noProjectsMsg);
                return;
            }

            projects.forEach(project => {
                const translation = project.translations[lang] || project.translations['en'] || {};
                const title = translation.title || 'Untitled Project';
                const subtitle = translation.subtitle || '';
                const description = translation.description || '';
                const technologies = project.technologies || [];

                // Create card container
                const card = document.createElement('div');
                card.className = 'portfolio-card';
                card.dataset.projectId = project.id;

                // Create gradient header with category and visit button
                const headerDiv = document.createElement('div');
                headerDiv.className = 'portfolio-card-header';
                headerDiv.dataset.category = project.category;

                const categoryLabel = document.createElement('span');
                categoryLabel.className = 'portfolio-card-category';
                const icons = { 'e-commerce': '\uD83D\uDED2', 'corporate': '\uD83C\uDFE2', 'landing': '\uD83D\uDE80' };
                categoryLabel.textContent = (icons[project.category] || '\uD83D\uDCC1') + '  ' + project.category.toUpperCase();
                headerDiv.appendChild(categoryLabel);

                if (project.project_url) {
                    const visitBtn = document.createElement('a');
                    visitBtn.href = project.project_url;
                    visitBtn.target = '_blank';
                    visitBtn.rel = 'noopener noreferrer';
                    visitBtn.className = 'portfolio-visit-btn';
                    visitBtn.setAttribute('data-i18n', 'portfolio.visit_site');
                    visitBtn.textContent = i18n.t('portfolio.visit_site') + ' \u2197';
                    visitBtn.addEventListener('click', (e) => e.stopPropagation());
                    headerDiv.appendChild(visitBtn);
                }

                card.appendChild(headerDiv);

                // Create content section
                const contentDiv = document.createElement('div');
                contentDiv.className = 'portfolio-card-content';

                // Title
                const titleEl = document.createElement('h3');
                titleEl.className = 'portfolio-card-title';
                titleEl.textContent = title;
                contentDiv.appendChild(titleEl);

                // Subtitle
                if (subtitle) {
                    const subtitleEl = document.createElement('p');
                    subtitleEl.className = 'portfolio-card-subtitle';
                    subtitleEl.textContent = subtitle;
                    contentDiv.appendChild(subtitleEl);
                }

                // Description
                if (description) {
                    const descEl = document.createElement('p');
                    descEl.className = 'portfolio-card-description';
                    descEl.textContent = description;
                    contentDiv.appendChild(descEl);
                }

                // Footer
                const footer = document.createElement('div');
                footer.className = 'portfolio-card-footer';

                // Technologies
                const techDiv = document.createElement('div');
                techDiv.className = 'portfolio-card-technologies';
                technologies.slice(0, 3).forEach(tech => {
                    const tag = document.createElement('span');
                    tag.className = 'portfolio-tech-tag';
                    tag.textContent = tech;
                    techDiv.appendChild(tag);
                });
                footer.appendChild(techDiv);

                // Link
                const link = document.createElement('a');
                link.href = '#';
                link.className = 'portfolio-card-link';
                link.setAttribute('data-i18n', 'portfolio.view_project');
                link.textContent = i18n.t('portfolio.view_project');
                footer.appendChild(link);

                contentDiv.appendChild(footer);
                card.appendChild(contentDiv);

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

        // Clear modal body
        while (modalBody.firstChild) {
            modalBody.removeChild(modalBody.firstChild);
        }

        // Title
        const titleEl = document.createElement('h2');
        titleEl.textContent = title;
        modalBody.appendChild(titleEl);

        // Subtitle
        if (subtitle) {
            const subtitleEl = document.createElement('h3');
            subtitleEl.textContent = subtitle;
            modalBody.appendChild(subtitleEl);
        }

        // Description
        if (description) {
            const descEl = document.createElement('p');
            descEl.textContent = description;
            modalBody.appendChild(descEl);
        }

        // Technologies
        if (technologies.length > 0) {
            const techDiv = document.createElement('div');
            techDiv.className = 'portfolio-modal-technologies';
            technologies.forEach(tech => {
                const tag = document.createElement('span');
                tag.className = 'portfolio-tech-tag';
                tag.textContent = tech;
                techDiv.appendChild(tag);
            });
            modalBody.appendChild(techDiv);
        }

        // Link to project
        if (project.project_url) {
            const link = document.createElement('a');
            link.href = project.project_url;
            link.target = '_blank';
            link.className = 'portfolio-modal-btn';
            const linkText = document.createElement('span');
            linkText.setAttribute('data-i18n', 'portfolio.visit_site');
            linkText.textContent = i18n.t('portfolio.visit_site');
            link.appendChild(linkText);
            const arrow = document.createElement('span');
            arrow.textContent = '↗';
            link.appendChild(arrow);
            modalBody.appendChild(link);
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
    function setupFilterListeners() {
        const portfolioFilters = document.querySelectorAll('.portfolio-filter-btn');
        portfolioFilters.forEach(btn => {
            // Remove old listener if exists
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
        });

        // Add fresh listeners
        const freshFilters = document.querySelectorAll('.portfolio-filter-btn');
        freshFilters.forEach(btn => {
            btn.addEventListener('click', () => {
                freshFilters.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const category = btn.dataset.category;
                loadPortfolio(category);
            });
        });
    }

    setupFilterListeners();

    // === Modal Close Handlers (single instance) ===
    const portfolioModalClose = document.getElementById('portfolioModalClose');
    if (portfolioModalClose) {
        // Clone to remove old listeners
        const newClose = portfolioModalClose.cloneNode(true);
        portfolioModalClose.parentNode.replaceChild(newClose, portfolioModalClose);
        newClose.addEventListener('click', closePortfolioModal);
    }

    const portfolioModal = document.getElementById('portfolioModal');
    if (portfolioModal) {
        const overlay = portfolioModal.querySelector('.portfolio-modal-overlay');
        if (overlay) {
            // Clone to remove old listeners
            const newOverlay = overlay.cloneNode(true);
            overlay.parentNode.replaceChild(newOverlay, overlay);
            newOverlay.addEventListener('click', closePortfolioModal);
        }
    }

    // Close modal on Escape key (single listener)
    const handleEscapeKey = (e) => {
        if (e.key === 'Escape' && portfolioModal?.classList.contains('active')) {
            closePortfolioModal();
        }
    };
    document.removeEventListener('keydown', handleEscapeKey);
    document.addEventListener('keydown', handleEscapeKey);

    // Load portfolio on page load
    loadPortfolio();

    // Reload portfolio on language change (single instance)
    const handleLanguageChange = () => {
        const activeFilter = document.querySelector('.portfolio-filter-btn.active');
        const category = activeFilter ? activeFilter.dataset.category : 'all';
        loadPortfolio(category);
        setupFilterListeners();
    };
    window.removeEventListener('langChanged', handleLanguageChange);
    window.addEventListener('langChanged', handleLanguageChange);
});
