const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const https = require('https');
const { db, init } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

init();

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function httpsJsonRequest({ hostname, path, method, headers, body }) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname,
      path,
      method,
      headers,
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: { raw: data } });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function tinkoffToken(payload, password) {
  const data = { ...payload, Password: password };
  const keys = Object.keys(data).sort();
  const values = keys.map(k => String(data[k]));
  const concat = values.join('');
  return crypto.createHash('sha256').update(concat).digest('hex');
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  db.get('SELECT s.token, s.expiresAt, u.id, u.name, u.email, u.phone, u.role FROM sessions s JOIN users u ON s.userId = u.id WHERE s.token = ?', [token], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(401).json({ error: 'Unauthorized' });
    if (row.expiresAt && new Date(row.expiresAt) < new Date()) return res.status(401).json({ error: 'Session expired' });
    req.user = { id: row.id, name: row.name, email: row.email, phone: row.phone, role: row.role, token: row.token };
    next();
  });
}

function requireRole(roles = []) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

app.get('/', (req, res) => {
  res.json({
    message: 'Fitness Management API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      members: '/api/members',
      trainers: '/api/trainers',
      classes: '/api/classes',
      bookings: '/api/bookings',
      payments: '/api/payments',
      ping: '/api/ping'
    },
    note: 'Frontend available at http://localhost:3000'
  });
});

app.get('/api/ping', (req, res) => res.json({ ok: true }));

// --- Auth ---
app.post('/api/auth/register', (req, res) => {
  const { name, email, phone, role, password } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'Missing fields' });
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, existing) => {
    if (err) return res.status(500).json({ error: err.message });
    if (existing) return res.status(409).json({ error: 'User already exists' });
    const stmt = db.prepare('INSERT INTO users (name,email,phone,role,password) VALUES (?,?,?,?,?)');
    stmt.run(name, email, phone || '', role || 'Клиент', password, function(err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      db.get('SELECT id, name, email, phone, role FROM users WHERE id = ?', [this.lastID], (err3, row) => {
        if (err3) return res.status(500).json({ error: err3.message });
        const token = generateToken();
        const createdAt = new Date().toISOString();
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
        const finalize = () => {
          db.run('INSERT INTO sessions (userId, token, createdAt, expiresAt) VALUES (?,?,?,?)', [row.id, token, createdAt, expiresAt], (err4) => {
            if (err4) return res.status(500).json({ error: err4.message });
            res.status(201).json({ user: row, token });
          });
        };
        if (row.role === 'Клиент') {
          db.run('INSERT INTO members (name,email,phone,membership,joinDate,status) VALUES (?,?,?,?,?,?)', [row.name, row.email, row.phone, 'Базовый', new Date().toISOString().slice(0,10), 'Активный'], () => finalize());
        } else {
          finalize();
        }
      });
    });
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
  db.get('SELECT id, name, email, phone, role, password FROM users WHERE email = ?', [email], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user || user.password !== password) return res.status(401).json({ error: 'Invalid credentials' });
    const { password: _pw, ...safeUser } = user;
    const token = generateToken();
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
    db.run('INSERT INTO sessions (userId, token, createdAt, expiresAt) VALUES (?,?,?,?)', [safeUser.id, token, createdAt, expiresAt], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ user: safeUser, token });
    });
  });
});

