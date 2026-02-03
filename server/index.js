const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const https = require('https');
const { pool, init } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

init();

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function httpsJsonRequest({ hostname, path, method, headers, body }) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method, headers }, (res) => {
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

async function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const [rows] = await pool.query(
      'SELECT s.token, s.expiresAt, u.id, u.name, u.email, u.phone, u.role FROM sessions s JOIN users u ON s.userId = u.id WHERE s.token = ?',
      [token]
    );
    const row = rows[0];
    if (!row) return res.status(401).json({ error: 'Unauthorized' });
    if (row.expiresAt && new Date(row.expiresAt) < new Date()) return res.status(401).json({ error: 'Session expired' });
    req.user = { id: row.id, name: row.name, email: row.email, phone: row.phone, role: row.role, token: row.token };
    next();
  } catch (e) {
    res.status(500).json({ error: 'Auth error' });
  }
}

function requireRole(roles = []) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

app.get('/', (req, res) => {
  res.json({ message: 'Fitness Management API', version: '2.0.0', status: 'running' });
});

app.get('/api/ping', (req, res) => res.json({ ok: true }));

// --- Auth ---
app.post('/api/auth/register', async (req, res) => {
  const { name, email, phone, role, password } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'Missing fields' });
  try {
    const [exists] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (exists[0]) return res.status(409).json({ error: 'User already exists' });
    const [result] = await pool.query(
      'INSERT INTO users (name,email,phone,role,password) VALUES (?,?,?,?,?)',
      [name, email, phone || '', role || 'Клиент', password]
    );
    const [users] = await pool.query('SELECT id, name, email, phone, role FROM users WHERE id = ?', [result.insertId]);
    const user = users[0];
    const token = generateToken();
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
    await pool.query('INSERT INTO sessions (userId, token, createdAt, expiresAt) VALUES (?,?,?,?)', [user.id, token, createdAt, expiresAt]);
    if (user.role === 'Клиент') {
      await pool.query(
        'INSERT INTO members (name,email,phone,membership,joinDate,status) VALUES (?,?,?,?,?,?)',
        [user.name, user.email, user.phone, 'Базовый', new Date().toISOString().slice(0, 10), 'Активный']
      );
    }
    res.status(201).json({ user, token });
  } catch (e) {
    res.status(500).json({ error: 'Register failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });
  try {
    const [users] = await pool.query('SELECT id, name, email, phone, role, password FROM users WHERE email = ?', [email]);
    const user = users[0];
    if (!user || user.password !== password) return res.status(401).json({ error: 'Invalid credentials' });
    const token = generateToken();
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
    await pool.query('INSERT INTO sessions (userId, token, createdAt, expiresAt) VALUES (?,?,?,?)', [user.id, token, createdAt, expiresAt]);
    const { password: _pw, ...safeUser } = user;
    res.json({ user: safeUser, token });
  } catch (e) {
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/vk-demo', async (req, res) => {
  const demoUser = { name: 'VK Пользователь', email: 'vk_demo@vk.com', phone: '', role: 'Клиент' };
  try {
    const [exists] = await pool.query('SELECT * FROM users WHERE email = ?', [demoUser.email]);
    let user = exists[0];
    if (!user) {
      const [result] = await pool.query('INSERT INTO users (name,email,phone,role,password) VALUES (?,?,?,?,?)', [demoUser.name, demoUser.email, '', demoUser.role, 'vk_demo']);
      const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
      user = rows[0];
      await pool.query('INSERT INTO members (name,email,phone,membership,joinDate,status) VALUES (?,?,?,?,?,?)', [user.name, user.email, '', 'Базовый', new Date().toISOString().slice(0,10), 'Активный']);
    }
    const token = generateToken();
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
    await pool.query('INSERT INTO sessions (userId, token, createdAt, expiresAt) VALUES (?,?,?,?)', [user.id, token, createdAt, expiresAt]);
    res.json({ user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role }, token, demo: true });
  } catch (e) {
    res.status(500).json({ error: 'VK demo failed' });
  }
});

app.get('/api/auth/me', authRequired, (req, res) => {
  res.json({ user: { id: req.user.id, name: req.user.name, email: req.user.email, phone: req.user.phone, role: req.user.role } });
});

app.post('/api/auth/logout', authRequired, async (req, res) => {
  await pool.query('DELETE FROM sessions WHERE token = ?', [req.user.token]);
  res.json({ success: true });
});

// --- Members ---
app.get('/api/members', authRequired, async (req, res) => {
  try {
    if (req.user.role === 'Клиент') {
      const [rows] = await pool.query('SELECT * FROM members WHERE email = ? ORDER BY id DESC', [req.user.email]);
      return res.json(rows);
    }
    const [rows] = await pool.query('SELECT * FROM members ORDER BY id DESC');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Fetch failed' });
  }
});

app.post('/api/members', authRequired, requireRole(['Администратор', 'Тренер']), async (req, res) => {
  const { name, email, phone, membership, joinDate, status } = req.body;
  try {
    const [result] = await pool.query('INSERT INTO members (name,email,phone,membership,joinDate,status) VALUES (?,?,?,?,?,?)', [name, email, phone, membership, joinDate, status]);
    const [rows] = await pool.query('SELECT * FROM members WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'Create failed' });
  }
});

app.put('/api/members/:id', authRequired, requireRole(['Администратор', 'Тренер']), async (req, res) => {
  const id = req.params.id;
  const { name, email, phone, membership, joinDate, status } = req.body;
  try {
    await pool.query('UPDATE members SET name=?, email=?, phone=?, membership=?, joinDate=?, status=? WHERE id = ?', [name, email, phone, membership, joinDate, status, id]);
    const [rows] = await pool.query('SELECT * FROM members WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: 'Update failed' });
  }
});

app.delete('/api/members/:id', authRequired, requireRole(['Администратор', 'Тренер']), async (req, res) => {
  const id = req.params.id;
  await pool.query('DELETE FROM members WHERE id = ?', [id]);
  res.json({ success: true });
});

// --- Trainers ---
app.get('/api/trainers', authRequired, requireRole(['Администратор', 'Тренер']), async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM trainers ORDER BY id DESC');
  res.json(rows);
});

app.post('/api/trainers', authRequired, requireRole(['Администратор']), async (req, res) => {
  const { name, email, phone, specialty, experience, members: mcount, rating } = req.body;
  const [result] = await pool.query('INSERT INTO trainers (name,email,phone,specialty,experience,members,rating) VALUES (?,?,?,?,?,?,?)', [name, email, phone, specialty, experience, mcount || 0, rating || 0]);
  const [rows] = await pool.query('SELECT * FROM trainers WHERE id = ?', [result.insertId]);
  res.status(201).json(rows[0]);
});

app.put('/api/trainers/:id', authRequired, requireRole(['Администратор']), async (req, res) => {
  const id = req.params.id;
  const { name, email, phone, specialty, experience, members: mcount, rating } = req.body;
  await pool.query('UPDATE trainers SET name=?, email=?, phone=?, specialty=?, experience=?, members=?, rating=? WHERE id = ?', [name, email, phone, specialty, experience, mcount, rating, id]);
  const [rows] = await pool.query('SELECT * FROM trainers WHERE id = ?', [id]);
  res.json(rows[0]);
});

app.delete('/api/trainers/:id', authRequired, requireRole(['Администратор']), async (req, res) => {
  const id = req.params.id;
  await pool.query('DELETE FROM trainers WHERE id = ?', [id]);
  res.json({ success: true });
});

// --- Classes ---
app.get('/api/classes', authRequired, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM classes ORDER BY id DESC');
  res.json(rows);
});

app.post('/api/classes', authRequired, requireRole(['Администратор', 'Тренер']), async (req, res) => {
  const { name, trainerId, trainerName, schedule, capacity, enrolled, level } = req.body;
  const [result] = await pool.query('INSERT INTO classes (name,trainerId,trainerName,schedule,capacity,enrolled,level) VALUES (?,?,?,?,?,?,?)', [name, trainerId, trainerName, schedule, capacity, enrolled, level]);
  const [rows] = await pool.query('SELECT * FROM classes WHERE id = ?', [result.insertId]);
  res.status(201).json(rows[0]);
});

app.put('/api/classes/:id', authRequired, requireRole(['Администратор', 'Тренер']), async (req, res) => {
  const id = req.params.id;
  const { name, trainerId, trainerName, schedule, capacity, enrolled, level } = req.body;
  await pool.query('UPDATE classes SET name=?, trainerId=?, trainerName=?, schedule=?, capacity=?, enrolled=?, level=? WHERE id = ?', [name, trainerId, trainerName, schedule, capacity, enrolled, level, id]);
  const [rows] = await pool.query('SELECT * FROM classes WHERE id = ?', [id]);
  res.json(rows[0]);
});

app.delete('/api/classes/:id', authRequired, requireRole(['Администратор', 'Тренер']), async (req, res) => {
  const id = req.params.id;
  await pool.query('DELETE FROM classes WHERE id = ?', [id]);
  res.json({ success: true });
});

// --- Bookings ---
app.get('/api/bookings', authRequired, async (req, res) => {
  if (req.user.role === 'Клиент') {
    const [rows] = await pool.query('SELECT * FROM bookings WHERE member = ? ORDER BY id DESC', [req.user.name]);
    return res.json(rows);
  }
  const [rows] = await pool.query('SELECT * FROM bookings ORDER BY id DESC');
  res.json(rows);
});

app.post('/api/bookings', authRequired, async (req, res) => {
  const { member, classId, className, date, time, status } = req.body;
  const actualMember = req.user.role === 'Клиент' ? req.user.name : member;
  const [result] = await pool.query('INSERT INTO bookings (member,classId,className,date,time,status) VALUES (?,?,?,?,?,?)', [actualMember, classId, className, date, time, status]);
  const [rows] = await pool.query('SELECT * FROM bookings WHERE id = ?', [result.insertId]);
  res.status(201).json(rows[0]);
});

app.put('/api/bookings/:id', authRequired, async (req, res) => {
  const id = req.params.id;
  const { member, classId, className, date, time, status } = req.body;
  if (req.user.role === 'Клиент') {
    const [rows] = await pool.query('SELECT * FROM bookings WHERE id = ?', [id]);
    const row = rows[0];
    if (!row || row.member !== req.user.name) return res.status(403).json({ error: 'Forbidden' });
    await pool.query('UPDATE bookings SET member=?, classId=?, className=?, date=?, time=?, status=? WHERE id = ?', [req.user.name, classId, className, date, time, status, id]);
    const [updated] = await pool.query('SELECT * FROM bookings WHERE id = ?', [id]);
    return res.json(updated[0]);
  }
  await pool.query('UPDATE bookings SET member=?, classId=?, className=?, date=?, time=?, status=? WHERE id = ?', [member, classId, className, date, time, status, id]);
  const [rows] = await pool.query('SELECT * FROM bookings WHERE id = ?', [id]);
  res.json(rows[0]);
});

app.delete('/api/bookings/:id', authRequired, async (req, res) => {
  const id = req.params.id;
  if (req.user.role === 'Клиент') {
    const [rows] = await pool.query('SELECT * FROM bookings WHERE id = ?', [id]);
    const row = rows[0];
    if (!row || row.member !== req.user.name) return res.status(403).json({ error: 'Forbidden' });
  }
  await pool.query('DELETE FROM bookings WHERE id = ?', [id]);
  res.json({ success: true });
});

// --- Payments ---
app.get('/api/payments', authRequired, async (req, res) => {
  if (req.user.role === 'Клиент') {
    const [rows] = await pool.query('SELECT * FROM payments WHERE member = ? ORDER BY id DESC', [req.user.name]);
    return res.json(rows);
  }
  const [rows] = await pool.query('SELECT * FROM payments ORDER BY id DESC');
  res.json(rows);
});

app.post('/api/payments', authRequired, async (req, res) => {
  const { member, amount, method, date, status, receiptId, provider } = req.body;
  const actualMember = req.user.role === 'Клиент' ? req.user.name : member;
  const [result] = await pool.query('INSERT INTO payments (member,amount,method,date,status,receiptId,provider) VALUES (?,?,?,?,?,?,?)', [actualMember, amount, method, date, status, receiptId || null, provider || null]);
  const [rows] = await pool.query('SELECT * FROM payments WHERE id = ?', [result.insertId]);
  res.status(201).json(rows[0]);
});

app.put('/api/payments/:id', authRequired, async (req, res) => {
  const id = req.params.id;
  const { member, amount, method, date, status, receiptId, provider } = req.body;
  if (req.user.role === 'Клиент') {
    const [rows] = await pool.query('SELECT * FROM payments WHERE id = ?', [id]);
    const row = rows[0];
    if (!row || row.member !== req.user.name) return res.status(403).json({ error: 'Forbidden' });
    await pool.query('UPDATE payments SET member=?, amount=?, method=?, date=?, status=?, receiptId=?, provider=? WHERE id = ?', [req.user.name, amount, method, date, status, receiptId || row.receiptId, provider || row.provider, id]);
    const [updated] = await pool.query('SELECT * FROM payments WHERE id = ?', [id]);
    return res.json(updated[0]);
  }
  await pool.query('UPDATE payments SET member=?, amount=?, method=?, date=?, status=?, receiptId=?, provider=? WHERE id = ?', [member, amount, method, date, status, receiptId || null, provider || null, id]);
  const [rows] = await pool.query('SELECT * FROM payments WHERE id = ?', [id]);
  res.json(rows[0]);
});

app.delete('/api/payments/:id', authRequired, async (req, res) => {
  const id = req.params.id;
  if (req.user.role === 'Клиент') {
    const [rows] = await pool.query('SELECT * FROM payments WHERE id = ?', [id]);
    const row = rows[0];
    if (!row || row.member !== req.user.name) return res.status(403).json({ error: 'Forbidden' });
  }
  await pool.query('DELETE FROM payments WHERE id = ?', [id]);
  res.json({ success: true });
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

// --- Services ---
app.get('/api/services', authRequired, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM services ORDER BY id ASC');
  res.json(rows);
});

// --- Receipts ---
app.get('/api/receipts', authRequired, async (req, res) => {
  const query = req.user.role === 'Клиент'
    ? ['SELECT * FROM receipts WHERE memberName = ? ORDER BY id DESC', [req.user.name]]
    : ['SELECT * FROM receipts ORDER BY id DESC', []];
  const [rows] = await pool.query(query[0], query[1]);
  const normalized = rows.map(r => ({ ...r, items: JSON.parse(r.itemsJson || '[]') }));
  res.json(normalized);
});

app.post('/api/receipts', authRequired, async (req, res) => {
  const { memberId, memberName, membership, items, subtotal, discount, total, createdAt, note, paymentId } = req.body;
  if (req.user.role === 'Клиент') {
    const [members] = await pool.query('SELECT * FROM members WHERE email = ?', [req.user.email]);
    const memberRow = members[0];
    if (!memberRow) return res.status(400).json({ error: 'Member profile not found' });
    const [result] = await pool.query(
      'INSERT INTO receipts (memberId,memberName,membership,itemsJson,subtotal,discount,total,createdAt,note,paymentId) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [memberRow.id, req.user.name, memberRow.membership, JSON.stringify(items || []), subtotal, discount, total, createdAt, note || '', paymentId || null]
    );
    const [rows] = await pool.query('SELECT * FROM receipts WHERE id = ?', [result.insertId]);
    return res.status(201).json({ ...rows[0], items: JSON.parse(rows[0].itemsJson || '[]') });
  }
  const [result] = await pool.query(
    'INSERT INTO receipts (memberId,memberName,membership,itemsJson,subtotal,discount,total,createdAt,note,paymentId) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [memberId, memberName, membership, JSON.stringify(items || []), subtotal, discount, total, createdAt, note || '', paymentId || null]
  );
  const [rows] = await pool.query('SELECT * FROM receipts WHERE id = ?', [result.insertId]);
  res.status(201).json({ ...rows[0], items: JSON.parse(rows[0].itemsJson || '[]') });
});

app.put('/api/receipts/:id', authRequired, async (req, res) => {
  const id = req.params.id;
  const { paymentId, note } = req.body;
  if (req.user.role === 'Клиент') {
    const [rows] = await pool.query('SELECT * FROM receipts WHERE id = ?', [id]);
    const row = rows[0];
    if (!row || row.memberName !== req.user.name) return res.status(403).json({ error: 'Forbidden' });
  }
  await pool.query('UPDATE receipts SET paymentId = COALESCE(?, paymentId), note = COALESCE(?, note) WHERE id = ?', [paymentId, note, id]);
  const [rows] = await pool.query('SELECT * FROM receipts WHERE id = ?', [id]);
  res.json({ ...rows[0], items: JSON.parse(rows[0].itemsJson || '[]') });
});

// --- Deals ---
app.get('/api/deals', authRequired, requireRole(['Администратор', 'Тренер']), async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM deals ORDER BY id DESC');
  res.json(rows);
});

app.post('/api/deals', authRequired, requireRole(['Администратор', 'Тренер']), async (req, res) => {
  const { client, offer, value, stage, probability, manager, nextStep, date } = req.body;
  const [result] = await pool.query('INSERT INTO deals (client,offer,value,stage,probability,manager,nextStep,date) VALUES (?,?,?,?,?,?,?,?)', [client, offer, value, stage, probability, manager, nextStep, date]);
  const [rows] = await pool.query('SELECT * FROM deals WHERE id = ?', [result.insertId]);
  res.status(201).json(rows[0]);
});

app.put('/api/deals/:id', authRequired, requireRole(['Администратор', 'Тренер']), async (req, res) => {
  const id = req.params.id;
  const { client, offer, value, stage, probability, manager, nextStep, date } = req.body;
  await pool.query('UPDATE deals SET client=?, offer=?, value=?, stage=?, probability=?, manager=?, nextStep=?, date=? WHERE id = ?', [client, offer, value, stage, probability, manager, nextStep, date, id]);
  const [rows] = await pool.query('SELECT * FROM deals WHERE id = ?', [id]);
  res.json(rows[0]);
});

app.delete('/api/deals/:id', authRequired, requireRole(['Администратор', 'Тренер']), async (req, res) => {
  const id = req.params.id;
  await pool.query('DELETE FROM deals WHERE id = ?', [id]);
  res.json({ success: true });
});

// --- Forecast ---
app.get('/api/forecast', authRequired, requireRole(['Администратор', 'Тренер']), async (req, res) => {
  const [rows] = await pool.query('SELECT month, visits, pool, tennis FROM demand_history ORDER BY id ASC');
  res.json({ history: rows });
});

// --- Search ---
app.get('/api/search', authRequired, requireRole(['Администратор', 'Тренер']), async (req, res) => {
  const q = String(req.query.q || '').toLowerCase();
  if (!q) return res.json({ members: [], trainers: [], classes: [], deals: [], receipts: [] });
  const like = `%${q}%`;
  const [members] = await pool.query('SELECT * FROM members WHERE LOWER(name) LIKE ? OR LOWER(email) LIKE ? OR LOWER(membership) LIKE ?', [like, like, like]);
  const [trainers] = await pool.query('SELECT * FROM trainers WHERE LOWER(name) LIKE ? OR LOWER(specialty) LIKE ?', [like, like]);
  const [classes] = await pool.query('SELECT * FROM classes WHERE LOWER(name) LIKE ? OR LOWER(level) LIKE ?', [like, like]);
  const [deals] = await pool.query('SELECT * FROM deals WHERE LOWER(client) LIKE ? OR LOWER(offer) LIKE ? OR LOWER(manager) LIKE ?', [like, like, like]);
  const [receipts] = await pool.query('SELECT * FROM receipts WHERE LOWER(memberName) LIKE ? OR LOWER(membership) LIKE ? OR LOWER(note) LIKE ?', [like, like, like]);
  res.json({ members, trainers, classes, deals, receipts: receipts.map(r => ({ ...r, items: JSON.parse(r.itemsJson || '[]') })) });
});

// --- Reports ---
app.get('/api/reports/members', authRequired, requireRole(['Администратор']), async (req, res) => {
  const { format = 'json', membership, status } = req.query;
  let query = 'SELECT * FROM members WHERE 1=1';
  const params = [];
  if (membership) { query += ' AND membership = ?'; params.push(membership); }
  if (status) { query += ' AND status = ?'; params.push(status); }
  const [rows] = await pool.query(query, params);
  if (format === 'csv') {
    const csv = 'ID,Имя,Email,Телефон,Абонемент,Дата,Статус\n' + rows.map(r => `${r.id},"${r.name}","${r.email}","${r.phone}","${r.membership}","${r.joinDate}","${r.status}"`).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="members_report.csv"');
    return res.send(csv);
  }
  res.json({ data: rows, count: rows.length, timestamp: new Date().toISOString() });
});

app.get('/api/reports/payments', authRequired, requireRole(['Администратор']), async (req, res) => {
  const { format = 'json', status } = req.query;
  let query = 'SELECT * FROM payments WHERE 1=1';
  const params = [];
  if (status) { query += ' AND status = ?'; params.push(status); }
  const [rows] = await pool.query(query, params);
  const total = rows.reduce((sum, r) => sum + (r.amount || 0), 0);
  if (format === 'csv') {
    const csv = 'ID,Клиент,Сумма,Метод,Дата,Статус\n' + rows.map(r => `${r.id},"${r.member}",${r.amount},"${r.method}","${r.date}","${r.status}"`).join('\n') + `\n\nОбщая сумма:,${total}`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="payments_report.csv"');
    return res.send(csv);
  }
  res.json({ data: rows, total, count: rows.length, timestamp: new Date().toISOString() });
});

app.get('/api/reports/bookings', authRequired, requireRole(['Администратор']), async (req, res) => {
  const { format = 'json', status } = req.query;
  let query = 'SELECT * FROM bookings WHERE 1=1';
  const params = [];
  if (status) { query += ' AND status = ?'; params.push(status); }
  const [rows] = await pool.query(query, params);
  if (format === 'csv') {
    const csv = 'ID,Клиент,Тренировка,Дата,Время,Статус\n' + rows.map(r => `${r.id},"${r.member}","${r.className}","${r.date}","${r.time}","${r.status}"`).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="bookings_report.csv"');
    return res.send(csv);
  }
  res.json({ data: rows, count: rows.length, timestamp: new Date().toISOString() });
});

app.get('/api/reports/summary', authRequired, requireRole(['Администратор']), async (req, res) => {
  const [[members]] = await pool.query('SELECT COUNT(*) AS count FROM members');
  const [[trainers]] = await pool.query('SELECT COUNT(*) AS count FROM trainers');
  const [[classes]] = await pool.query('SELECT COUNT(*) AS count FROM classes');
  const [[payments]] = await pool.query('SELECT SUM(amount) AS total FROM payments WHERE status = "Оплачен"');
  const [[bookings]] = await pool.query('SELECT COUNT(*) AS count FROM bookings WHERE status = "Подтверждено"');
  const summary = {
    totalMembers: members.count,
    totalTrainers: trainers.count,
    totalClasses: classes.count,
    totalRevenue: payments.total || 0,
    confirmedBookings: bookings.count,
  };
  res.json({ summary, timestamp: new Date().toISOString() });
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
  if (!apiToken) payload.Token = tinkoffToken(payload, password);
  try {
    const response = await httpsJsonRequest({
      hostname: 'securepay.tinkoff.ru',
      path: '/v2/Init',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}) },
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
      headers: { 'Content-Type': 'application/json', ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}) },
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

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API server listening on http://localhost:${PORT}`));
