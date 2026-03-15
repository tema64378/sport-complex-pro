import React from 'react';

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || 'Неизвестная ошибка интерфейса.',
    };
  }

  componentDidCatch(error, info) {
    console.error('AppErrorBoundary:', error, info);
    if (typeof window !== 'undefined' && typeof window.__sportProToast === 'function') {
      window.__sportProToast('Произошла ошибка интерфейса. Страница переведена в безопасный режим.', 'error');
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-crash-screen">
          <div className="app-crash-card glass-card">
            <h1>Интерфейс временно недоступен</h1>
            <p>
              Обновите страницу. Если ошибка повторяется, откройте раздел снова или очистите локальные данные в
              параметрах.
            </p>
            <p className="app-crash-error">{this.state.errorMessage}</p>
            <div className="app-crash-actions">
              <button type="button" className="action-btn" onClick={() => window.location.reload()}>
                <i className="fas fa-rotate-right" />
                Обновить страницу
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
