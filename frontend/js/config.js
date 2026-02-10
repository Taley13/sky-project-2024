/**
 * Sky Template - Site Configuration
 * Automatically configured for local, staging, and production environments
 */

// Detect API URL based on current location
let API_BASE_URL;
const hostname = window.location.hostname;

if (hostname === 'localhost' || hostname === '127.0.0.1') {
    // Local development
    API_BASE_URL = 'http://localhost:7001/api';
} else if (hostname.includes('render.com')) {
    // Render.com production
    API_BASE_URL = `https://${hostname}/api`;
} else {
    // Default production (your domain + /api route)
    API_BASE_URL = `${window.location.protocol}//${window.location.host}/api`;
}

window.SITE_CONFIG = {
    // API
    API_BASE_URL: API_BASE_URL,
    SITE_KEY: 'mybusiness',

    // i18n
    DEFAULT_LANG: 'en',
    SUPPORTED_LANGS: ['en', 'de', 'ru'],

    // Features
    ENABLE_SEARCH: true,
    ENABLE_TELEGRAM: true,
    ENABLE_HEXAGONS: true,

    // Fallback contacts (used if API unavailable)
    FALLBACK_PHONE: '+XX XXX XXX XXX',
    FALLBACK_EMAIL: '+1234567890',

    // Environment detection
    IS_PRODUCTION: hostname !== 'localhost' && hostname !== '127.0.0.1',
    ENVIRONMENT: hostname === 'localhost' ? 'development' : 'production'
};
