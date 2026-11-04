# Развёртывание и откат

Проверено 04.11.2026: VPS витрины — `152.53.101.9` (`lastochka.duckdns.org`), SSH-пользователь `root`; использовать уже настроенный ключ и строгую проверку known_hosts. Это отдельный сервер от Laravel.

Продакшен находится в `/opt/lastochka-web` на VPS и запускается Docker Compose. Caddy входит в тот же compose-проект и проксирует `https://lastochka.duckdns.org` на `lastochka:3001`. Laravel и его база не переносятся.

## Обновление

1. Убедиться, что рабочая ветка прошла `npm test`, `npm run typecheck`, `npm run build` и `npm run test:e2e`.
2. На VPS сохранить текущую ревизию и образ: `git rev-parse HEAD` и `docker image inspect lastochka-web-lastochka`.
3. Получить проверенный commit в `/opt/lastochka-web`.
4. Выполнить `docker compose build lastochka`, затем `docker compose up -d --no-deps lastochka`.
5. Проверить контейнер локально из сети Compose и публичные `/`, `/catalog`, `/search`, `/product/:id`.

Секрет `SESSION_ENCRYPTION_KEY` хранится только в серверном `.env`; это 64 шестнадцатеричных символа. `CHECKOUT_ENABLED=false` сохраняется до приёмки входа, корзины, разрешённого return URL и тестовой оплаты.

## Откат

Перед переключением старая версия помечается Docker-тегом `lastochka-web:rollback-<timestamp>`, а каталог проекта архивируется в `/opt/backups/lastochka-web/`. Для отката восстановить зафиксированную ревизию или архив, вернуть прежний образ/compose и выполнить `docker compose up -d`. Том сессий не содержит товарной базы и может быть сохранён; после смены ключа пользователям потребуется войти снова.

Не выполнять `docker compose down -v`: флаг `-v` удалит постоянные тома. Caddy и соседние compose-проекты не перезапускать без необходимости.

## Проверка этого релиза

`npm run test:e2e` запускает production-сборку с локальным API fixture на 3011/4010. SMS/OTP перехватываются тестовыми ответами. Публичный smoke после выкладки обязателен отдельно. Скриншоты сохраняются для ручного просмотра: версионированных эталонов в репозитории нет.

На сервере имеются локальные изменения Caddyfile и docker-compose.yml. Не включать их в коммит и не перезаписывать при fast-forward обновлении кода. Строить и переключать только сервис lastochka.

Архив отката хранится на сервере с правами 600, каталог — 700; исключаются node_modules, .next и сессионная .data. Перед переключением записываются исходные commit и image ID; старый образ получает rollback-тег. Для возврата образа: docker tag lastochka-web:rollback-<timestamp> lastochka-web-lastochka; затем docker compose up -d --no-deps --no-build --force-recreate lastochka. Возврат кода через git reset --keep <сохранённая ревизия> сохраняет несвязанные локальные изменения конфигурации. Сначала проверить состояние рабочего дерева.