app.post('/api/auth/vk-demo', (req, res) => {
  const demoUser = { name: 'VK Пользователь', email: 'vk_demo@vk.com', phone: '', role: 'Клиент' };
  db.get('SELECT * FROM users WHERE email = ?', [demoUser.email], (err, existing) => {
    if (err) return res.status(500).json({ error: err.message });
    const finalizeLogin = (userRow) => {
      const token = generateToken();
      const createdAt = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
      db.run('INSERT INTO sessions (userId, token, createdAt, expiresAt) VALUES (?,?,?,?)', [userRow.id, token, createdAt, expiresAt], (err2) => {
        if (err2) return res.status(500).json({ error: err2.message });
        const safeUser = { id: userRow.id, name: userRow.name, email: userRow.email, phone: userRow.phone, role: userRow.role };
        res.json({ user: safeUser, token, demo: true });
      });
    };

    if (existing) return finalizeLogin(existing);

    const stmt = db.prepare('INSERT INTO users (name,email,phone,role,password) VALUES (?,?,?,?,?)');
    stmt.run(demoUser.name, demoUser.email, demoUser.phone, demoUser.role, 'vk_demo', function(err2) {
      if (err2) return res.status(500).json({ error: err2.message });
      db.get('SELECT * FROM users WHERE id = ?', [this.lastID], (err3, row) => {
        if (err3) return res.status(500).json({ error: err3.message });
        db.run('INSERT INTO members (name,email,phone,membership,joinDate,status) VALUES (?,?,?,?,?,?)', [row.name, row.email, row.phone, 'Базовый', new Date().toISOString().slice(0,10), 'Активный'], () => finalizeLogin(row));
      });
    });
  });
});

app.get('/api/auth/vk/login', (req, res) => {
  const clientId = process.env.VK_CLIENT_ID;
  const redirectUri = process.env.VK_REDIRECT_URI;
  if (!clientId || !redirectUri) return res.status(400).send('VK credentials missing');
  const state = crypto.randomBytes(16).toString('hex');
  const url = `https://oauth.vk.com/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=email&state=${state}&v=5.131`;
  res.redirect(url);
});

app.get('/api/auth/vk/callback', async (req, res) => {
  const clientId = process.env.VK_CLIENT_ID;
  const clientSecret = process.env.VK_CLIENT_SECRET;
  const redirectUri = process.env.VK_REDIRECT_URI;
  const code = req.query.code;
  if (!clientId || !clientSecret || !redirectUri) return res.status(400).send('VK credentials missing');
  if (!code) return res.status(400).send('VK code missing');

  try {
    const tokenResponse = await httpsJsonRequest({
      hostname: 'oauth.vk.com',
      path: `/access_token?client_id=${clientId}&client_secret=${clientSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`,
      method: 'GET',
      headers: {},
    });
    const accessToken = tokenResponse?.data?.access_token;
    const userId = tokenResponse?.data?.user_id;
    const email = tokenResponse?.data?.email || `vk_${userId}@vk.com`;
    if (!accessToken || !userId) return res.status(400).send('VK token error');

    const userResponse = await httpsJsonRequest({
      hostname: 'api.vk.com',
      path: `/method/users.get?user_ids=${userId}&v=5.131&access_token=${accessToken}`,
      method: 'GET',
      headers: {},
    });
    const vkUser = userResponse?.data?.response?.[0] || {};
    const name = `${vkUser.first_name || 'VK'} ${vkUser.last_name || 'User'}`.trim();

    db.get('SELECT * FROM users WHERE email = ?', [email], (err, existing) => {
      if (err) return res.status(500).send('DB error');
      const finalizeLogin = (userRow) => {
        const token = generateToken();
        const createdAt = new Date().toISOString();
        const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
        db.run('INSERT INTO sessions (userId, token, createdAt, expiresAt) VALUES (?,?,?,?)', [userRow.id, token, createdAt, expiresAt], (err2) => {
          if (err2) return res.status(500).send('Session error');
          res.redirect(`https://sportcomplecspro.ru/?vk_token=${token}`);
        });
      };

      if (existing) return finalizeLogin(existing);

      const stmt = db.prepare('INSERT INTO users (name,email,phone,role,password) VALUES (?,?,?,?,?)');
      stmt.run(name, email, '', 'Клиент', 'vk_oauth', function(err2) {
        if (err2) return res.status(500).send('User error');
        db.run('INSERT INTO members (name,email,phone,membership,joinDate,status) VALUES (?,?,?,?,?,?)', [name, email, '', 'Базовый', new Date().toISOString().slice(0,10), 'Активный'], () => {
          db.get('SELECT * FROM users WHERE id = ?', [this.lastID], (err3, row) => {
            if (err3) return res.status(500).send('User error');
            finalizeLogin(row);
          });
        });
      });
    });
  } catch (e) {
    res.status(500).send('VK OAuth failed');
  }
});

