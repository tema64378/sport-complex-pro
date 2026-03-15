# Sport Complex Pro — Двойной запуск & Деплой

Полный гайд по запуску сайта локально и деплою.

## 📁 Структура проекта

```
/
├── frontend/          # React приложение (Vite)
│   ├── app.jsx
│   ├── api.js
│   ├── pages/
│   ├── components/
│   └── package.json
│
├── backend/           # Rust API сервер
│   ├── src/main.rs    # Axum + SQLite
│   ├── Cargo.toml
│   ├── data.db
│   └── deploy.sh
│
├── frontend/dist/     # Собранный фронтенд (после npm run build)
├── run-local-dev.sh   # Запуск локально (Rust + Vite)
├── start.sh           # Быстрый запуск Rust API
├── start-dev.sh       # Полный запуск (backend + frontend)
├── RUN_LOCALLY.md     # Детальная инструкция локального запуска
└── DEPLOY_GITHUB_PAGES.md  # Как задеплоить на GitHub Pages
```

---

## 🚀 **ВАРИАНТ 1: Локально (для разработки)**

### Быстрый старт (3 метода)

#### Метод A: Скрипт (самый просто)

```bash
bash run-local-dev.sh
```

Откроет браузер на `http://localhost:3000` с гор-релоадом.

#### Метод B: Ручной запуск (2 терминала)

**Терминал 1 — API:**
```bash
cd backend
cargo run
# → Слушает на http://localhost:4000
```

**Терминал 2 — Фронтенд:**
```bash
cd frontend
npm install
npm run dev
# → Откроется http://localhost:3000
```

#### Метод C: Один Rust сервер на 4000 (фронтенд + API)

```bash
# Собрать фронтенд
cd frontend
npm run build

# Запустить Rust (отдаёт dist + API)
cd ../backend
cargo run

# → http://localhost:4000 (делать это развёртывание, ч если нет изменений в коде)
```

### Отладка локально

- **White screen?** Откройте DevTools → Console, посмотрите ошибки сети
- **API не отвечает?** Проверьте, запущен ли Rust на 4000: `curl http://localhost:4000/api/ping`
- **Vite не перезагружает?** Убедитесь, что на 3000 слушает Node.js: `lsof -i :3000`

---

## 🌐 **ВАРИАНТ 2: GitHub Pages + отдельный API**

### Проблема
GitHub Pages поддерживает **только статику**. Rust API там не работает → белый экран.

### Решение: 2 части

#### Часть 1️⃣: Статика на GitHub Pages

1. **Собрать фронтенд:**
   ```bash
   cd frontend
   npm run build
   ```
   Будет `frontend/dist/` с путём `/sport-complex-pro/`

2. **Загрузить на Pages:**

   **Вариант A** — GitHub Actions (автоматический):
   
   Создайте `.github/workflows/deploy.yml`:
   ```yaml
   name: Deploy Pages
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
         - uses: peaceiris/actions-gh-pages@v3
           with:
             github_token: ${{ secrets.GITHUB_TOKEN }}
             publish_dir: ./frontend/dist
   ```
   
   Коммитьте → GitHub автоматически соберёт и задеплоит.
   
   **Вариант B** — Ручной:
   ```bash
   git checkout --orphan gh-pages
   rm -rf *
   cp -r ../frontend/dist .
   git add .
   git commit -m "Deploy"
   git push origin gh-pages
   ```

3. **Включить Pages:**
   Settings → GitHub Pages → Branch: `gh-pages`

   Результат: https://tema64378.github.io/sport-complex-pro/

#### Часть 2️⃣: API на отдельном сервере

GitHub Pages не может запустить Rust. Нужен свой хост для API.

**Варианты хостинга:**

| Сервис | Цена | Сложность | Rust поддержка |
|--------|------|-----------|----------------|
| **Render.com** | Бесплатно (ограничено) | ⭐ | ✅ Отлично |
| **Railway.app** | $5/мес | ⭐ | ✅ Отлично |
| **Heroku** | Платный | ⭐ | ✅ |
| **DigitalOcean VPS** | $4/мес | ⭐⭐⭐ | ✅ Полный контроль |

