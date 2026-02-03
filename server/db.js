const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'data.db');

const db = new sqlite3.Database(dbPath);

function init() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY,
        name TEXT,
        email TEXT,
        phone TEXT,
        membership TEXT,
        joinDate TEXT,
        status TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS trainers (
        id INTEGER PRIMARY KEY,
        name TEXT,
        email TEXT,
        phone TEXT,
        specialty TEXT,
        experience TEXT,
        members INTEGER,
        rating REAL
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY,
        name TEXT,
        trainerId INTEGER,
        trainerName TEXT,
        schedule TEXT,
        capacity INTEGER,
        enrolled INTEGER,
        level TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY,
        member TEXT,
        classId INTEGER,
        className TEXT,
        date TEXT,
        time TEXT,
        status TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY,
        member TEXT,
        amount INTEGER,
        method TEXT,
        date TEXT,
        status TEXT,
        receiptId INTEGER,
        provider TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE,
        phone TEXT,
        role TEXT,
        password TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY,
        userId INTEGER,
        token TEXT UNIQUE,
        createdAt TEXT,
        expiresAt TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY,
        name TEXT,
        category TEXT,
        price INTEGER,
        unit TEXT,
        description TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS receipts (
        id INTEGER PRIMARY KEY,
        memberId INTEGER,
        memberName TEXT,
        membership TEXT,
        itemsJson TEXT,
        subtotal INTEGER,
        discount INTEGER,
        total INTEGER,
        createdAt TEXT,
        note TEXT,
        paymentId INTEGER
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS deals (
        id INTEGER PRIMARY KEY,
        client TEXT,
        offer TEXT,
        value INTEGER,
        stage TEXT,
        probability INTEGER,
        manager TEXT,
        nextStep TEXT,
        date TEXT
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS demand_history (
        id INTEGER PRIMARY KEY,
        month TEXT,
        visits INTEGER,
        pool INTEGER,
        tennis INTEGER
      )
    `);

    // ensure payment has receiptId column in existing DBs
    db.all('PRAGMA table_info(payments)', (err, rows) => {
      if (err) return;
      const hasReceiptId = rows.some(r => r.name === 'receiptId');
      if (!hasReceiptId) {
        db.run('ALTER TABLE payments ADD COLUMN receiptId INTEGER');
      }
      const hasProvider = rows.some(r => r.name === 'provider');
      if (!hasProvider) {
        db.run('ALTER TABLE payments ADD COLUMN provider TEXT');
      }
    });

    // seed if empty for members
    db.get('SELECT COUNT(*) as cnt FROM members', (err, row) => {
      if (!err && row && row.cnt === 0) {
        const stmt = db.prepare('INSERT INTO members (name,email,phone,membership,joinDate,status) VALUES (?,?,?,?,?,?)');
        stmt.run('Мария Иванова', 'maria.ivanova@mail.ru', '+7 (910) 111-01-01', 'Премиум', '2023-01-15', 'Активный');
        stmt.run('Сергей Кузнецов', 'sergey.kuznetsov@mail.ru', '+7 (910) 111-02-02', 'Стандарт', '2023-02-20', 'Активный');
        stmt.run('Ольга Петрова', 'olga.petrova@mail.ru', '+7 (910) 111-03-03', 'Премиум', '2023-03-10', 'Активный');
        stmt.finalize();
      }
    });

    // seed trainers
    db.get('SELECT COUNT(*) as cnt FROM trainers', (err, row) => {
      if (!err && row && row.cnt === 0) {
        const stmt = db.prepare('INSERT INTO trainers (name,email,phone,specialty,experience,members,rating) VALUES (?,?,?,?,?,?,?)');
        stmt.run('Светлана Смирнова', 'svetlana.smirnova@mail.ru', '+7 (915) 200-01-01', 'Йога', '8 лет', 24, 4.8);
        stmt.run('Иван Иванов', 'ivan.ivanov@mail.ru', '+7 (915) 200-02-02', 'Кроссфит', '6 лет', 32, 4.9);
        stmt.finalize();
      }
    });

    // seed classes
    db.get('SELECT COUNT(*) as cnt FROM classes', (err, row) => {
      if (!err && row && row.cnt === 0) {
        const stmt = db.prepare('INSERT INTO classes (name,trainerId,trainerName,schedule,capacity,enrolled,level) VALUES (?,?,?,?,?,?,?)');
        stmt.run('Йога для начинающих', 1, 'Светлана Смирнова', 'вт, ср, пт - 09:00', 20, 18, 'Начинающие');
        stmt.run('Кроссфит', 2, 'Иван Иванов', 'Каждый день - 10:00', 15, 15, 'Средние');
        stmt.finalize();
      }
    });

    // seed bookings
    db.get('SELECT COUNT(*) as cnt FROM bookings', (err, row) => {
      if (!err && row && row.cnt === 0) {
        const stmt = db.prepare('INSERT INTO bookings (member,classId,className,date,time,status) VALUES (?,?,?,?,?,?)');
        stmt.run('Мария Иванова', 1, 'Йога для начинающих', '2024-01-29', '09:00', 'Подтверждено');
        stmt.run('Сергей Кузнецов', 2, 'Кроссфит', '2024-01-29', '10:00', 'Подтверждено');
        stmt.finalize();
      }
    });

    // seed payments
    db.get('SELECT COUNT(*) as cnt FROM payments', (err, row) => {
      if (!err && row && row.cnt === 0) {
        const stmt = db.prepare('INSERT INTO payments (member,amount,method,date,status) VALUES (?,?,?,?,?)');
        stmt.run('Мария Иванова', 9999, 'Кредитная карта', '2024-01-28', 'Оплачен');
        stmt.run('Сергей Кузнецов', 14999, 'Банк перевод', '2024-01-27', 'Оплачен');
        stmt.finalize();
      }
    });

    // seed users
    db.get('SELECT COUNT(*) as cnt FROM users', (err, row) => {
      if (!err && row && row.cnt === 0) {
        const stmt = db.prepare('INSERT INTO users (name,email,phone,role,password) VALUES (?,?,?,?,?)');
        stmt.run('Администратор', 'admin@sportcomplex.com', '+7 (495) 123-45-67', 'Администратор', 'admin123');
        stmt.run('Тренер Мария', 'coach.maria@sportcomplex.com', '+7 (910) 555-22-11', 'Тренер', 'coach123');
        stmt.finalize();
      }
    });

    // seed services
    db.get('SELECT COUNT(*) as cnt FROM services', (err, row) => {
      if (!err && row && row.cnt === 0) {
        const stmt = db.prepare('INSERT INTO services (name,category,price,unit,description) VALUES (?,?,?,?,?)');
        stmt.run('Доступ в тренажерный зал', 'Фитнес', 600, 'посещение', 'Свободный доступ к тренажерам');
        stmt.run('Персональная тренировка', 'Тренер', 1800, 'час', 'Индивидуальная работа с тренером');
        stmt.run('Консультация тренера', 'Тренер', 900, 'сессия', 'Подбор плана и рекомендаций');
        stmt.run('Бассейн', 'Вода', 700, 'час', 'Доступ в бассейн и сауну');
        stmt.run('Теннисный корт', 'Спорт', 1200, 'час', 'Аренда корта и инвентаря');
        stmt.run('Групповое занятие', 'Группы', 500, 'занятие', 'Йога, пилатес, функционал');
        stmt.finalize();
      }
    });

    // seed deals
    db.get('SELECT COUNT(*) as cnt FROM deals', (err, row) => {
      if (!err && row && row.cnt === 0) {
        const stmt = db.prepare('INSERT INTO deals (client,offer,value,stage,probability,manager,nextStep,date) VALUES (?,?,?,?,?,?,?,?)');
        stmt.run('Мария Иванова', 'Премиум абонемент 6 мес', 32000, 'Переговоры', 60, 'Ирина', 'Согласовать скидку', '2026-02-01');
        stmt.run('ООО Альфа', 'Корпоративные тренировки', 120000, 'Предложение', 45, 'Антон', 'Отправить договор', '2026-01-28');
        stmt.run('Сергей Кузнецов', 'Персональные тренировки (10)', 16000, 'Закрыто', 100, 'Мария', 'Оплата получена', '2026-01-24');
        stmt.finalize();
      }
    });

    // seed demand history
    db.get('SELECT COUNT(*) as cnt FROM demand_history', (err, row) => {
      if (!err && row && row.cnt === 0) {
        const stmt = db.prepare('INSERT INTO demand_history (month,visits,pool,tennis) VALUES (?,?,?,?)');
        stmt.run('Авг', 820, 260, 140);
        stmt.run('Сен', 870, 300, 150);
        stmt.run('Окт', 910, 320, 160);
        stmt.run('Ноя', 980, 340, 180);
        stmt.run('Дек', 1020, 360, 200);
        stmt.run('Янв', 1100, 390, 220);
        stmt.finalize();
      }
    });
  });
}

module.exports = { db, init };
