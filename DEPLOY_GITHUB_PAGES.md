# Деплой на GitHub Pages (Вариант 2)

GitHub Pages поддерживает только **статические файлы**. Rust API не может работать там.

## Решение A: Статика на Pages + Отдельный API сервер

### Часть 1: Собрать и задеплоить фронтенд на GitHub Pages

```bash
cd frontend
npm run build
```

Файлы соберутся в `frontend/dist/` с правильным базовым путём `/sport-complex-pro/`.

Скопируйте содержимое `dist` в ветку `gh-pages` вашего репо:

```bash
# Если ещё нет gh-pages ветки:
git checkout --orphan gh-pages
rm -rf *
cp -r ../frontend/dist/* .
git add .
git commit -m "Deploy to GitHub Pages"
git push origin gh-pages
```

Либо используйте **GitHub Actions** (автоматическое):

1. Создайте файл `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: cd frontend && npm install && npm run build
      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./frontend/dist
```

2. Коммитьте и пушьте — GitHub автоматически собует и задеплоит.

Результат: https://tema64378.github.io/sport-complex-pro/

### Часть 2: Развернуть Rust API на сервер

На GitHub Pages API не работает. Вам нужен свой сервер:

**Варианты:**
1. **VPS** (DigitalOcean, Linode, Hetzner) — самый гибкий
2. **Heroku** (бесплатный план кончился, но есть альтернативы)
3. **Render.com**, **Railway.app** — хостят Rust бесплатно (с ограничениями)

#### Пример деплоя на Render.com

1. Создайте аккаунт на https://render.com
2. Создайте новый **Web Service**:
   - Repository: `https://github.com/tema64378/sport-complex-pro`
   - Root Directory: `backend`
   - Build Command: `cargo build --release`
   - Start Command: `./target/release/sport-complex-pro-rust-api`
3. Установите environment variables:
   ```
   PORT=4000
   RUST_DB_PATH=/var/data/data.db
   RUST_BACKUP_DIR=/var/data/backups
   ```
4. Развернуть — Render автоматически создаст URL типа `https://sport-api.onrender.com`

#### Обновить API URL в фронтенде

Измените в `frontend/api.js`:

```javascript
: 'https://your-api-url.com/api'  // заменить на реальный URL
```

Затем пересоберите фронтенд:

```bash
cd frontend
npm run build
# и задеплоите на Pages снова
```

---

## Решение B: Всё на одном сервере (рекомендуется)

Вместо GitHub Pages, разверните весь проект (Rust + dist) на **один сервер**:

```bash
# На сервере:
git clone https://github.com/tema64378/sport-complex-pro
cd sport-complex-pro/frontend
npm install
npm run build

cd ../backend
cargo build --release
nohup ./target/release/sport-complex-pro-rust-api > /var/log/sport-api.log &
```

Сервер на `http://your-server:4000` будет отдавать всё (API + UI).

Настройте nginx, Let's Encrypt SSL и домен — готово!

---

## Текущее состояние

- ✅ Фронтенд собран с правильным `base: '/sport-complex-pro/'`
- ✅ API готов к деплою (Rust)
- ❌ Статика на Pages без API = белый экран (нужен отдельный API)

**Быстрое решение:** разверните оба (фронтенд + API) на один **VPS** вместо Pages.
