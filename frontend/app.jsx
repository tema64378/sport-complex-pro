import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { logoutUser, fetchMe } from './apiClient';
import TopNav from './components/TopNav';
import ToastViewport from './components/ToastViewport';

const PAGE_LOADERS = {
  dashboard: () => import('./pages/Dashboard'),
  news: () => import('./pages/News'),
  notifications: () => import('./pages/Notifications'),
  members: () => import('./pages/Members'),
  crm: () => import('./pages/Crm'),
  trainers: () => import('./pages/Trainers'),
  memberships: () => import('./pages/Memberships'),
  classes: () => import('./pages/Classes'),
  bookings: () => import('./pages/Bookings'),
  calendar: () => import('./pages/Calendar'),
  services: () => import('./pages/Services'),
  deals: () => import('./pages/Deals'),
  payments: () => import('./pages/Payments'),
  analytics: () => import('./pages/Analytics'),
  forecast: () => import('./pages/Forecast'),
  reports: () => import('./pages/Reports'),
  search: () => import('./pages/Search'),
  users: () => import('./pages/Users'),
  database: () => import('./pages/DatabaseAdmin'),
  settings: () => import('./pages/Settings'),
  client: () => import('./pages/Client'),
  auth: () => import('./pages/Auth'),
};

const PAGE_COMPONENTS = Object.fromEntries(
  Object.entries(PAGE_LOADERS).map(([key, loader]) => [key, lazy(loader)]),
);

const THEME_OPTIONS = [
  { id: 'light', label: 'Светлая' },
  { id: 'dark', label: 'Темная' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'sunset', label: 'Sunset' },
];

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

