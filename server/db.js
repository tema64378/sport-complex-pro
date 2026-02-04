const mysql = require('mysql2/promise');

const {
  DB_HOST = '127.0.0.1',
  DB_PORT = '3306',
  DB_USER = 'sport_user',
  DB_PASSWORD = 'sport_pass',
  DB_NAME = 'sport_complex',
} = process.env;

const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS members (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255),
      email VARCHAR(255),
      phone VARCHAR(255),
      membership VARCHAR(64),
      joinDate VARCHAR(32),
      status VARCHAR(64)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS trainers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255),
      email VARCHAR(255),
      phone VARCHAR(255),
      specialty VARCHAR(128),
      experience VARCHAR(64),
      members INT,
      rating DECIMAL(3,2)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS classes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255),
      trainerId INT,
      trainerName VARCHAR(255),
      schedule VARCHAR(255),
      capacity INT,
      enrolled INT,
      level VARCHAR(64)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      member VARCHAR(255),
      classId INT,
      className VARCHAR(255),
      date VARCHAR(32),
      time VARCHAR(32),
      status VARCHAR(64)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      member VARCHAR(255),
      amount INT,
      method VARCHAR(128),
      date VARCHAR(32),
      status VARCHAR(64),
      receiptId INT,
      provider VARCHAR(128)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255),
      email VARCHAR(255) UNIQUE,
      phone VARCHAR(255),
      role VARCHAR(64),
      password VARCHAR(255)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      userId INT,
      token VARCHAR(255) UNIQUE,
      createdAt VARCHAR(64),
      expiresAt VARCHAR(64)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS services (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255),
      category VARCHAR(128),
      price INT,
      unit VARCHAR(64),
      description VARCHAR(255)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS receipts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      memberId INT,
      memberName VARCHAR(255),
      membership VARCHAR(64),
      itemsJson TEXT,
      subtotal INT,
      discount INT,
      total INT,
      createdAt VARCHAR(64),
      note TEXT,
      paymentId INT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS deals (
      id INT AUTO_INCREMENT PRIMARY KEY,
      client VARCHAR(255),
      offer VARCHAR(255),
      value INT,
      stage VARCHAR(64),
      probability INT,
      manager VARCHAR(128),
      nextStep VARCHAR(255),
      date VARCHAR(32)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS demand_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      month VARCHAR(16),
      visits INT,
      pool INT,
      tennis INT
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS workout_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255),
      description VARCHAR(255),
      category VARCHAR(64),
      level VARCHAR(64),
      duration INT,
      defaultCapacity INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [[membersCnt]] = await pool.query('SELECT COUNT(*) AS cnt FROM members');
  if (membersCnt.cnt === 0) {
    await pool.query(
      'INSERT INTO members (name,email,phone,membership,joinDate,status) VALUES (?,?,?,?,?,?)',
      ['Мария Иванова', 'maria.ivanova@mail.ru', '+7 (910) 111-01-01', 'Премиум', '2023-01-15', 'Активный']
    );
    await pool.query(
      'INSERT INTO members (name,email,phone,membership,joinDate,status) VALUES (?,?,?,?,?,?)',
      ['Сергей Кузнецов', 'sergey.kuznetsov@mail.ru', '+7 (910) 111-02-02', 'Стандарт', '2023-02-20', 'Активный']
    );
  }

  const [[trainersCnt]] = await pool.query('SELECT COUNT(*) AS cnt FROM trainers');
  if (trainersCnt.cnt === 0) {
    await pool.query(
      'INSERT INTO trainers (name,email,phone,specialty,experience,members,rating) VALUES (?,?,?,?,?,?,?)',
      ['Светлана Смирнова', 'svetlana.smirnova@mail.ru', '+7 (915) 200-01-01', 'Йога', '8 лет', 24, 4.8]
    );
    await pool.query(
      'INSERT INTO trainers (name,email,phone,specialty,experience,members,rating) VALUES (?,?,?,?,?,?,?)',
      ['Иван Иванов', 'ivan.ivanov@mail.ru', '+7 (915) 200-02-02', 'Кроссфит', '6 лет', 32, 4.9]
    );
  }

  const [[classesCnt]] = await pool.query('SELECT COUNT(*) AS cnt FROM classes');
  if (classesCnt.cnt === 0) {
    await pool.query(
      'INSERT INTO classes (name,trainerId,trainerName,schedule,capacity,enrolled,level) VALUES (?,?,?,?,?,?,?)',
      ['Йога для начинающих', 1, 'Светлана Смирнова', 'вт, ср, пт - 09:00', 20, 18, 'Начинающие']
    );
    await pool.query(
      'INSERT INTO classes (name,trainerId,trainerName,schedule,capacity,enrolled,level) VALUES (?,?,?,?,?,?,?)',
      ['Кроссфит', 2, 'Иван Иванов', 'Каждый день - 10:00', 15, 15, 'Средние']
    );
  }

  const [[bookingsCnt]] = await pool.query('SELECT COUNT(*) AS cnt FROM bookings');
  if (bookingsCnt.cnt === 0) {
    await pool.query(
      'INSERT INTO bookings (member,classId,className,date,time,status) VALUES (?,?,?,?,?,?)',
      ['Мария Иванова', 1, 'Йога для начинающих', '2024-01-29', '09:00', 'Подтверждено']
    );
    await pool.query(
      'INSERT INTO bookings (member,classId,className,date,time,status) VALUES (?,?,?,?,?,?)',
      ['Сергей Кузнецов', 2, 'Кроссфит', '2024-01-29', '10:00', 'Подтверждено']
    );
  }

  const [[paymentsCnt]] = await pool.query('SELECT COUNT(*) AS cnt FROM payments');
  if (paymentsCnt.cnt === 0) {
    await pool.query(
      'INSERT INTO payments (member,amount,method,date,status) VALUES (?,?,?,?,?)',
      ['Мария Иванова', 9999, 'Кредитная карта', '2024-01-28', 'Оплачен']
    );
    await pool.query(
      'INSERT INTO payments (member,amount,method,date,status) VALUES (?,?,?,?,?)',
      ['Сергей Кузнецов', 14999, 'Банк перевод', '2024-01-27', 'Оплачен']
    );
  }

  const [[usersCnt]] = await pool.query('SELECT COUNT(*) AS cnt FROM users');
  if (usersCnt.cnt === 0) {
    await pool.query(
      'INSERT INTO users (name,email,phone,role,password) VALUES (?,?,?,?,?)',
      ['Администратор', 'admin@sportcomplex.com', '+7 (495) 123-45-67', 'Администратор', 'admin123']
    );
    await pool.query(
      'INSERT INTO users (name,email,phone,role,password) VALUES (?,?,?,?,?)',
      ['Тренер Мария', 'coach.maria@sportcomplex.com', '+7 (910) 555-22-11', 'Тренер', 'coach123']
    );
  }

  const [[servicesCnt]] = await pool.query('SELECT COUNT(*) AS cnt FROM services');
  if (servicesCnt.cnt === 0) {
    await pool.query('INSERT INTO services (name,category,price,unit,description) VALUES (?,?,?,?,?)',
      ['Доступ в тренажерный зал', 'Фитнес', 600, 'посещение', 'Свободный доступ к тренажерам']);
    await pool.query('INSERT INTO services (name,category,price,unit,description) VALUES (?,?,?,?,?)',
      ['Персональная тренировка', 'Тренер', 1800, 'час', 'Индивидуальная работа с тренером']);
    await pool.query('INSERT INTO services (name,category,price,unit,description) VALUES (?,?,?,?,?)',
      ['Консультация тренера', 'Тренер', 900, 'сессия', 'Подбор плана и рекомендаций']);
    await pool.query('INSERT INTO services (name,category,price,unit,description) VALUES (?,?,?,?,?)',
      ['Бассейн', 'Вода', 700, 'час', 'Доступ в бассейн и сауну']);
    await pool.query('INSERT INTO services (name,category,price,unit,description) VALUES (?,?,?,?,?)',
      ['Теннисный корт', 'Спорт', 1200, 'час', 'Аренда корта и инвентаря']);
    await pool.query('INSERT INTO services (name,category,price,unit,description) VALUES (?,?,?,?,?)',
      ['Групповое занятие', 'Группы', 500, 'занятие', 'Йога, пилатес, функционал']);
  }

  const [[dealsCnt]] = await pool.query('SELECT COUNT(*) AS cnt FROM deals');
  if (dealsCnt.cnt === 0) {
    await pool.query('INSERT INTO deals (client,offer,value,stage,probability,manager,nextStep,date) VALUES (?,?,?,?,?,?,?,?)',
      ['Мария Иванова', 'Премиум абонемент 6 мес', 32000, 'Переговоры', 60, 'Ирина', 'Согласовать скидку', '2026-02-01']);
    await pool.query('INSERT INTO deals (client,offer,value,stage,probability,manager,nextStep,date) VALUES (?,?,?,?,?,?,?,?)',
      ['ООО Альфа', 'Корпоративные тренировки', 120000, 'Предложение', 45, 'Антон', 'Отправить договор', '2026-01-28']);
  }

  const [[templatesCnt]] = await pool.query('SELECT COUNT(*) AS cnt FROM workout_templates');
  if (templatesCnt.cnt === 0) {
    const templates = [
      ['Йога для начинающих', 'Базовые позы йоги для новичков', 'Йога', 'Начинающие', 60, 20],
      ['Йога продвинутая', 'Сложные асаны и практики', 'Йога', 'Продвинутые', 90, 15],
      ['Кроссфит', 'Функциональный тренинг высокой интенсивности', 'Функционал', 'Средние', 60, 15],
      ['Кроссфит PRO', 'Продвинутый кроссфит с тяжелыми весами', 'Функционал', 'Продвинутые', 75, 12],
      ['Пилатес', 'Укрепление корпуса и гибкость', 'Пилатес', 'Начинающие', 60, 18],
      ['Пилатес для продвинутых', 'Интенсивный пилатес на тренажерах', 'Пилатес', 'Продвинутые', 50, 12],
      ['Аэробика', 'Кардио-тренировка под музыку', 'Кардио', 'Начинающие', 45, 25],
      ['Степ-аэробика', 'Интенсивная кардио на степ-платформе', 'Кардио', 'Средние', 50, 20],
      ['Бокс', 'Техника бокса и кардио', 'Боевые искусства', 'Средние', 60, 12],
      ['Муай-тай', 'Таиландский бокс', 'Боевые искусства', 'Средние', 60, 10],
      ['Плавание для начинающих', 'Обучение плаванию с инструктором', 'Вода', 'Начинающие', 45, 8],
      ['Аквааэробика', 'Кардио в воде', 'Вода', 'Все уровни', 50, 15],
      ['Растяжка и гибкость', 'Стретчинг и подвижность', 'Функционал', 'Начинающие', 45, 20],
      ['Силовая тренировка', 'Работа с тяжелыми весами', 'Силовая', 'Средние', 60, 12],
      ['TRX подвес', 'Функциональный тренинг на подвесах', 'Функционал', 'Средние', 45, 10],
      ['Йога восстановления', 'Мягкая йога для релаксации и восстановления', 'Йога', 'Все уровни', 75, 20],
    ];
    for (const t of templates) {
      await pool.query(
        'INSERT INTO workout_templates (name,description,category,level,duration,defaultCapacity) VALUES (?,?,?,?,?,?)',
        t
      );
    }
  }

  const [[demandCnt]] = await pool.query('SELECT COUNT(*) AS cnt FROM demand_history');
  if (demandCnt.cnt === 0) {
    await pool.query('INSERT INTO demand_history (month,visits,pool,tennis) VALUES (?,?,?,?)', ['Авг', 820, 260, 140]);
    await pool.query('INSERT INTO demand_history (month,visits,pool,tennis) VALUES (?,?,?,?)', ['Сен', 870, 300, 150]);
    await pool.query('INSERT INTO demand_history (month,visits,pool,tennis) VALUES (?,?,?,?)', ['Окт', 910, 320, 160]);
    await pool.query('INSERT INTO demand_history (month,visits,pool,tennis) VALUES (?,?,?,?)', ['Ноя', 980, 340, 180]);
    await pool.query('INSERT INTO demand_history (month,visits,pool,tennis) VALUES (?,?,?,?)', ['Дек', 1020, 360, 200]);
    await pool.query('INSERT INTO demand_history (month,visits,pool,tennis) VALUES (?,?,?,?)', ['Янв', 1100, 390, 220]);
  }
}

module.exports = { pool, init };
