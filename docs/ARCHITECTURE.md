# Architecture

## Overview

Sky Template uses a classic client-server architecture:
- **Frontend**: Static HTML/CSS/JS served by any web server
- **Backend**: Node.js/Express API server with SQLite database

## Database Schema

### users
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| username | TEXT | Unique login |
| password | TEXT | bcrypt hash |
| role | TEXT | 'admin' or 'accountant' |

### categories
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| site | TEXT | Multi-site key |
| key | TEXT | URL-friendly slug |
| name_pl/en/de/ru | TEXT | Translated names |
| icon | TEXT | Icon identifier |
| visible | INTEGER | 0 or 1 |
| sort_order | INTEGER | Display order |

### products
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| site | TEXT | Multi-site key |
| category_id | INTEGER | FK to categories |
| product_key | TEXT | Unique key |
| image | TEXT | Image filename |
| price | TEXT | Display price |
| visible | INTEGER | 0 or 1 |

### product_translations
| Column | Type | Description |
|--------|------|-------------|
| product_id | INTEGER | FK to products |
| lang | TEXT | Language code |
| title | TEXT | Product title |
| subtitle | TEXT | Short description |
| description | TEXT | Full description |

### orders
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| site | TEXT | Multi-site key |
| name/phone/email | TEXT | Client info |
| status | TEXT | new/processing/done |
| product_key | TEXT | Related product |

### contacts
| Column | Type | Description |
|--------|------|-------------|
| site | TEXT | Multi-site key |
| phone/email/address | TEXT | Contact info |
| telegram | TEXT | Telegram link |

## API Endpoints

### Public (no auth)
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/public/categories/:site | Get visible categories |
| GET | /api/public/products/:site/:categoryId | Get category products |
| GET | /api/public/contacts/:site | Get site contacts |
| GET | /api/public/hexagons/:site/active | Get active hexagons |
| POST | /api/telegram/:type | Send notification |

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | Login |
| POST | /api/auth/logout | Logout |
| GET | /api/auth/me | Current user |
| POST | /api/auth/change-password | Change password |

### Admin (requires auth)
| Method | Path | Description |
|--------|------|-------------|
| GET/POST | /api/categories/:site | List/Create categories |
| PUT/DELETE | /api/categories/:site/:id | Update/Delete category |
| GET/POST | /api/products/:site | List/Create products |
| PUT/DELETE | /api/products/:site/:id | Update/Delete product |
| GET | /api/orders/:site | List orders |
| PATCH | /api/orders/:site/:id/status | Update order status |
| GET/POST | /api/users | List/Create users (admin only) |

## Security

- **Helmet**: HTTP security headers
- **CSRF**: Token-based protection for state-changing requests
- **Rate Limiting**: 100 req/15min API, 5 req/15min auth
- **bcrypt**: Password hashing
- **Session**: Secure cookies, 24h expiry
- **Input Sanitization**: SQL injection prevention
