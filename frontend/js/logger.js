/**
 * Sky Template - Logger Utility
 * Controls console output based on environment
 */

const Logger = (() => {
    const isDev = window.SITE_CONFIG?.ENVIRONMENT === 'development' ||
                  window.location.hostname === 'localhost' ||
                  window.location.hostname === '127.0.0.1';

    return {
        // Always log errors even in production
        error: (message, error) => {
            if (isDev) {
                console.error(`[ERROR] ${message}`, error);
            } else {
                // Silent in production, could send to error tracking service
            }
        },

        // Only log warnings in development
        warn: (message) => {
            if (isDev) {
                console.warn(`[WARN] ${message}`);
            }
        },

        // Only log info in development
        info: (message) => {
            if (isDev) {
                console.info(`[INFO] ${message}`);
            }
        },

        // Only log debug in development
        debug: (message) => {
            if (isDev) {
                console.debug(`[DEBUG] ${message}`);
            }
        }
    };
})();