**Пример: Render.com (самый простой)**

1. Зарегистрируйтесь на https://render.com
2. Создайте новый **Web Service**:
   - Repo: `https://github.com/tema64378/sport-complex-pro`
   - Root Dir: `backend`
   - Build: `cargo build --release`
   - Start: `./target/release/sport-complex-pro-rust-api`
3. Environment:
   ```
   PORT=4000
   RUST_DB_PATH=/var/tmp/data.db
   ```

   Render скажет вам URL (примерно `https://sport-api-xyz.onrender.com`)

4. **Обновить `frontend/api.js`:**
   ```javascript
   : 'https://sport-api-xyz.onrender.com/api'  // ← ваш API URL
   ```

5. **Пересобрать фронтенд:**
   ```bash
   cd frontend
   npm run build
   ```

6. **Задеплоить на Pages (вариант A или B выше)**

Результат:
- Frontend: https://tema64378.github.io/sport-complex-pro/ (Pages)
- API: https://sport-api-xyz.onrender.com/ (Render)
- Всё вместе работает ✅

---

## ⚡ **ВАРИАНТ 3: Всё на одном VPS (рекомендуется)**

Вместо GitHub Pages + отдельный API, разверните всё на один сервер.

**На сервере (Ubuntu):**

```bash
git clone https://github.com/tema64378/sport-complex-pro
cd sport-complex-pro

# Установить зависимости
curl -fsSL https://sh.rustup.rs | sh
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash
sudo apt install -y nodejs

# Собрать
cd frontend
npm install
npm run build

# Запустить
cd ../backend
cargo build --release

# Запустить в фоне с логами
nohup ./target/release/sport-complex-pro-rust-api > /var/log/sport-api.log 2>&1 &
```

Сервер на `http://your-domain.com:4000` будет отдавать всё.

**SSL + Nginx + домен:**

```bash
# Установить Nginx и Certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# Создать Nginx config
sudo tee /etc/nginx/sites-available/sport-complex-pro > /dev/null <<EOF
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF

# Включить
sudo ln -sf /etc/nginx/sites-available/sport-complex-pro /etc/nginx/sites-enabled/

# SSL (автоматический)
sudo certbot --nginx -d your-domain.com

# Перезагрузить
sudo systemctl restart nginx
```

Результат: `https://your-domain.com` с SSL ✅

---

## 📋 Чек-лист для деплоя

- [ ] Фронтенд собран (`npm run build` → `frontend/dist/`)
- [ ] Rust компилируется без ошибок (`cargo check`)
- [ ] Локально работает (запустил `run-local-dev.sh`)
- [ ] Выбран способ хостинга (GitHub Pages vs VPS)
- [ ] Если Pages: API успешно деплоен на Render/Railway
- [ ] Если Pages: обновлён `api.js` с новым API URL
- [ ] Фронтенд переключен на production (`.env` или вирус Pages CDN)
- [ ] Первого запуска на боевом сервере протестирован вход и загрузка данных

---

## 🆘 Проблемы

### Белый экран на GitHub Pages

**Причины:**
1. API недоступен (не деплоен Render/Railway)
2. Неправильный API URL в `api.js`
3. CORS проблемы

**Решение:**
- Откройте DevTools → Network/Console
- Посмотрите, какой URL пытается загрузить браузер
- Убедитесь, что API отвечает:
  ```bash
  curl https://your-api.onrender.com/api/ping
  ```

### Rust не компилируется

```bash
cargo clean
cargo build
```

### Node_modules ошибки

```bash
rm -rf frontend/node_modules package-lock.json
npm install
```

---

## 📚 Дальше

- [RUN_LOCALLY.md](RUN_LOCALLY.md) — Детали локального запуска
- [DEPLOY_GITHUB_PAGES.md](DEPLOY_GITHUB_PAGES.md) — Деплой на Pages
- [backend/deploy.sh](backend/deploy.sh) — Старый скрипт (может понадобиться)

---

**Вопросы?** Посмотрите логи:
```bash
# Rust логи
tail -f /var/log/sport-api.log

# Фронтенд error (DevTools)
# API error (curl или Postman)
```

Готово! 🎉
