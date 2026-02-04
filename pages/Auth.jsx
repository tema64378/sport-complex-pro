import React, { useEffect, useMemo, useRef, useState } from 'react';
import { isApiAvailable, registerUser, loginUser, logoutUser, completeVkOneTap } from '../api';

const DEFAULT_USERS = [
  { id: 1, name: 'Администратор', email: 'admin@sportcomplex.com', phone: '+7 (495) 123-45-67', role: 'Администратор', password: 'admin123' },
  { id: 2, name: 'Тренер Мария', email: 'coach.maria@sportcomplex.com', phone: '+7 (910) 555-22-11', role: 'Тренер', password: 'coach123' },
];

function loadUsers() {
  try {
    const raw = localStorage.getItem('auth_users');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return DEFAULT_USERS;
}

function saveUsers(users) {
  try { localStorage.setItem('auth_users', JSON.stringify(users)); } catch (e) {}
}

function loadSession() {
  try {
    const raw = localStorage.getItem('auth_session');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

function saveSession(user) {
  try { localStorage.setItem('auth_session', JSON.stringify(user)); } catch (e) {}
}

function clearSession() {
  try { localStorage.removeItem('auth_session'); } catch (e) {}
}

export default function Auth({ session, setSession }) {
  const [activeTab, setActiveTab] = useState('login');
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState('');
  const [useApi, setUseApi] = useState(false);
  const oneTapRef = useRef(null);
  const oneTapInitedRef = useRef(false);
  const [oneTapError, setOneTapError] = useState('');

  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });

  useEffect(() => {
    const stored = loadUsers();
    setUsers(stored);
    saveUsers(stored);
    setSession(loadSession());
    (async () => {
      const ok = await isApiAvailable();
      setUseApi(ok);
    })();
  }, []);

  useEffect(() => { saveUsers(users); }, [users]);

  const existingEmails = useMemo(() => new Set(users.map(u => u.email.toLowerCase())), [users]);

  async function handleLogin() {
    setMessage('');
    if (useApi) {
      try {
        const res = await loginUser({ email: loginForm.email, password: loginForm.password });
        const user = res.user;
        try { localStorage.setItem('auth_token', res.token); } catch (e) {}
        const nextSession = { ...user, loginAt: new Date().toISOString() };
        setSession(nextSession);
        saveSession(nextSession);
        setMessage(`Добро пожаловать, ${user.name}!`);
        return;
      } catch (e) {
        setMessage('Неверная почта или пароль.');
        return;
      }
    }
    const user = users.find(u => u.email.toLowerCase() === loginForm.email.toLowerCase() && u.password === loginForm.password);
    if (!user) return setMessage('Неверная почта или пароль.');
    const nextSession = { id: user.id, name: user.name, role: user.role, email: user.email, loginAt: new Date().toISOString() };
    setSession(nextSession);
    saveSession(nextSession);
    setMessage(`Добро пожаловать, ${user.name}!`);
  }

  async function handleRegister() {
    setMessage('');
    if (!registerForm.name.trim() || !registerForm.email.trim() || !registerForm.password.trim()) {
      setMessage('Заполните имя, email и пароль.');
      return;
    }
    if (registerForm.password !== registerForm.confirm) {
      setMessage('Пароли не совпадают.');
      return;
    }
    if (useApi) {
      try {
        const res = await registerUser({
          name: registerForm.name,
          email: registerForm.email,
          phone: registerForm.phone,
          password: registerForm.password,
        });
        try { localStorage.setItem('auth_token', res.token); } catch (e) {}
        const nextSession = { ...res.user, loginAt: new Date().toISOString() };
        setSession(nextSession);
        saveSession(nextSession);
        setActiveTab('login');
        setRegisterForm({ name: '', email: '', phone: '', password: '', confirm: '' });
        setMessage('Регистрация успешна. Вы вошли в систему.');
        return;
      } catch (e) {
        setMessage('Пользователь с таким email уже существует.');
        return;
      }
    }
    if (existingEmails.has(registerForm.email.toLowerCase())) return setMessage('Пользователь с таким email уже существует.');
    const newUser = { id: Date.now(), name: registerForm.name, email: registerForm.email, phone: registerForm.phone, role: 'Клиент', password: registerForm.password };
    const nextUsers = [newUser, ...users];
    setUsers(nextUsers);
    setActiveTab('login');
    setRegisterForm({ name: '', email: '', phone: '', password: '', confirm: '' });
    setMessage('Регистрация успешна. Войдите в систему.');
  }

  function handleLogout() {
    (async () => {
      try { if (useApi) await logoutUser(); } catch (e) {}
      try { localStorage.removeItem('auth_token'); } catch (e) {}
      clearSession();
      setSession(null);
      setMessage('Сессия завершена.');
    })();
  }

  async function handleVkOAuth() {
    const base = import.meta.env.VITE_API_BASE || '/api';
    window.location.href = `${base}/auth/vk/login`;
  }

  useEffect(() => {
    if (!oneTapRef.current || oneTapInitedRef.current) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      const VKGlobal = window.VKIDSDK || window.VKID;
      if (!VKGlobal) {
        if (attempts >= 20) {
          clearInterval(timer);
          setOneTapError('VK One Tap не загрузился. Проверьте блокировщик рекламы или сеть.');
        }
        return;
      }
      clearInterval(timer);
      const VKID = VKGlobal;
      const appId = Number(import.meta.env.VITE_VK_APP_ID || 54440927);
      VKID.Config.init({
        app: appId,
        redirectUrl: 'https://sportcomplecspro.ru/api/auth/vk/callback',
        responseMode: VKID.ConfigResponseMode.Callback,
        source: VKID.ConfigSource.LOWCODE,
        scope: '',
      });
      const oneTap = new VKID.OneTap();
      oneTap.render({
        container: oneTapRef.current,
        showAlternativeLogin: true,
        oauthList: ['ok_ru', 'mail_ru'],
      })
      .on(VKID.WidgetEvents.ERROR, (error) => {
        console.error('VK One Tap error', error);
        setOneTapError('VK One Tap ошибка. Попробуйте позже.');
      })
      .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, async (payload) => {
        try {
          const code = payload.code;
          const deviceId = payload.device_id;
          const data = await VKID.Auth.exchangeCode(code, deviceId);
          const res = await completeVkOneTap({ ...data, code, device_id: deviceId, user: payload.user || null });
          try { localStorage.setItem('auth_token', res.token); } catch (e) {}
          const nextSession = { ...res.user, loginAt: new Date().toISOString() };
          setSession(nextSession);
          saveSession(nextSession);
          setMessage('Вход через VK выполнен.');
        } catch (e) {
          setMessage('Не удалось выполнить вход через VK.');
        }
      });
      oneTapInitedRef.current = true;
    }, 200);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-primary)' }}>
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-full max-w-5xl">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>SportComplex Pro</h1>
            <p style={{ color: 'var(--text-secondary)' }} className="text-lg">Ваш персональный спортивный клуб</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Форма входа/регистрации */}
            <div className="glass-card p-8">
              <div className="flex gap-4 mb-8">
                {['login', 'register'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all duration-300 ${
                      activeTab === tab
                        ? 'text-white'
                        : 'text-[var(--text-secondary)]'
                    }`}
                    style={{
                      backgroundColor: activeTab === tab ? 'var(--accent)' : 'transparent',
                      borderBottom: activeTab !== tab ? '2px solid var(--card-border)' : 'none'
                    }}
                  >
                    {tab === 'login' ? '🔐 Вход' : '✨ Регистрация'}
                  </button>
                ))}
              </div>

              {activeTab === 'login' && (
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Email</label>
                    <input
                      type="email"
                      value={loginForm.email}
                      onChange={e => setLoginForm({ ...loginForm, email: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 transition"
                      style={{
                        backgroundColor: 'var(--card-bg)',
                        color: 'var(--text-primary)',
                        borderColor: 'var(--card-border)',
                        '--tw-ring-color': 'var(--accent)'
                      }}
                      placeholder="admin@sportcomplex.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Пароль</label>
                    <input
                      type="password"
                      value={loginForm.password}
                      onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 transition"
                      style={{
                        backgroundColor: 'var(--card-bg)',
                        color: 'var(--text-primary)',
                        borderColor: 'var(--card-border)',
                        '--tw-ring-color': 'var(--accent)'
                      }}
                      placeholder="••••••••"
                    />
                  </div>
                  
                  <button 
                    onClick={handleLogin}
                    className="w-full py-3 px-4 rounded-xl text-white font-semibold transition-all duration-300 transform hover:scale-105"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    Войти в систему
                  </button>

                  <div className="relative py-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full" style={{ borderTop: '1px solid var(--card-border)' }}></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-secondary)' }}>или</span>
                    </div>
                  </div>

                  <button 
                    onClick={handleVkOAuth}
                    className="w-full py-3 px-4 rounded-xl text-white font-semibold transition-all duration-300"
                    style={{ 
                      backgroundColor: 'var(--accent)',
                      opacity: 0.8
                    }}
                    onMouseEnter={e => e.target.style.opacity = '1'}
                    onMouseLeave={e => e.target.style.opacity = '0.8'}
                  >
                    ВКонтакте (OAuth)
                  </button>

                  <div className="pt-2">
                    <div ref={oneTapRef} style={{ minHeight: 52 }} />
                    {oneTapError && <div className="text-xs mt-2 text-center" style={{ color: '#ef4444' }}>{oneTapError}</div>}
                  </div>
                </div>
              )}

              {activeTab === 'register' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Имя</label>
                      <input
                        value={registerForm.name}
                        onChange={e => setRegisterForm({ ...registerForm, name: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 transition"
                        style={{
                          backgroundColor: 'var(--card-bg)',
                          color: 'var(--text-primary)',
                          borderColor: 'var(--card-border)',
                          '--tw-ring-color': 'var(--accent)'
                        }}
                        placeholder="Иван Петров"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Телефон</label>
                      <input
                        value={registerForm.phone}
                        onChange={e => setRegisterForm({ ...registerForm, phone: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 transition"
                        style={{
                          backgroundColor: 'var(--card-bg)',
                          color: 'var(--text-primary)',
                          borderColor: 'var(--card-border)',
                          '--tw-ring-color': 'var(--accent)'
                        }}
                        placeholder="+7 (900) 000-00-00"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Email</label>
                    <input
                      type="email"
                      value={registerForm.email}
                      onChange={e => setRegisterForm({ ...registerForm, email: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 transition"
                      style={{
                        backgroundColor: 'var(--card-bg)',
                        color: 'var(--text-primary)',
                        borderColor: 'var(--card-border)',
                        '--tw-ring-color': 'var(--accent)'
                      }}
                      placeholder="ваша@почта.com"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Пароль</label>
                      <input
                        type="password"
                        value={registerForm.password}
                        onChange={e => setRegisterForm({ ...registerForm, password: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 transition"
                        style={{
                          backgroundColor: 'var(--card-bg)',
                          color: 'var(--text-primary)',
                          borderColor: 'var(--card-border)',
                          '--tw-ring-color': 'var(--accent)'
                        }}
                        placeholder="Пароль"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Подтверждение</label>
                      <input
                        type="password"
                        value={registerForm.confirm}
                        onChange={e => setRegisterForm({ ...registerForm, confirm: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 transition"
                        style={{
                          backgroundColor: 'var(--card-bg)',
                          color: 'var(--text-primary)',
                          borderColor: 'var(--card-border)',
                          '--tw-ring-color': 'var(--accent)'
                        }}
                        placeholder="Повтор"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      ✓ <span style={{ color: 'var(--accent)' }}><strong>Роль при регистрации:</strong></span><br/>
                      <span style={{ fontWeight: 'semibold', color: 'var(--text-primary)' }}>Клиент</span>
                    </p>
                  </div>

                  <button 
                    onClick={handleRegister}
                    className="w-full py-3 px-4 rounded-xl text-white font-semibold transition-all duration-300 transform hover:scale-105"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    Создать аккаунт
                  </button>
                </div>
              )}

              {message && (
                <div className={`mt-6 p-4 rounded-xl text-center font-semibold`}
                  style={{
                    backgroundColor: message.includes('успешно') || message.includes('Добро') ? 'rgba(22,163,74,0.1)' : 'rgba(239,68,68,0.1)',
                    color: message.includes('успешно') || message.includes('Добро') ? 'var(--accent)' : '#ef4444',
                    border: message.includes('успешно') || message.includes('Добро') ? '1px solid rgba(22,163,74,0.3)' : '1px solid rgba(239,68,68,0.3)'
                  }}
                >
                  {message}
                </div>
              )}
            </div>

            {/* Текущая сессия */}
            <div className="glass-card p-8 flex flex-col justify-between">
              <div>
                <h3 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>Текущая сессия</h3>
                
                {session ? (
                  <div className="space-y-6">
                    <div className="rounded-xl p-6" style={{ backgroundColor: 'var(--card-bg)', border: '2px solid var(--accent)', opacity: 0.95 }}>
                      <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>Вы вошли как</p>
                      <p className="text-3xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>{session.name}</p>
                      
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">👤</span>
                          <div>
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Роль</p>
                            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{session.role}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className="text-lg">📧</span>
                          <div>
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Email</p>
                            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{session.email}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🕐</span>
                          <div>
                            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Вход</p>
                            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{new Date(session.loginAt).toLocaleString('ru-RU')}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={handleLogout}
                      className="w-full py-3 px-4 rounded-xl text-white font-semibold transition-all duration-300 transform hover:scale-105"
                      style={{ backgroundColor: '#ef4444' }}
                    >
                      Выйти из системы
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-6xl mb-4">🔓</p>
                    <p style={{ color: 'var(--text-secondary)' }} className="text-lg">Нет активной сессии</p>
                    <p style={{ color: 'var(--text-secondary)', opacity: 0.7 }} className="mt-2">Войдите или создайте новый аккаунт</p>
                  </div>
                )}
              </div>

              {!useApi && session && (
                <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--card-border)' }}>
                  <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>💾 Локальное хранилище</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)', opacity: 0.75 }}>Используется локальное хранилище браузера. Данные синхронизируются с сервером при подключении.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
