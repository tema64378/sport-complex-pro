import React from 'react';

export default function Sidebar({ currentPage, setCurrentPage, sidebarOpen, setSidebarOpen, session, onLogout, isMobile }) {
  const menuItems = [
    { id: 'dashboard', label: 'Главная', icon: 'fas fa-chart-line' },
    { id: 'auth', label: 'Вход/Регистрация', icon: 'fas fa-user-circle' },
    { id: 'notifications', label: 'Уведомления', icon: 'fas fa-bell' },
    { id: 'client', label: 'Мой кабинет', icon: 'fas fa-id-badge' },
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
    { id: 'settings', label: 'Параметры', icon: 'fas fa-cog' },
  ];

  const roleAccess = {
    dashboard: ['Администратор', 'Тренер', 'Клиент'],
    auth: ['Администратор', 'Тренер', 'Клиент'],
    notifications: ['Администратор', 'Тренер', 'Клиент'],
    client: ['Клиент'],
    members: ['Администратор', 'Тренер'],
    crm: ['Администратор', 'Тренер'],
    trainers: ['Администратор'],
    memberships: ['Администратор', 'Тренер'],
    classes: ['Администратор', 'Тренер'],
    bookings: ['Администратор', 'Тренер', 'Клиент'],
    calendar: ['Администратор', 'Тренер'],
    services: ['Администратор', 'Тренер', 'Клиент'],
    deals: ['Администратор', 'Тренер'],
    payments: ['Администратор', 'Тренер', 'Клиент'],
    analytics: ['Администратор', 'Тренер'],
    forecast: ['Администратор', 'Тренер'],
    reports: ['Администратор'],
    search: ['Администратор', 'Тренер'],
    users: ['Администратор'],
    settings: ['Администратор'],
  };

  const visibleItems = menuItems.filter(item => {
    if (!session) return item.id === 'auth';
    return roleAccess[item.id]?.includes(session.role);
  });

  return (
    <>
      {isMobile && sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className={`sidebar fixed left-0 top-0 h-screen transition-all duration-300 z-50 ${sidebarOpen ? 'w-64' : 'w-20'} ${isMobile ? (sidebarOpen ? 'translate-x-0' : '-translate-x-full') : ''} glass-nav text-slate-900 flex flex-col`}> 
      <div className="p-6 border-b border-transparent">
        <div className="flex items-center justify-between">
          {sidebarOpen && <h2 className="text-xl font-bold text-slate-900 tracking-wide">Спортивный Комплекс Pro</h2>}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-slate-100/40 rounded-lg transition-colors"
          >
            <i className={`fas fa-chevron-${sidebarOpen ? 'left' : 'right'}`}></i>
          </button>
        </div>
      </div>

      <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
        {visibleItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setCurrentPage(item.id);
              if (isMobile) setSidebarOpen(false);
            }}
            className={`nav-item w-full flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 ${
              currentPage === item.id
                ? 'active bg-white/5 border-r-4 border-blue-500'
                : 'hover:bg-white/5'
            }`}
          >
            <i className={`${item.icon} text-lg w-6`}></i>
            {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
          </button>
        ))}
      </nav>

      <div className={`px-4 pb-6 mt-auto ${!sidebarOpen && 'flex justify-center'}`}>
        {session ? (
          <button onClick={onLogout} className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-white/5 transition-colors ${!sidebarOpen && 'w-auto'}`}>
            <i className="fas fa-sign-out-alt"></i>
            {sidebarOpen && <span className="text-sm">Выход</span>}
          </button>
        ) : (
          <button onClick={() => setCurrentPage('auth')} className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-white/5 transition-colors ${!sidebarOpen && 'w-auto'}`}>
            <i className="fas fa-sign-in-alt"></i>
            {sidebarOpen && <span className="text-sm">Войти</span>}
          </button>
        )}
      </div>
      </div>
    </>
  );
}
