/**
 * Sky Template - i18n Internationalization System
 * Supports: EN, DE, RU
 */
class I18n {
    constructor() {
        this.translations = {};
        this.currentLang = localStorage.getItem('sky-lang') || window.SITE_CONFIG?.DEFAULT_LANG || 'en';
        this.supportedLangs = window.SITE_CONFIG?.SUPPORTED_LANGS || ['en', 'de', 'ru'];
    }

    async load(lang) {
        if (!this.supportedLangs.includes(lang)) lang = this.supportedLangs[0];
        try {
            const response = await fetch(`locales/${lang}.json?v=${Date.now()}`);
            if (!response.ok) throw new Error(`Failed to load ${lang}.json`);
            this.translations[lang] = await response.json();
            this.currentLang = lang;
            localStorage.setItem('sky-lang', lang);
        } catch (e) {
            console.error('i18n load error:', e);
        }
    }

    t(key) {
        const keys = key.split('.');
        let value = this.translations[this.currentLang];
        for (const k of keys) {
            if (!value || typeof value !== 'object') return key;
            value = value[k];
        }
        return value || key;
    }

    updateDOM() {
        // Text content
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            const translation = this.t(key);
            if (translation !== key) {
                if (el.hasAttribute('data-i18n-html')) {
                    el.innerHTML = translation;
                } else {
                    el.textContent = translation;
                }
            }
        });

        // Placeholders
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            const translation = this.t(key);
            if (translation !== key) el.placeholder = translation;
        });

        // Title
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            const translation = this.t(key);
            if (translation !== key) el.title = translation;
        });
    }

    async setCurrentLang(lang) {
        await this.load(lang);
        this.updateDOM();

        // Update language buttons
        document.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === lang);
        });

        // Dispatch event for other scripts
        window.dispatchEvent(new CustomEvent('langChanged', { detail: { lang } }));
    }

    getCurrentLang() { return this.currentLang; }
}

// Initialize
const i18n = new I18n();

document.addEventListener('DOMContentLoaded', async () => {
    await i18n.load(i18n.currentLang);
    i18n.updateDOM();

    // Language switcher
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.addEventListener('click', () => i18n.setCurrentLang(btn.dataset.lang));
    });

    // Set active language button
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === i18n.currentLang);
    });
});
