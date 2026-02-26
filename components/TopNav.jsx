import React, { useEffect, useState } from 'react';

export default function TopNav({
  currentPage,
  setCurrentPage,
  menuItems,
  session,
  onLogout,
  theme,
  onThemeToggle,
  mustCompleteEmail,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [currentPage]);

  return (
    <header className="top-header">
      <div className="top-header-inner glass">
        <div className="top-brand-block">
          <button
            type="button"
            className="mobile-menu-toggle"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Открыть меню"
          >
            <i className={`fas ${mobileOpen ? 'fa-xmark' : 'fa-bars'}`} />
          </button>
          <div className="brand-mark">
            <span>SP</span>
          </div>
          <div className="brand-copy">
            <p className="brand-title">Sport Complex Pro</p>
            <p className="brand-subtitle">Единая система управления клубом</p>
          </div>
        </div>

        <div className="top-actions">
          <button
            type="button"
            className={`theme-switch ${theme === 'dark' ? 'is-dark' : ''}`}
            onClick={onThemeToggle}
            aria-label="Переключить тему"
          >
            <span className="theme-switch-track">
              <i className="fas fa-sun theme-icon theme-icon--sun" />
              <i className="fas fa-moon theme-icon theme-icon--moon" />
            </span>
            <span className="theme-switch-thumb" />
          </button>

          {session ? (
            <>
              <div className="profile-pill">
                <span className="profile-avatar">
                  {session?.name ? session.name.slice(0, 1).toUpperCase() : 'U'}
                </span>
                <div className="profile-text">
                  <span className="profile-name">{session.name}</span>
                  <span className="profile-role">{session.role}</span>
                </div>
              </div>
              <button type="button" className="action-btn danger" onClick={onLogout}>
                <i className="fas fa-right-from-bracket" />
                Выйти
              </button>
            </>
          ) : (
            <button
              type="button"
              className="action-btn"
              onClick={() => setCurrentPage('auth')}
            >
              <i className="fas fa-right-to-bracket" />
              Войти
            </button>
          )}
        </div>
      </div>

      {mustCompleteEmail && (
        <div className="attention-banner">
          <i className="fas fa-circle-exclamation" />
          Для завершения регистрации через VK укажите актуальный email.
        </div>
      )}

      <nav className={`top-nav glass ${mobileOpen ? 'is-open' : ''}`}>
        {menuItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`top-nav-item ${currentPage === item.id ? 'active' : ''}`}
            onClick={() => setCurrentPage(item.id)}
          >
            <i className={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </header>
  );
}
