import React, { useEffect, useMemo, useState } from 'react';
import { logoutUser, fetchMe } from './api';
import TopNav from './components/TopNav';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import Trainers from './pages/Trainers';
import Classes from './pages/Classes';
import Bookings from './pages/Bookings';
import Payments from './pages/Payments';
import Analytics from './pages/Analytics';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Users from './pages/Users';
import Auth from './pages/Auth';
import Services from './pages/Services';
import Deals from './pages/Deals';
import Forecast from './pages/Forecast';
import Search from './pages/Search';
import Client from './pages/Client';
import Notifications from './pages/Notifications';
import Memberships from './pages/Memberships';
import Calendar from './pages/Calendar';
import Crm from './pages/Crm';
import DatabaseAdmin from './pages/DatabaseAdmin';
import News from './pages/News';

const MENU_ITEMS = [
  { id: 'dashboard', label: 'Главная', icon: 'fas fa-chart-line' },
  { id: 'news', label: 'Новости', icon: 'fas fa-newspaper' },
  { id: 'notifications', label: 'Уведомления', icon: 'fas fa-bell' },
  { id: 'members', label: 'Клиенты', icon: 'fas fa-users' },
  { id: 'crm', label: 'CRM профили', icon: 'fas fa-address-card' },
  { id: 'trainers', label: 'Тренеры', icon: 'fas fa-person' },
  { id: 'memberships', label: 'Абонементы', icon: 'fas fa-ticket' },
  { id: 'classes', label: 'Тренировки', icon: 'fas fa-dumbbell' },
  { id: 'bookings', label: 'Бронирования', icon: 'fas fa-calendar' },
  { id: 'calendar', label: 'Календарь', icon: 'fas fa-calendar-days' },
  { id: 'services', label: 'Услуги и чек', icon: 'fas fa-receipt' },
  { id: 'deals', label: 'Сделки', icon: 'fas fa-handshake' },
  { id: 'payments', label: 'Платежи', icon: 'fas fa-credit-card' },
  { id: 'analytics', label: 'Аналитика', icon: 'fas fa-chart-bar' },
  { id: 'forecast', label: 'Прогноз спроса', icon: 'fas fa-wave-square' },
  { id: 'reports', label: 'Отчеты', icon: 'fas fa-file-csv' },
  { id: 'search', label: 'Быстрый поиск', icon: 'fas fa-magnifying-glass' },
  { id: 'users', label: 'Пользователи', icon: 'fas fa-user-shield' },
  { id: 'database', label: 'База данных', icon: 'fas fa-database' },
  { id: 'settings', label: 'Параметры', icon: 'fas fa-cog' },
  { id: 'client', label: 'Мой кабинет', icon: 'fas fa-id-badge' },
  { id: 'auth', label: 'Вход', icon: 'fas fa-user-circle' },
];

