# Lastochka Djami Web

A responsive grocery storefront for **Lastochka Djami** (Ласточка Джами), built with Next.js and connected to the store's Laravel API. Customers can browse products, manage a cart, choose delivery or pickup, and access their account from desktop or mobile.

[Visit the storefront](https://lastochki.store/shop/)

## Features

- Product catalog, categories, collections, search, filters, and product details.
- Guest carts, cart transfer after sign-in, and shareable cart links.
- Store selection, delivery addresses, pickup, and available fulfillment slots.
- Phone sign-in, profiles, favorites, reviews, order history, and notifications.
- Loyalty cards with QR codes, saved payment cards, and payment return pages.
- Barcode lookup using the browser camera.

Account and payment features require a compatible backend. Order placement is disabled by default (`CHECKOUT_ENABLED=false`) until checkout and payment callbacks have been verified. Browser push notifications are not implemented.

## Technology

| Layer | Technology |
| --- | --- |
| Application | Next.js 16 App Router, React 19, TypeScript |
| Styling and icons | Tailwind CSS 4, CSS, Lucide |
| Barcode and QR | ZXing, QRCode |
| Sessions | Server-side storage with SQLite or an in-memory adapter; encrypted API tokens |
| Tests | Node.js test runner via tsx, Playwright, Python unittest |
| Release format | Next.js standalone output |

## Architecture

Page rendering and browser requests use a Next.js server layer that communicates with the existing Laravel API. Route handlers restrict the available API operations and validate mutation requests with Origin and CSRF checks. API tokens stay in server-side sessions; the browser receives an HttpOnly session cookie. Public product images may load directly from their source.

The backend remains the source of truth for products, prices, stock, customer accounts, and orders. This repository provides the storefront, not a separate commerce database or admin panel.

## Getting started

**Requirements:** Node.js 24 (see [`.node-version`](.node-version)), npm, and access to a compatible Laravel API.

```sh
git clone https://github.com/lastochka-jami/lastochka-web.git
cd lastochka-web
npm ci
cp .env.example .env.local
openssl rand -hex 32
```

Paste the generated value into `SESSION_ENCRYPTION_KEY` in `.env.local`, review the API and store settings, then start the development server:

```sh
npm run dev
```

Open **http://localhost:3000/shop/**. The `/shop` base path is fixed at build time in [`next.config.ts`](next.config.ts).

### Configuration

[`.env.example`](.env.example) lists the application settings. Keep local environment files and session data out of Git.

| Variable | Purpose |
| --- | --- |
| `API_BASE_URL` | Backend API base URL |
| `DEFAULT_STORE_ID` | Initial store before a customer selects another store or address |
| `PUBLIC_ORIGIN` | Canonical storefront origin, without `/shop` |
| `SECONDARY_PUBLIC_ORIGIN` | Optional additional allowed storefront origin |
| `SESSION_DB_PATH` | SQLite session database path; the example enables SQLite storage |
| `SESSION_ENCRYPTION_KEY` | Random 64-character hexadecimal key for session token encryption |
| `ALLOWED_PAYMENT_RETURN_URL` | Approved payment return origin |
| `CHECKOUT_ENABLED` | Enables order placement after payment integration has been verified |

The in-memory session adapter is used when no SQLite path or explicit storage driver is configured. Use persistent session storage for deployments that must retain sessions across restarts.

## Development and checks

```sh
npm test                                                # Unit tests
python3 -m unittest discover -s deploy -p 'test_*.py'      # Release receiver tests
npm run typecheck                                       # TypeScript checks
npm run build                                           # Production build
```

Run browser tests after building:

```sh
npx playwright install chrome
npm run test:e2e
```

Playwright uses Google Chrome and starts the application with a local API fixture on ports **3011** and **4010**. Tests intercept authentication responses and do not send real SMS messages or process payments. Tests against the fixture do not replace acceptance testing with the real backend.

GitHub CI runs unit tests, receiver tests, type checking, and a production build on pull requests and pushes to `main`. Browser tests run separately. To scan the complete fetched Git history with Gitleaks:

```sh
git fetch --all --tags
gitleaks git --log-opts="--all" --redact .
```

The scanner configuration excludes only the fixed synthetic session key used by the local Playwright fixture.

## Project structure

| Path | Contents |
| --- | --- |
| `app/` | Pages, layouts, metadata, global styles, and API route handlers |
| `src/components/` | Shared interface components and store context |
| `src/features/` | Storefront, cart, and customer account features |
| `src/lib/` | API access, sessions, request protection, and domain helpers |
| `src/config/content.ts` | Storefront section order and labels |
| `src/config/routes.json` | Allowed backend API operations |
| `public/` | Static brand assets and web manifest |
| `tests/` | Unit tests, browser tests, and API fixtures |
| `deploy/` | Standalone release receiver and its tests |

## Deployment

See the [deployment and rollback guide](docs/deployment.md) for standalone packaging, runtime configuration, GitHub Secrets, health checks, and release retention. Deployment is **manual** through the `Deploy web` workflow on `main`; merging a pull request does not deploy the application.

Changes to the release receiver require a separate update by the environment administrator. Application releases do not replace the installed receiver.

See also the [brand guidelines](docs/brand-guidelines.md).