const ROLE_ACCESS = {
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

function pageLoader(pageId, props = {}) {
  const PageComponent = PAGE_COMPONENTS[pageId] || PAGE_COMPONENTS.dashboard;
  return <PageComponent {...props} />;
}

function PageFallback() {
  return (
    <div className="page-loading glass-card">
      <div className="skeleton-card page-loading-line page-loading-line--title" />
      <div className="skeleton-card page-loading-line" />
      <div className="skeleton-card page-loading-line page-loading-line--short" />
      <div className="skeleton-card page-loading-grid">
        <div className="skeleton-card page-loading-tile" />
        <div className="skeleton-card page-loading-tile" />
        <div className="skeleton-card page-loading-tile" />
      </div>
    </div>
  );
}

function AccessDenied({ role }) {
  return (
    <div className="glass-card p-6">
      <h2 className="text-xl font-bold text-slate-900">Нет доступа</h2>
      <p className="text-slate-400 mt-2">У роли "{role}" нет прав на просмотр этого раздела.</p>
    </div>
  );
}

const TOAST_COLORS = {
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error',
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
    } catch (e) {
      return 'light';
    }
  });
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  });
  const [toasts, setToasts] = useState([]);
  const toastTimersRef = useRef(new Map());

  const pushToast = useCallback((message, type = 'info') => {
    if (!message) return;
    const safeType = TOAST_COLORS[type] ? type : 'info';
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setToasts((prev) => {
      const next = [...prev, { id, message: String(message), type: safeType }];
      return next.slice(-4);
    });

    const timeoutId = window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
      toastTimersRef.current.delete(id);
    }, 3600);

    toastTimersRef.current.set(id, timeoutId);
  }, []);

  const dismissToast = useCallback((id) => {
    const timeoutId = toastTimersRef.current.get(id);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      toastTimersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    return () => {
      for (const timeoutId of toastTimersRef.current.values()) {
        window.clearTimeout(timeoutId);
      }
      toastTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const nativeAlert = window.alert.bind(window);
    window.__sportProToast = (message, type = 'info') => {
      pushToast(message, type);
    };

    window.alert = (message) => {
      pushToast(message, 'info');
    };

    return () => {
      window.alert = nativeAlert;
      delete window.__sportProToast;
    };
  }, [pushToast]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    function handleOnline() {
      setIsOnline(true);
      pushToast('Подключение восстановлено.', 'success');
    }

    function handleOffline() {
      setIsOnline(false);
      pushToast('Нет подключения к интернету. Работаем в локальном режиме.', 'warning');
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pushToast]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('theme', theme);
    } catch (e) {}
  }, [theme]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const vkToken = url.searchParams.get('vk_token');
    if (vkToken) {
      try {
        localStorage.setItem('auth_token', vkToken);
      } catch (e) {}
      url.searchParams.delete('vk_token');
      window.history.replaceState({}, '', url.toString());
    }
    if (session) return;
    let hasToken = false;
    try {
      hasToken = Boolean(localStorage.getItem('auth_token'));
    } catch (e) {}
    if (!hasToken) return;
    let mounted = true;
    (async () => {
      try {
        const res = await fetchMe();
        if (!mounted) return;
        const nextSession = { ...res.user, loginAt: new Date().toISOString() };
        setSession(nextSession);
        try {
          localStorage.setItem('auth_session', JSON.stringify(nextSession));
        } catch (e) {}
      } catch (e) {}
    })();
    return () => {
      mounted = false;
    };
  }, [session]);

  const mustCompleteEmail = Boolean(
    session
      && (session.needsEmail
      || (typeof session.email === 'string' && session.email.toLowerCase().endsWith('@vk.local'))
      || (typeof session.email === 'string' && session.email.toLowerCase() === 'vk_demo@vk.com')),
  );

  useEffect(() => {
    if (mustCompleteEmail && currentPage !== 'auth') {
      setCurrentPage('auth');
    }
  }, [mustCompleteEmail, currentPage]);

  const visibleItems = useMemo(() => {
    if (!session) {
      return MENU_ITEMS.filter((item) => item.id === 'news' || item.id === 'auth');
    }
    if (mustCompleteEmail) {
      return MENU_ITEMS.filter((item) => item.id === 'auth');
    }
    return MENU_ITEMS.filter((item) => ROLE_ACCESS[item.id]?.includes(session.role));
  }, [session, mustCompleteEmail]);

  useEffect(() => {
    if (visibleItems.length === 0) return;
    const exists = visibleItems.some((item) => item.id === currentPage);
    if (!exists) {
      setCurrentPage(visibleItems[0].id);
    }
  }, [currentPage, visibleItems]);

  const prefetchPage = useCallback((pageId) => {
    const loader = PAGE_LOADERS[pageId];
    if (loader) {
      void loader();
    }
  }, []);

  useEffect(() => {
    ['news', 'auth', 'dashboard'].forEach(prefetchPage);
  }, [prefetchPage]);

  useEffect(() => {
    if (!session) return;
    if (session.role === 'Клиент') {
      ['client', 'bookings', 'payments', 'news'].forEach(prefetchPage);
      return;
    }
    ['members', 'bookings', 'payments', 'analytics'].forEach(prefetchPage);
  }, [session, prefetchPage]);

  const isAllowed = currentPage === 'news' || (session && ROLE_ACCESS[currentPage]?.includes(session.role));

  const renderPage = () => {
    if (!session && currentPage !== 'auth' && currentPage !== 'news') {
      return pageLoader('auth', { session, setSession });
    }

    if (mustCompleteEmail && currentPage !== 'auth') {
      return pageLoader('auth', { session, setSession });
    }

    if (session && currentPage !== 'news' && !isAllowed) {
      return <AccessDenied role={session.role} />;
    }

    switch (currentPage) {
      case 'dashboard':
        return session?.role === 'Клиент'
          ? pageLoader('client', { onNavigate: setCurrentPage })
          : pageLoader('dashboard', { onNavigate: setCurrentPage });
      case 'auth':
        return pageLoader('auth', { session, setSession });
      case 'client':
        return pageLoader('client', { onNavigate: setCurrentPage });
      default:
        return pageLoader(currentPage);
    }
  };

  function handleLogout() {
    (async () => {
      try {
        await logoutUser();
      } catch (e) {}
      try {
        localStorage.removeItem('auth_session');
      } catch (e) {}
      try {
        localStorage.removeItem('auth_token');
      } catch (e) {}
      setSession(null);
      setCurrentPage('news');
      pushToast('Сессия завершена.', 'info');
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
        themeOptions={THEME_OPTIONS}
        onThemeChange={setTheme}
        mustCompleteEmail={mustCompleteEmail}
        onMenuPrefetch={prefetchPage}
      />
      <div className="site-content">
        {currentPage !== 'auth' && (
          <header className="page-intro glass-card reveal-up">
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

        {!isOnline && (
          <div className="network-banner">
            <i className="fas fa-wifi" />
            Соединение потеряно. Некоторые функции API временно недоступны.
          </div>
        )}

        <main className="site-main">
          <div key={currentPage} className="page-content page-fade">
            <Suspense fallback={<PageFallback />}>
              {renderPage()}
            </Suspense>
          </div>
        </main>
      </div>

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default App;