const PAGE_META = {
  dashboard: { title: 'Панель управления', subtitle: 'Ключевые показатели, тренды и быстрые действия.' },
  news: { title: 'Новости клуба', subtitle: 'Анонсы, обновления сервиса и важные объявления.' },
  notifications: { title: 'Уведомления', subtitle: 'Сообщения для команды и клиентов в реальном времени.' },
  members: { title: 'Клиенты', subtitle: 'Профили, статусы и история взаимодействий.' },
  crm: { title: 'CRM профили', subtitle: 'Сегментация, коммуникации и воронка продаж.' },
  trainers: { title: 'Тренеры', subtitle: 'Команда, специализации и загрузка расписания.' },
  memberships: { title: 'Абонементы', subtitle: 'Тарифы, условия и активные подписки.' },
  classes: { title: 'Тренировки', subtitle: 'Управление группами, слотами и посещаемостью.' },
  bookings: { title: 'Бронирования', subtitle: 'Записи клиентов и контроль заполненности.' },
  calendar: { title: 'Календарь', subtitle: 'Расписание клуба по дням и залам.' },
  services: { title: 'Услуги', subtitle: 'Чек, продажи и дополнительные опции.' },
  deals: { title: 'Сделки', subtitle: 'Коммерческие предложения и этапы оплаты.' },
  payments: { title: 'Платежи', subtitle: 'Транзакции, статусы и финансовая дисциплина.' },
  analytics: { title: 'Аналитика', subtitle: 'Показатели эффективности и рост выручки.' },
  forecast: { title: 'Прогноз', subtitle: 'Оценка спроса и планирование нагрузки.' },
  reports: { title: 'Отчеты', subtitle: 'Экспорт сводок и аналитических таблиц.' },
  search: { title: 'Поиск', subtitle: 'Быстрая навигация по данным системы.' },
  users: { title: 'Пользователи', subtitle: 'Роли, права доступа и безопасность аккаунтов.' },
  database: { title: 'База данных', subtitle: 'Администрирование, выборки и контроль изменений.' },
  settings: { title: 'Параметры', subtitle: 'Конфигурация платформы и рабочих процессов.' },
  client: { title: 'Личный кабинет', subtitle: 'Персональная информация, записи и платежи.' },
  auth: { title: 'Вход и регистрация', subtitle: 'Авторизация и управление доступом.' },
};

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [session, setSession] = useState(() => {
    try {
      const raw = localStorage.getItem('auth_session');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  });
  const [theme, setTheme] = useState(() => {
    try {
      if (localStorage.getItem('theme')) return localStorage.getItem('theme');
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      return prefersDark ? 'dark' : 'light';
    } catch (e) { return 'light'; }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch (e) {}
  }, [theme]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const vkToken = url.searchParams.get('vk_token');
    if (vkToken) {
      try { localStorage.setItem('auth_token', vkToken); } catch (e) {}
      url.searchParams.delete('vk_token');
      window.history.replaceState({}, '', url.toString());
    }
    if (session) return;
    let mounted = true;
    (async () => {
      try {
        const res = await fetchMe();
        if (!mounted) return;
        const nextSession = { ...res.user, loginAt: new Date().toISOString() };
        setSession(nextSession);
        try { localStorage.setItem('auth_session', JSON.stringify(nextSession)); } catch (e) {}
      } catch (e) {}
    })();
    return () => { mounted = false; };
  }, [session]);

  const mustCompleteEmail = Boolean(
    session && (
      session.needsEmail ||
      (typeof session.email === 'string' && session.email.toLowerCase().endsWith('@vk.local')) ||
      (typeof session.email === 'string' && session.email.toLowerCase() === 'vk_demo@vk.com')
    )
  );

  useEffect(() => {
    if (mustCompleteEmail && currentPage !== 'auth') {
      setCurrentPage('auth');
    }
  }, [mustCompleteEmail, currentPage]);

  const roleAccess = {
    dashboard: ['Администратор', 'Тренер', 'Клиент'],
    news: ['Администратор', 'Тренер', 'Клиент'],
    auth: ['Администратор', 'Тренер', 'Клиент'],
    notifications: ['Администратор', 'Тренер', 'Клиент'],
    client: ['Клиент'],
    members: ['Администратор', 'Тренер'],
    trainers: ['Администратор'],
    memberships: ['Администратор', 'Тренер'],
    classes: ['Администратор', 'Тренер'],
    bookings: ['Администратор', 'Тренер', 'Клиент'],
    calendar: ['Администратор', 'Тренер'],
    services: ['Администратор', 'Тренер', 'Клиент'],
    crm: ['Администратор', 'Тренер'],
    deals: ['Администратор', 'Тренер'],
    payments: ['Администратор', 'Тренер', 'Клиент'],
    analytics: ['Администратор', 'Тренер'],
    forecast: ['Администратор', 'Тренер'],
    reports: ['Администратор'],
    search: ['Администратор', 'Тренер'],
    settings: ['Администратор'],
    users: ['Администратор'],
    database: ['Администратор'],
  };

  const visibleItems = useMemo(() => {
    if (!session) {
      return MENU_ITEMS.filter((item) => item.id === 'news' || item.id === 'auth');
    }
    if (mustCompleteEmail) {
      return MENU_ITEMS.filter((item) => item.id === 'auth');
    }
    return MENU_ITEMS.filter((item) => roleAccess[item.id]?.includes(session.role));
  }, [session, mustCompleteEmail]);

  useEffect(() => {
    if (visibleItems.length === 0) return;
    const exists = visibleItems.some((item) => item.id === currentPage);
    if (!exists) {
      setCurrentPage(visibleItems[0].id);
    }
  }, [currentPage, visibleItems]);

  const isAllowed = currentPage === 'news' || (session && roleAccess[currentPage]?.includes(session.role));

  const renderPage = () => {
    if (!session && currentPage !== 'auth' && currentPage !== 'news') return <Auth session={session} setSession={setSession} />;
    if (mustCompleteEmail && currentPage !== 'auth') return <Auth session={session} setSession={setSession} />;
    if (session && currentPage !== 'news' && !isAllowed) {
      return (
        <div className="glass-card p-6">
          <h2 className="text-xl font-bold text-slate-900">Нет доступа</h2>
          <p className="text-slate-400 mt-2">У роли "{session.role}" нет прав на просмотр этого раздела.</p>
        </div>
      );
    }
    switch (currentPage) {
      case 'dashboard':
        return session?.role === 'Клиент' ? <Client /> : <Dashboard />;
      case 'news':
        return <News />;
      case 'members':
        return <Members />;
      case 'trainers':
        return <Trainers />;
      case 'memberships':
        return <Memberships />;
      case 'classes':
        return <Classes />;
      case 'bookings':
        return <Bookings />;
      case 'calendar':
        return <Calendar />;
      case 'payments':
        return <Payments />;
      case 'notifications':
        return <Notifications />;
      case 'analytics':
        return <Analytics />;
      case 'reports':
        return <Reports />;
      case 'settings':
        return <Settings />;
      case 'users':
        return <Users />;
      case 'database':
        return <DatabaseAdmin />;
      case 'auth':
        return <Auth session={session} setSession={setSession} />;
      case 'services':
        return <Services />;
      case 'crm':
        return <Crm />;
      case 'deals':
        return <Deals />;
      case 'forecast':
        return <Forecast />;
      case 'search':
        return <Search />;
      case 'client':
        return <Client />;
      default:
        return <Dashboard />;
    }
  };

  function handleLogout() {
    (async () => {
      try { await logoutUser(); } catch (e) {}
      try { localStorage.removeItem('auth_session'); } catch (e) {}
      try { localStorage.removeItem('auth_token'); } catch (e) {}
      setSession(null);
      setCurrentPage('news');
    })();
  }

  const pageMeta = PAGE_META[currentPage] || PAGE_META.dashboard;

  return (
    <div className="site-shell">
      <div className="site-glow site-glow--one" />
      <div className="site-glow site-glow--two" />
      <TopNav
        currentPage={currentPage} 
        setCurrentPage={setCurrentPage}
        menuItems={visibleItems}
        session={session}
        onLogout={handleLogout}
        theme={theme}
        onThemeToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        mustCompleteEmail={mustCompleteEmail}
      />
      <div className="site-content">
        {currentPage !== 'auth' && (
          <header className="page-intro glass-card">
            <div>
              <h1 className="page-title">{pageMeta.title}</h1>
              <p className="page-subtitle">{pageMeta.subtitle}</p>
            </div>
            <div className="page-intro-meta">
              <span className="intro-chip">
                <i className="fas fa-calendar-day" />
                {new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })}
              </span>
              {session && (
                <span className="intro-chip intro-chip--accent">
                  <i className="fas fa-user-check" />
                  {session.role}
                </span>
              )}
            </div>
          </header>
        )}
        <main className="site-main">
          <div className="page-content">
            {renderPage()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
