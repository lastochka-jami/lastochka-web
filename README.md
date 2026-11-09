# Ласточка Джами — веб-магазин

Адаптивная витрина магазина «Ласточка Джами» на Next.js. Использует существующий Laravel API: товары, цены, остатки, адреса и заказы управляются на стороне backend. Веб-приложение не содержит товарной базы или административной панели.

## Возможности

- Главная с подборками, каталог, категории, поиск, фильтры и карточки товаров.
- Гостевая корзина, перенос после входа, общая корзина по ссылке.
- Выбор магазина, адреса, доставки или самовывоза.
- Вход по телефону, профиль, избранное, отзывы, заказы и уведомления.
- Бонусная карта с QR, привязка платёжных карт и возврат после оплаты.
- Поиск по штрихкоду с камерой браузера.

Доступность операций зависит от API и аккаунта. Оформление заказа по умолчанию отключено (`CHECKOUT_ENABLED=false`); включать после проверки платёжного домена и сценариев оплаты. Браузерный push не подключён.

## Стек и архитектура

Next.js 16 (App Router, standalone), React 19, TypeScript, Tailwind CSS 4, Lucide, ZXing и QRCode. Серверные сессии хранятся в SQLite через `node:sqlite`. Проверки: Node test runner с `tsx`, Playwright и Python unittest.

Браузер → Route Handlers Next.js → Laravel API. Серверный слой ограничивает разрешённые операции, проверяет Origin/CSRF и хранит API-токены в зашифрованных серверных сессиях. Браузер получает HttpOnly cookie. Товарные изображения и другие публичные медиа могут загружаться напрямую с источника.

## Локальный запуск

Нужны Node.js 24 (см. `.node-version`) и npm.

```sh
npm ci
cp .env.example .env.local
openssl rand -hex 32
# Записать результат в SESSION_ENCRYPTION_KEY в .env.local
npm run dev
```

Открыть `http://localhost:3000/shop/`. Префикс `/shop` закреплён в `next.config.ts` при сборке. Для интеграции нужен доступный совместимый API; `.env.example` описывает настройки. Секреты, SQLite и `.env.local` в Git не добавлять.

## Проверки

```sh
npm test
python3 -m unittest discover -s deploy -p 'test_*.py'
npm run typecheck
npm run build
npx playwright install chrome
npm run test:e2e
```

Playwright использует Google Chrome (`channel: 'chrome'`). E2E запускает production-сборку и локальный API fixture на портах 3011/4010; реальная SMS и оплата в этих тестах не выполняются. CI проверяет unit-тесты, receiver, типы и production-сборку для PR. E2E запускается отдельно. Историю всех веток можно проверить установленным Gitleaks: `gitleaks git --log-opts="--all" --redact .`; конфигурация исключает только фиксированный ключ локального Playwright fixture.

## Навигация

| Путь | Назначение |
|---|---|
| `app/` | Страницы, layout, метаданные, стили и API Route Handlers |
| `src/components/` | Общие элементы интерфейса и контекст магазина |
| `src/features/` | Витрина, корзина, личный кабинет |
| `src/lib/` | API-клиенты, сессии, защита запросов, прикладная логика |
| `src/config/content.ts` | Порядок и подписи блоков интерфейса |
| `src/config/routes.json` | Разрешённые серверные операции API |
| `tests/` | Unit/E2E и локальный API fixture |
| `deploy/` | Receiver standalone-релизов и его тесты |

[Развёртывание и откат](docs/deployment.md) · [Использование бренда](docs/brand-guidelines.md)
