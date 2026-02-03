import React, { useEffect, useMemo, useRef, useState } from 'react';
import { isApiAvailable, registerUser, loginUser, logoutUser, loginVkDemo, completeVkOneTap } from '../api';

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

  async function handleVkDemo() {
    setMessage('');
    try {
      const res = await loginVkDemo();
      try { localStorage.setItem('auth_token', res.token); } catch (e) {}
      const nextSession = { ...res.user, loginAt: new Date().toISOString() };
      setSession(nextSession);
      saveSession(nextSession);
      setMessage('Вход через VK (демо) выполнен.');
    } catch (e) {
      setMessage('VK-демо вход недоступен.');
    }
  }

  function handleVkOAuth() {
    const base = import.meta.env.VITE_API_BASE || '/api';
    window.location.href = `${base}/auth/vk/login`;
  }

  useEffect(() => {
    if (!oneTapRef.current || oneTapInitedRef.current) return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (!('VKIDSDK' in window)) {
        if (attempts >= 20) {
          clearInterval(timer);
          setOneTapError('VK One Tap не загрузился. Проверьте блокировщик рекламы или сеть.');
        }
        return;
      }
      clearInterval(timer);
      const VKID = window.VKIDSDK;
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
          const res = await completeVkOneTap(data);
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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Авторизация и регистрация</h1>
        <p className="text-slate-400 text-sm mt-2">Клиенты и сотрудники могут входить в систему и создавать аккаунты</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex gap-2 border-b border-white/10 mb-6">
            {['login', 'register'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 font-medium border-b-2 transition ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
              >
                {tab === 'login' ? 'Вход' : 'Регистрация'}
              </button>
            ))}
          </div>

          {activeTab === 'login' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Email</label>
                <input
                  type="email"
                  value={loginForm.email}
                  onChange={e => setLoginForm({ ...loginForm, email: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border bg-white/5 text-slate-200"
                  placeholder="name@example.com"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Пароль</label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border bg-white/5 text-slate-200"
                  placeholder="••••••••"
                />
              </div>
              <button onClick={handleLogin} className="bg-blue-600 text-white px-6 py-2 rounded-lg">Войти</button>
              <button onClick={handleVkDemo} className="border border-blue-400 text-blue-400 px-6 py-2 rounded-lg">Войти через VK (демо)</button>
              <button onClick={handleVkOAuth} className="border border-sky-500 text-sky-500 px-6 py-2 rounded-lg">Войти через VK (OAuth)</button>
              <div className="pt-4">
                <div className="text-xs text-slate-400 mb-2">VK One Tap</div>
                <div ref={oneTapRef} style={{ minHeight: 52 }} />
                {oneTapError && <div className="text-xs text-red-400 mt-2">{oneTapError}</div>}
              </div>
            </div>
          )}

          {activeTab === 'register' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Имя</label>
                  <input
                    value={registerForm.name}
                    onChange={e => setRegisterForm({ ...registerForm, name: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border bg-white/5 text-slate-200"
                    placeholder="Иван Петров"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Телефон</label>
                  <input
                    value={registerForm.phone}
                    onChange={e => setRegisterForm({ ...registerForm, phone: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border bg-white/5 text-slate-200"
                    placeholder="+7 (900) 000-00-00"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Email</label>
                  <input
                    type="email"
                    value={registerForm.email}
                    onChange={e => setRegisterForm({ ...registerForm, email: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border bg-white/5 text-slate-200"
                    placeholder="client@example.com"
                  />
                </div>
                <div className="flex items-end">
                  <div className="text-sm text-slate-400">Роль при регистрации: Клиент</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Пароль</label>
                  <input
                    type="password"
                    value={registerForm.password}
                    onChange={e => setRegisterForm({ ...registerForm, password: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border bg-white/5 text-slate-200"
                    placeholder="Придумайте пароль"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Подтверждение</label>
                  <input
                    type="password"
                    value={registerForm.confirm}
                    onChange={e => setRegisterForm({ ...registerForm, confirm: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border bg-white/5 text-slate-200"
                    placeholder="Повторите пароль"
                  />
                </div>
              </div>
              <button onClick={handleRegister} className="bg-blue-600 text-white px-6 py-2 rounded-lg">Создать аккаунт</button>
            </div>
          )}

          {message && <div className="mt-4 text-sm text-slate-600">{message}</div>}
        </div>

        <div className="glass-card p-6 space-y-4">
          <h3 className="text-lg font-bold text-slate-900">Текущая сессия</h3>
          {session ? (
            <div className="space-y-2">
              <p className="text-sm text-slate-500">Пользователь</p>
              <p className="text-lg font-semibold text-slate-900">{session.name}</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">{session.role}</span>
                <span className="px-3 py-1 rounded-full text-sm bg-slate-100 text-slate-700">{session.email}</span>
              </div>
              <p className="text-xs text-slate-400">Вход: {new Date(session.loginAt).toLocaleString('ru-RU')}</p>
              <button onClick={handleLogout} className="mt-2 w-full bg-slate-900 text-white py-2 rounded-lg">Выйти</button>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Нет активной сессии. Войдите или зарегистрируйтесь.</p>
          )}

          {!useApi && (
            <div className="pt-4 border-t border-white/10">
              <p className="text-sm text-slate-400">Тестовые учетные записи</p>
              <div className="mt-2 space-y-2">
                {users.slice(0, 2).map(user => (
                  <div key={user.id} className="text-sm text-slate-700">
                    {user.email} / {user.password}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
