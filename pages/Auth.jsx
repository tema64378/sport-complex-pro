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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-2">SportComplex Pro</h1>
          <p className="text-blue-200 text-lg">Ваш персональный спортивный клуб</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Форма входа/регистрации */}
          <div className="backdrop-blur-md bg-white/10 rounded-2xl border border-white/20 shadow-2xl p-8">
            <div className="flex gap-4 mb-8">
              {['login', 'register'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all duration-300 ${
                    activeTab === tab
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg'
                      : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
                >
                  {tab === 'login' ? '🔐 Вход' : '✨ Регистрация'}
                </button>
              ))}
            </div>

            {activeTab === 'login' && (
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-blue-200 mb-2">Email</label>
                  <input
                    type="email"
                    value={loginForm.email}
                    onChange={e => setLoginForm({ ...loginForm, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-blue-400 focus:bg-white/15 transition"
                    placeholder="admin@sportcomplex.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-blue-200 mb-2">Пароль</label>
                  <input
                    type="password"
                    value={loginForm.password}
                    onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-blue-400 focus:bg-white/15 transition"
                    placeholder="••••••••"
                  />
                </div>
                
                <button 
                  onClick={handleLogin}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold hover:shadow-lg hover:shadow-blue-500/50 transition-all duration-300 transform hover:scale-105"
                >
                  Войти в систему
                </button>

                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white/60">или</span>
                  </div>
                </div>

                <button 
                  onClick={handleVkOAuth}
                  className="w-full py-3 px-4 rounded-xl border-2 border-cyan-400 text-cyan-300 font-semibold hover:bg-cyan-400/10 transition-all duration-300"
                >
                  ВКонтакте (OAuth)
                </button>

                <div className="pt-2">
                  <div ref={oneTapRef} style={{ minHeight: 52 }} />
                  {oneTapError && <div className="text-xs text-red-400 mt-2 text-center">{oneTapError}</div>}
                </div>
              </div>
            )}

            {activeTab === 'register' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-blue-200 mb-2">Имя</label>
                    <input
                      value={registerForm.name}
                      onChange={e => setRegisterForm({ ...registerForm, name: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-blue-400 focus:bg-white/15 transition"
                      placeholder="Иван Петров"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-blue-200 mb-2">Телефон</label>
                    <input
                      value={registerForm.phone}
                      onChange={e => setRegisterForm({ ...registerForm, phone: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-blue-400 focus:bg-white/15 transition"
                      placeholder="+7 (900) 000-00-00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-blue-200 mb-2">Email</label>
                  <input
                    type="email"
                    value={registerForm.email}
                    onChange={e => setRegisterForm({ ...registerForm, email: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-blue-400 focus:bg-white/15 transition"
                    placeholder="ваша@почта.com"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-blue-200 mb-2">Пароль</label>
                    <input
                      type="password"
                      value={registerForm.password}
                      onChange={e => setRegisterForm({ ...registerForm, password: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-blue-400 focus:bg-white/15 transition"
                      placeholder="Пароль"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-blue-200 mb-2">Подтверждение</label>
                    <input
                      type="password"
                      value={registerForm.confirm}
                      onChange={e => setRegisterForm({ ...registerForm, confirm: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:border-blue-400 focus:bg-white/15 transition"
                      placeholder="Повтор"
                    />
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <p className="text-sm text-white/70">
                    ✓ <span className="text-blue-300">Роль при регистрации:</span><br/>
                    <span className="font-semibold text-white">Клиент</span>
                  </p>
                </div>

                <button 
                  onClick={handleRegister}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold hover:shadow-lg hover:shadow-green-500/50 transition-all duration-300 transform hover:scale-105"
                >
                  Создать аккаунт
                </button>
              </div>
            )}

            {message && (
              <div className={`mt-6 p-4 rounded-xl text-center font-semibold ${
                message.includes('успешно') || message.includes('Добро')
                  ? 'bg-green-500/20 border border-green-400/50 text-green-300'
                  : 'bg-red-500/20 border border-red-400/50 text-red-300'
              }`}>
                {message}
              </div>
            )}
          </div>

          {/* Текущая сессия */}
          <div className="backdrop-blur-md bg-white/10 rounded-2xl border border-white/20 shadow-2xl p-8 flex flex-col justify-between">
            <div>
              <h3 className="text-2xl font-bold text-white mb-6">Текущая сессия</h3>
              
              {session ? (
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-400/30 rounded-xl p-6">
                    <p className="text-sm text-blue-300 font-semibold mb-2">Вы вошли как</p>
                    <p className="text-3xl font-bold text-white mb-4">{session.name}</p>
                    
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">👤</span>
                        <div>
                          <p className="text-xs text-white/60">Роль</p>
                          <p className="text-white font-semibold">{session.role}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-lg">📧</span>
                        <div>
                          <p className="text-xs text-white/60">Email</p>
                          <p className="text-white font-semibold text-sm">{session.email}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🕐</span>
                        <div>
                          <p className="text-xs text-white/60">Вход</p>
                          <p className="text-white font-semibold text-sm">{new Date(session.loginAt).toLocaleString('ru-RU')}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={handleLogout}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-500 to-pink-500 text-white font-semibold hover:shadow-lg hover:shadow-red-500/50 transition-all duration-300 transform hover:scale-105"
                  >
                    Выйти из системы
                  </button>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-6xl mb-4">🔓</p>
                  <p className="text-white/70 text-lg">Нет активной сессии</p>
                  <p className="text-white/50 mt-2">Войдите или создайте новый аккаунт</p>
                </div>
              )}
            </div>

            {!useApi && session && (
              <div className="mt-6 pt-6 border-t border-white/10">
                <p className="text-xs text-white/60 font-semibold mb-3">💾 Локальное хранилище</p>
                <p className="text-xs text-white/50">Используется локальное хранилище браузера. Данные синхронизируются с сервером при подключении.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