app.get('/api/auth/me', authRequired, (req, res) => {
  res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email, phone: req.user.phone, role: req.user.role } });
});

app.post('/api/auth/logout', authRequired, (req, res) => {
  db.run('DELETE FROM sessions WHERE token = ?', [req.user.token], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// --- Services ---
app.get('/api/services', authRequired, (req, res) => {
  db.all('SELECT * FROM services ORDER BY id ASC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// --- Receipts ---
app.get('/api/receipts', authRequired, (req, res) => {
  const query = req.user.role === 'Клиент'
    ? ['SELECT * FROM receipts WHERE memberName = ? ORDER BY id DESC', [req.user.name]]
    : ['SELECT * FROM receipts ORDER BY id DESC', []];
  db.all(query[0], query[1], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const normalized = rows.map(r => ({ ...r, items: JSON.parse(r.itemsJson || '[]') }));
    res.json(normalized);
  });
});

app.post('/api/receipts', authRequired, (req, res) => {
  const { memberId, memberName, membership, items, subtotal, discount, total, createdAt, note, paymentId } = req.body;
  if (req.user.role === 'Клиент') {
    return db.get('SELECT * FROM members WHERE email = ?', [req.user.email], (err, memberRow) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!memberRow) return res.status(400).json({ error: 'Member profile not found' });
      const stmt = db.prepare('INSERT INTO receipts (memberId,memberName,membership,itemsJson,subtotal,discount,total,createdAt,note,paymentId) VALUES (?,?,?,?,?,?,?,?,?,?)');
      stmt.run(memberRow.id, req.user.name, memberRow.membership, JSON.stringify(items || []), subtotal, discount, total, createdAt, note || '', paymentId || null, function(err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        db.get('SELECT * FROM receipts WHERE id = ?', [this.lastID], (err3, row) => {
          if (err3) return res.status(500).json({ error: err3.message });
          const receipt = { ...row, items: JSON.parse(row.itemsJson || '[]') };
          res.status(201).json(receipt);
        });
      });
    });
  }
  const stmt = db.prepare('INSERT INTO receipts (memberId,memberName,membership,itemsJson,subtotal,discount,total,createdAt,note,paymentId) VALUES (?,?,?,?,?,?,?,?,?,?)');
  stmt.run(memberId, memberName, membership, JSON.stringify(items || []), subtotal, discount, total, createdAt, note || '', paymentId || null, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get('SELECT * FROM receipts WHERE id = ?', [this.lastID], (err2, row) => {
      if (err2) return res.status(500).json({ error: err2.message });
      const receipt = { ...row, items: JSON.parse(row.itemsJson || '[]') };
      res.status(201).json(receipt);
    });
  });
});

app.put('/api/receipts/:id', authRequired, (req, res) => {
  const id = req.params.id;
  const { paymentId, note } = req.body;
  if (req.user.role === 'Клиент') {
    return db.get('SELECT * FROM receipts WHERE id = ?', [id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row || row.memberName !== req.user.name) return res.status(403).json({ error: 'Forbidden' });
      db.run('UPDATE receipts SET paymentId = COALESCE(?, paymentId), note = COALESCE(?, note) WHERE id = ?', [paymentId, note, id], function(err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        db.get('SELECT * FROM receipts WHERE id = ?', [id], (err3, updated) => {
          if (err3) return res.status(500).json({ error: err3.message });
          const receipt = { ...updated, items: JSON.parse(updated.itemsJson || '[]') };
          res.json(receipt);
        });
      });
    });
  }
  db.run('UPDATE receipts SET paymentId = COALESCE(?, paymentId), note = COALESCE(?, note) WHERE id = ?', [paymentId, note, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get('SELECT * FROM receipts WHERE id = ?', [id], (err2, row) => {
      if (err2) return res.status(500).json({ error: err2.message });
      const receipt = { ...row, items: JSON.parse(row.itemsJson || '[]') };
      res.json(receipt);
    });
  });
});

// --- Deals ---
app.get('/api/deals', authRequired, requireRole(['Администратор', 'Тренер']), (req, res) => {
  db.all('SELECT * FROM deals ORDER BY id DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/deals', authRequired, requireRole(['Администратор', 'Тренер']), (req, res) => {
  const { client, offer, value, stage, probability, manager, nextStep, date } = req.body;
  const stmt = db.prepare('INSERT INTO deals (client,offer,value,stage,probability,manager,nextStep,date) VALUES (?,?,?,?,?,?,?,?)');
  stmt.run(client, offer, value, stage, probability, manager, nextStep, date, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get('SELECT * FROM deals WHERE id = ?', [this.lastID], (err2, row) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.status(201).json(row);
    });
  });
});

app.put('/api/deals/:id', authRequired, requireRole(['Администратор', 'Тренер']), (req, res) => {
  const id = req.params.id;
  const { client, offer, value, stage, probability, manager, nextStep, date } = req.body;
  db.run('UPDATE deals SET client=?, offer=?, value=?, stage=?, probability=?, manager=?, nextStep=?, date=? WHERE id = ?', [client, offer, value, stage, probability, manager, nextStep, date, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get('SELECT * FROM deals WHERE id = ?', [id], (err2, row) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json(row);
    });
  });
});

