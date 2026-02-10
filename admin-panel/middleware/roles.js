/**
 * Role-based access control middleware
 * Roles: admin (full access), accountant (products only)
 */

const requireAdmin = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' });
    }
    next();
};

const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(401).json({ error: 'Unauthorized' });
        } else {
            return res.redirect('/');
        }
    }
    next();
};

module.exports = { requireAdmin, requireAuth };
