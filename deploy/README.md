# Автообновление веба

После публикации workflow и включения Actions каждый push в main запускает тесты, typecheck и сборку на GitHub (Ubuntu 22.04, Node 24.22.2). На backend передаётся только готовая standalone-сборка, без секретов и сессий.

Ключ WEB_DEPLOY_KEY разрешает только команду `deploy <SHA>` пользователя lastochka-deploy. WEB_KNOWN_HOSTS содержит заранее проверенный ключ SSH-сервера. Ключ не даёт shell, туннели или root. Единственное sudo-разрешение — restart lastochka-web.service. Не устанавливать GitHub runner на backend.

На сервере /usr/local/bin/lastochka-web-receive — root-owned копия receive.py, /opt/lastochka-web/runtime/node — отдельный Node, releases — версии, links/current — активная версия. Служба по-прежнему использует /opt/lastochka-web/current (ссылка на links/current). runtime.env и state с сессиями остаются отдельно и не перезаписываются.

После доставки перезапускается только веб. Проверяются номер ревизии, главная, каталог и поиск. При сбое автоматически возвращается предыдущая версия. Сохраняются три автоматических релиза и исходная перенесённая сборка. Возможна короткая пауза веба при restart; backend не перезапускается. Проверки не покрывают все пользовательские сценарии.

Результат смотреть в GitHub → Actions → Deploy web. Красный запуск означает, что сборка/доставка не прошла; при ошибке запуска сервер пытается вернуть предыдущий релиз. Параллельные выкладки запрещены. Workflow можно запустить вручную, только из main.

Изменения receive.py из Git сами на сервер не устанавливаются: это отдельная административная операция. Для отзыва доступа удалить ключ из authorized_keys пользователя lastochka-deploy и секрет WEB_DEPLOY_KEY в GitHub.

## Магазин под /shop

Сборка закрепляет basePath=/shop. Receiver smoke читает /shop/__deploy_revision.txt и страницы /shop/, /shop/catalog, /shop/search; перед первой такой выкладкой серверная копия receiver должна быть обновлена отдельно. nginx сохраняет префикс URI при proxy_pass.

Основной вход — https://lastochki.store/shop/ (PUBLIC_ORIGIN=https://lastochki.store). Технический https://lastochka.duckdns.org/shop/ сохраняется на той же службе; SECONDARY_PUBLIC_ORIGIN=https://lastochka.duckdns.org разрешает его Origin с прежними CSRF-проверками. Старые пути технического домена переходят на /shop того же хоста. API Laravel /api/v1 и страницы лендинга не меняются. CHECKOUT_ENABLED остаётся false; return URL — /shop/payment и /shop/cards на разрешённом платёжном домене. Смена домена требует повторного входа; ключ и SQLite не меняются.
