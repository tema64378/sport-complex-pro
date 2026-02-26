import React, { useState, useEffect } from 'react';
import { logoutUser, fetchMe } from './api';
import Sidebar from './components/Sidebar';
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

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 1024);
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
    try { localStorage.setItem('theme', theme); } catch(e){}
  }, [theme]);

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth <= 1024;
      setIsMobile(mobile);
      if (mobile) setSidebarOpen(false);
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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

  const roleAccess = {
    dashboard: ['Администратор', 'Тренер', 'Клиент'],
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

  const isAllowed = session && roleAccess[currentPage]?.includes(session.role);

  const renderPage = () => {
    if (!session && currentPage !== 'auth') return <Auth session={session} setSession={setSession} />;
    if (session && !isAllowed) {
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
      setCurrentPage('auth');
    })();
  }

  return (
    <div className="app-shell flex min-h-screen">
      <Sidebar 
        currentPage={currentPage} 
        setCurrentPage={setCurrentPage}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        session={session}
        onLogout={handleLogout}
        isMobile={isMobile}
      />
      <div className={`app-content flex-1 transition-all duration-300 ${sidebarOpen && !isMobile ? 'ml-64' : sidebarOpen && isMobile ? 'ml-0' : 'ml-0'}`}>
        <header className="sticky top-0 z-40">
          <div className="topbar p-4 px-6 shadow-sm border-b border-transparent">
            <div className="topbar-row flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="icon-btn hover:bg-white/40 rounded-lg transition-colors"
              >
                <i className="fas fa-bars text-xl text-gray-700"></i>
              </button>
              <h1 className="topbar-title text-2xl font-bold text-gray-900">
                {isMobile ? 'СК Pro' : 'Спортивный Комплекс Pro'}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="icon-btn hover:bg-white/40 rounded-full transition-colors">
                <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'} text-lg text-gray-700`}></i>
              </button>
              <button className="icon-btn hover:bg-white/40 rounded-full transition-colors relative">
                <i className="fas fa-bell text-xl text-gray-700"></i>
                <span className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">3</span>
              </button>
              <button className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                {session?.name ? session.name.slice(0, 1).toUpperCase() : 'Г'}
              </button>
            </div>
            </div>
          </div>
        </header>
        <main className="p-6 app-main">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default App;