app.delete('/api/deals/:id', authRequired, requireRole(['Администратор', 'Тренер']), (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM deals WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// --- Forecast ---
app.get('/api/forecast', authRequired, requireRole(['Администратор', 'Тренер']), (req, res) => {
  db.all('SELECT month, visits, pool, tennis FROM demand_history ORDER BY id ASC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ history: rows });
  });
});

// --- Search ---
app.get('/api/search', authRequired, requireRole(['Администратор', 'Тренер']), (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  if (!q) return res.json({ members: [], trainers: [], classes: [], deals: [], receipts: [] });
  const like = `%${q}%`;

  const results = { members: [], trainers: [], classes: [], deals: [], receipts: [] };
  db.all('SELECT * FROM members WHERE lower(name) LIKE ? OR lower(email) LIKE ? OR lower(membership) LIKE ?', [like, like, like], (err, rows) => {
    if (!err) results.members = rows;
    db.all('SELECT * FROM trainers WHERE lower(name) LIKE ? OR lower(specialty) LIKE ?', [like, like], (err2, rows2) => {
      if (!err2) results.trainers = rows2;
      db.all('SELECT * FROM classes WHERE lower(name) LIKE ? OR lower(level) LIKE ?', [like, like], (err3, rows3) => {
        if (!err3) results.classes = rows3;
        db.all('SELECT * FROM deals WHERE lower(client) LIKE ? OR lower(offer) LIKE ? OR lower(manager) LIKE ?', [like, like, like], (err4, rows4) => {
          if (!err4) results.deals = rows4;
          db.all('SELECT * FROM receipts WHERE lower(memberName) LIKE ? OR lower(membership) LIKE ? OR lower(note) LIKE ?', [like, like, like], (err5, rows5) => {
            if (!err5) results.receipts = rows5.map(r => ({ ...r, items: JSON.parse(r.itemsJson || '[]') }));
            res.json(results);
          });
        });
      });
    });
  });
});

app.get('/api/members', authRequired, (req, res) => {
  if (req.user.role === 'Клиент') {
    return db.all('SELECT * FROM members WHERE email = ? ORDER BY id DESC', [req.user.email], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  }
  db.all('SELECT * FROM members ORDER BY id DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/members', authRequired, requireRole(['Администратор', 'Тренер']), (req, res) => {
  const { name, email, phone, membership, joinDate, status } = req.body;
  const stmt = db.prepare('INSERT INTO members (name,email,phone,membership,joinDate,status) VALUES (?,?,?,?,?,?)');
  stmt.run(name, email, phone, membership, joinDate, status, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get('SELECT * FROM members WHERE id = ?', [this.lastID], (err2, row) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.status(201).json(row);
    });
  });
});

app.put('/api/members/:id', authRequired, requireRole(['Администратор', 'Тренер']), (req, res) => {
  const id = req.params.id;
  const { name, email, phone, membership, joinDate, status } = req.body;
  db.run(
    'UPDATE members SET name=?, email=?, phone=?, membership=?, joinDate=?, status=? WHERE id = ?',
    [name, email, phone, membership, joinDate, status, id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM members WHERE id = ?', [id], (err2, row) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json(row);
      });
    }
  );
});

