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

            newHamburger.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = navMenu.classList.toggle('active');
                newHamburger.classList.toggle('active');
                newHamburger.setAttribute('aria-expanded', isOpen);
                document.body.style.overflow = isOpen ? 'hidden' : '';
            });

            // Close menu on outside click
            document.addEventListener('click', (e) => {
                if (navMenu.classList.contains('active') && !navMenu.contains(e.target)) {
                    navMenu.classList.remove('active');
                    newHamburger.classList.remove('active');
                    newHamburger.setAttribute('aria-expanded', 'false');
                    document.body.style.overflow = '';
                }
            });

            // Close menu on Escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && navMenu.classList.contains('active')) {
                    navMenu.classList.remove('active');
                    newHamburger.classList.remove('active');
                    newHamburger.setAttribute('aria-expanded', 'false');
                    document.body.style.overflow = '';
                }
            });
        }
    }

    setupHamburgerMenu();

});
