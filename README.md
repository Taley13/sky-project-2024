# Sky Template

Production-ready website template with admin panel, built on Node.js + Express + SQLite.

## Features

- Multi-language support (EN, DE, RU)
- Admin panel with authentication and role-based access
- SQLite database (zero configuration)
- Telegram notifications for orders/contacts
- Security: Helmet, CSRF, Rate Limiting, bcrypt
- Responsive design
- SEO-ready structure
- Business example modules (Booking, Catalog, Subscription)

## Quick Start

```bash
# 1. Run the setup wizard
./scripts/setup.sh

# 2. Start admin panel
cd admin-panel && npm start

# 3. Start frontend (in another terminal)
cd frontend && npx http-server -p 3000

# 4. Open
#    Site:  http://localhost:3000
#    Admin: http://localhost:7001
```

## Project Structure

```
Sky/
├── frontend/           # Public website
│   ├── index.html      # Home page
│   ├── services.html   # Services/catalog page
│   ├── contacts.html   # Contact page
│   ├── css/            # Stylesheets
│   ├── js/             # Scripts
│   │   ├── config.js   # Site configuration
│   │   ├── main.js     # Core functionality
│   │   ├── i18n.js     # Localization system
│   │   └── examples/   # Business module examples
│   ├── locales/        # Translation files (EN, DE, RU)
│   └── images/         # Images
│
├── admin-panel/        # Admin dashboard
│   ├── server.js       # Express server
│   ├── routes/         # API routes
│   │   ├── auth.js     # Authentication
│   │   ├── categories.js
│   │   ├── products.js
│   │   ├── orders.js
│   │   ├── public.js   # Public API (no auth)
│   │   ├── telegram.js # Notifications
│   │   └── examples/   # Business module examples
│   ├── public/         # Admin UI
│   └── middleware/     # Auth & roles
│
├── scripts/
│   ├── setup.sh        # Interactive setup wizard
│   └── deploy.sh       # Deployment script
│
└── docs/               # Documentation
```

## Configuration

### Setup Wizard (Recommended)

Run `./scripts/setup.sh` - it will ask for company name, domain, colors, etc. and configure everything automatically.

### Manual Configuration

1. Copy `.env.example` to `.env` in `admin-panel/`
2. Edit placeholder values in `frontend/js/config.js`
3. Edit translations in `frontend/locales/*.json`
4. Edit CSS variables in `frontend/css/styles.css`

## Business Modules

### Booking (`examples/booking.js`)
Time slot booking system for service businesses.
- Services management
- Availability checking
- Booking with client info

### Catalog (`examples/catalog.js`)
Extended product catalog with SKU, stock, multiple images.
- Product CRUD with images
- Categories and search
- Price sorting

### Subscription (`examples/subscription.js`)
Subscription plans management.
- Plan creation and management
- Client subscriptions
- Payment tracking
- Revenue stats

To enable a module, the setup wizard can copy it for you, or manually:
```bash
cp admin-panel/routes/examples/booking.js admin-panel/routes/booking.js
```
Then add to `server.js`:
```javascript
const bookingRoutes = require('./routes/booking');
app.use('/api/bookings', bookingRoutes(dbHelpers, requireAuth));
```

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## API Reference

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## License

MIT
# sky-project-2024