app.delete('/api/members/:id', authRequired, requireRole(['Администратор', 'Тренер']), (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM members WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// --- Trainers ---
app.get('/api/trainers', authRequired, requireRole(['Администратор', 'Тренер']), (req, res) => {
  db.all('SELECT * FROM trainers ORDER BY id DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/trainers', authRequired, requireRole(['Администратор']), (req, res) => {
  const { name, email, phone, specialty, experience, members: mcount, rating } = req.body;
  const stmt = db.prepare('INSERT INTO trainers (name,email,phone,specialty,experience,members,rating) VALUES (?,?,?,?,?,?,?)');
  stmt.run(name, email, phone, specialty, experience, mcount || 0, rating || 0, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get('SELECT * FROM trainers WHERE id = ?', [this.lastID], (err2, row) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.status(201).json(row);
    });
  });
});

app.put('/api/trainers/:id', authRequired, requireRole(['Администратор']), (req, res) => {
  const id = req.params.id;
  const { name, email, phone, specialty, experience, members: mcount, rating } = req.body;
  db.run('UPDATE trainers SET name=?, email=?, phone=?, specialty=?, experience=?, members=?, rating=? WHERE id = ?', [name, email, phone, specialty, experience, mcount, rating, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get('SELECT * FROM trainers WHERE id = ?', [id], (err2, row) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json(row);
    });
  });
});

app.delete('/api/trainers/:id', authRequired, requireRole(['Администратор']), (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM trainers WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// --- Classes ---
app.get('/api/classes', authRequired, (req, res) => {
  db.all('SELECT * FROM classes ORDER BY id DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/classes', authRequired, requireRole(['Администратор', 'Тренер']), (req, res) => {
  const { name, trainerId, trainerName, schedule, capacity, enrolled, level } = req.body;
  const stmt = db.prepare('INSERT INTO classes (name,trainerId,trainerName,schedule,capacity,enrolled,level) VALUES (?,?,?,?,?,?,?)');
  stmt.run(name, trainerId, trainerName, schedule, capacity, enrolled, level, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get('SELECT * FROM classes WHERE id = ?', [this.lastID], (err2, row) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.status(201).json(row);
    });
  });
});

app.put('/api/classes/:id', authRequired, requireRole(['Администратор', 'Тренер']), (req, res) => {
  const id = req.params.id;
  const { name, trainerId, trainerName, schedule, capacity, enrolled, level } = req.body;
  db.run('UPDATE classes SET name=?, trainerId=?, trainerName=?, schedule=?, capacity=?, enrolled=?, level=? WHERE id = ?', [name, trainerId, trainerName, schedule, capacity, enrolled, level, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get('SELECT * FROM classes WHERE id = ?', [id], (err2, row) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json(row);
    });
  });
});

app.delete('/api/classes/:id', authRequired, requireRole(['Администратор', 'Тренер']), (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM classes WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// --- Bookings ---
app.get('/api/bookings', authRequired, (req, res) => {
  if (req.user.role === 'Клиент') {
    return db.all('SELECT * FROM bookings WHERE member = ? ORDER BY id DESC', [req.user.name], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  }
  db.all('SELECT * FROM bookings ORDER BY id DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/bookings', authRequired, (req, res) => {
  const { member, classId, className, date, time, status } = req.body;
  const actualMember = req.user.role === 'Клиент' ? req.user.name : member;
  const stmt = db.prepare('INSERT INTO bookings (member,classId,className,date,time,status) VALUES (?,?,?,?,?,?)');
  stmt.run(actualMember, classId, className, date, time, status, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get('SELECT * FROM bookings WHERE id = ?', [this.lastID], (err2, row) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.status(201).json(row);
    });
  });
});

app.put('/api/bookings/:id', authRequired, (req, res) => {
  const id = req.params.id;
  const { member, classId, className, date, time, status } = req.body;
  if (req.user.role === 'Клиент') {
    return db.get('SELECT * FROM bookings WHERE id = ?', [id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row || row.member !== req.user.name) return res.status(403).json({ error: 'Forbidden' });
      db.run('UPDATE bookings SET member=?, classId=?, className=?, date=?, time=?, status=? WHERE id = ?', [req.user.name, classId, className, date, time, status, id], function(err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        db.get('SELECT * FROM bookings WHERE id = ?', [id], (err3, updated) => {
          if (err3) return res.status(500).json({ error: err3.message });
          res.json(updated);
        });
      });
    });
  }
  db.run('UPDATE bookings SET member=?, classId=?, className=?, date=?, time=?, status=? WHERE id = ?', [member, classId, className, date, time, status, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get('SELECT * FROM bookings WHERE id = ?', [id], (err2, row) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json(row);
    });
  });
});

app.delete('/api/bookings/:id', authRequired, (req, res) => {
  const id = req.params.id;
  if (req.user.role === 'Клиент') {
    return db.get('SELECT * FROM bookings WHERE id = ?', [id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row || row.member !== req.user.name) return res.status(403).json({ error: 'Forbidden' });
      db.run('DELETE FROM bookings WHERE id = ?', [id], function(err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ success: true });
      });
    });
  }
  db.run('DELETE FROM bookings WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// --- Payments ---
app.get('/api/payments', authRequired, (req, res) => {
  if (req.user.role === 'Клиент') {
    return db.all('SELECT * FROM payments WHERE member = ? ORDER BY id DESC', [req.user.name], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  }
  db.all('SELECT * FROM payments ORDER BY id DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/payments', authRequired, (req, res) => {
  const { member, amount, method, date, status, receiptId, provider } = req.body;
  const actualMember = req.user.role === 'Клиент' ? req.user.name : member;
  const stmt = db.prepare('INSERT INTO payments (member,amount,method,date,status,receiptId,provider) VALUES (?,?,?,?,?,?,?)');
  stmt.run(actualMember, amount, method, date, status, receiptId || null, provider || null, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get('SELECT * FROM payments WHERE id = ?', [this.lastID], (err2, row) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.status(201).json(row);
    });
  });
});

app.put('/api/payments/:id', authRequired, (req, res) => {
  const id = req.params.id;
  const { member, amount, method, date, status, receiptId, provider } = req.body;
  if (req.user.role === 'Клиент') {
    return db.get('SELECT * FROM payments WHERE id = ?', [id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row || row.member !== req.user.name) return res.status(403).json({ error: 'Forbidden' });
      db.run('UPDATE payments SET member=?, amount=?, method=?, date=?, status=?, receiptId=?, provider=? WHERE id = ?', [req.user.name, amount, method, date, status, receiptId || row.receiptId, provider || row.provider, id], function(err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        db.get('SELECT * FROM payments WHERE id = ?', [id], (err3, updated) => {
          if (err3) return res.status(500).json({ error: err3.message });
          res.json(updated);
        });
      });
    });
  }
  db.run('UPDATE payments SET member=?, amount=?, method=?, date=?, status=?, receiptId=?, provider=? WHERE id = ?', [member, amount, method, date, status, receiptId || null, provider || null, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get('SELECT * FROM payments WHERE id = ?', [id], (err2, row) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json(row);
    });
  });
});

app.get('/api/payments/providers', authRequired, (req, res) => {
  res.json({
    providers: [
      { id: 'yookassa', name: 'YooKassa' },
      { id: 'cloudpayments', name: 'CloudPayments' },
      { id: 'tinkoff', name: 'Тинькофф' },
      { id: 'sberpay', name: 'СберPay' },
      { id: 'sbp', name: 'СБП' },
    ],
  });
});

app.post('/api/payments/mock-link', authRequired, (req, res) => {
  const { provider, amount = 0, description = 'Оплата услуг' } = req.body || {};
  const orderId = `ORD-${Date.now()}`;
  const url = `https://pay.demo/${provider || 'provider'}?amount=${amount}&order=${orderId}`;
  res.json({ url, orderId, provider, description });
});

// --- Real test providers ---
app.post('/api/payments/yookassa/create', authRequired, async (req, res) => {
  const { amount, description, returnUrl } = req.body || {};
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secret = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secret) return res.status(400).json({ error: 'YooKassa keys missing' });
  const idempotence = crypto.randomUUID();
  const body = JSON.stringify({
    amount: { value: Number(amount || 0).toFixed(2), currency: 'RUB' },
    confirmation: { type: 'redirect', return_url: returnUrl || 'https://sportcomplecspro.ru/paid' },
    capture: true,
    description: description || 'Оплата услуг',
  });
  try {
    const response = await httpsJsonRequest({
      hostname: 'api.yookassa.ru',
      path: '/v3/payments',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotence-Key': idempotence,
        Authorization: 'Basic ' + Buffer.from(`${shopId}:${secret}`).toString('base64'),
      },
      body,
    });
    res.status(response.status).json(response.data);
  } catch (e) {
    res.status(500).json({ error: 'YooKassa request failed' });
  }
});

app.post('/api/payments/tinkoff/init', authRequired, async (req, res) => {
  const { amount, orderId, description, successUrl, failUrl } = req.body || {};
  const terminalKey = process.env.TINKOFF_TERMINAL_KEY;
  const password = process.env.TINKOFF_PASSWORD;
  const apiToken = process.env.TINKOFF_API_TOKEN;
  if (!terminalKey || (!password && !apiToken)) return res.status(400).json({ error: 'Tinkoff keys missing' });

  const payload = {
    TerminalKey: terminalKey,
    Amount: Number(amount || 0) * 100,
    OrderId: orderId || `ORD-${Date.now()}`,
    Description: description || 'Оплата услуг',
    SuccessURL: successUrl || 'https://sportcomplecspro.ru/paid',
    FailURL: failUrl || 'https://sportcomplecspro.ru/failed',
  };

  if (!apiToken) {
    payload.Token = tinkoffToken(payload, password);
  }

  try {
    const response = await httpsJsonRequest({
      hostname: 'securepay.tinkoff.ru',
      path: '/v2/Init',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    res.status(response.status).json(response.data);
  } catch (e) {
    res.status(500).json({ error: 'Tinkoff init failed' });
  }
});

app.post('/api/payments/tinkoff/sbp-qr', authRequired, async (req, res) => {
  const { paymentId } = req.body || {};
  const terminalKey = process.env.TINKOFF_TERMINAL_KEY;
  const password = process.env.TINKOFF_PASSWORD;
  const apiToken = process.env.TINKOFF_API_TOKEN;
  if (!terminalKey || (!password && !apiToken)) return res.status(400).json({ error: 'Tinkoff keys missing' });
  if (!paymentId) return res.status(400).json({ error: 'PaymentId required' });

  const payload = { TerminalKey: terminalKey, PaymentId: paymentId, DataType: 'IMAGE' };
  if (!apiToken) payload.Token = tinkoffToken(payload, password);

  try {
    const response = await httpsJsonRequest({
      hostname: 'securepay.tinkoff.ru',
      path: '/v2/GetQr',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    res.status(response.status).json(response.data);
  } catch (e) {
    res.status(500).json({ error: 'Tinkoff SBP QR failed' });
  }
});

app.post('/api/payments/tinkoff/sberpay-qr', authRequired, async (req, res) => {
  const { paymentId } = req.body || {};
  const apiToken = process.env.TINKOFF_API_TOKEN;
  if (!apiToken) return res.status(400).json({ error: 'Tinkoff API token required for SberPay' });
  if (!paymentId) return res.status(400).json({ error: 'PaymentId required' });

  try {
    const response = await httpsJsonRequest({
      hostname: 'securepay.tinkoff.ru',
      path: `/v2/SberPay/${paymentId}/QR`,
      method: 'GET',
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    res.status(response.status).json(response.data);
  } catch (e) {
    res.status(500).json({ error: 'Tinkoff SberPay QR failed' });
  }
});

app.delete('/api/payments/:id', authRequired, (req, res) => {
  const id = req.params.id;
  if (req.user.role === 'Клиент') {
    return db.get('SELECT * FROM payments WHERE id = ?', [id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row || row.member !== req.user.name) return res.status(403).json({ error: 'Forbidden' });
      db.run('DELETE FROM payments WHERE id = ?', [id], function(err2) {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ success: true });
      });
    });
  }
  db.run('DELETE FROM payments WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API server listening on http://localhost:${PORT}`));

// --- Reports & Analytics ---
app.get('/api/reports/members', authRequired, requireRole(['Администратор']), (req, res) => {
  const { format = 'json', membership, status } = req.query;
  let query = 'SELECT * FROM members WHERE 1=1';
  const params = [];
  
  if (membership) { query += ' AND membership = ?'; params.push(membership); }
  if (status) { query += ' AND status = ?'; params.push(status); }
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (format === 'csv') {
      const csv = 'ID,Имя,Email,Телефон,Абонемент,Дата,Статус\n' + rows.map(r => `${r.id},"${r.name}","${r.email}","${r.phone}","${r.membership}","${r.joinDate}","${r.status}"`).join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="members_report.csv"');
      res.send(csv);
    } else {
      res.json({ data: rows, count: rows.length, timestamp: new Date().toISOString() });
    }
  });
});

app.get('/api/reports/payments', authRequired, requireRole(['Администратор']), (req, res) => {
  const { format = 'json', status } = req.query;
  let query = 'SELECT * FROM payments WHERE 1=1';
  const params = [];
  
  if (status) { query += ' AND status = ?'; params.push(status); }
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const total = rows.reduce((sum, r) => sum + (r.amount || 0), 0);
    
    if (format === 'csv') {
      const csv = 'ID,Клиент,Сумма,Метод,Дата,Статус\n' + rows.map(r => `${r.id},"${r.member}",${r.amount},"${r.method}","${r.date}","${r.status}"`).join('\n') + `\n\nОбщая сумма:,${total}`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="payments_report.csv"');
      res.send(csv);
    } else {
      res.json({ data: rows, total, count: rows.length, timestamp: new Date().toISOString() });
    }
  });
});

app.get('/api/reports/bookings', authRequired, requireRole(['Администратор']), (req, res) => {
  const { format = 'json', status } = req.query;
  let query = 'SELECT * FROM bookings WHERE 1=1';
  const params = [];
  
  if (status) { query += ' AND status = ?'; params.push(status); }
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (format === 'csv') {
      const csv = 'ID,Клиент,Тренировка,Дата,Время,Статус\n' + rows.map(r => `${r.id},"${r.member}","${r.className}","${r.date}","${r.time}","${r.status}"`).join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="bookings_report.csv"');
      res.send(csv);
    } else {
      res.json({ data: rows, count: rows.length, timestamp: new Date().toISOString() });
    }
  });
});

app.get('/api/reports/summary', authRequired, requireRole(['Администратор']), (req, res) => {
  let summary = {};
  
  db.get('SELECT COUNT(*) as count FROM members', (err, members) => {
    if (!err) summary.totalMembers = members.count;
    
    db.get('SELECT COUNT(*) as count FROM trainers', (err, trainers) => {
      if (!err) summary.totalTrainers = trainers.count;
      
      db.get('SELECT COUNT(*) as count FROM classes', (err, classes) => {
        if (!err) summary.totalClasses = classes.count;
        
        db.get('SELECT SUM(amount) as total FROM payments WHERE status = "Оплачен"', (err, payments) => {
          if (!err) summary.totalRevenue = payments.total || 0;
          
          db.get('SELECT COUNT(*) as count FROM bookings WHERE status = "Подтверждено"', (err, bookings) => {
            if (!err) summary.confirmedBookings = bookings.count;
            
            res.json({ summary, timestamp: new Date().toISOString() });
          });
        });
      });
    });
  });
});
