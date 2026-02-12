import React, { useEffect, useMemo, useState } from 'react';
import { fetchUsers, createUser, updateUser } from '../api';

const ROLE_OPTIONS = [
  { value: 'Администратор', label: '👑 Администратор', color: '#ef4444' },
  { value: 'Тренер', label: '💪 Тренер', color: '#f97316' },
  { value: 'Клиент', label: '👤 Клиент', color: '#16a34a' }
];

const PERMISSIONS = [
  { id: 'dashboard', label: 'Главная' },
  { id: 'members', label: 'Клиенты' },
  { id: 'trainers', label: 'Тренеры' },
  { id: 'memberships', label: 'Абонементы' },
  { id: 'classes', label: 'Тренировки' },
  { id: 'bookings', label: 'Бронирования' },
  { id: 'calendar', label: 'Календарь' },
  { id: 'payments', label: 'Платежи' },
  { id: 'services', label: 'Услуги и чек' },
  { id: 'analytics', label: 'Аналитика' },
  { id: 'reports', label: 'Отчеты' },
  { id: 'notifications', label: 'Уведомления' },
  { id: 'crm', label: 'CRM' },
];

function loadRolePerms() {
  try {
    const raw = localStorage.getItem('role_permissions');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {
    Администратор: PERMISSIONS.reduce((acc, p) => ({ ...acc, [p.id]: true }), {}),
    Тренер: {
      dashboard: true,
      members: true,
      trainers: false,
      memberships: true,
      classes: true,
      bookings: true,
      calendar: true,
      payments: true,
      services: true,
      analytics: true,
      reports: false,
      notifications: true,
      crm: true,
    },
    Клиент: {
      dashboard: true,
      members: false,
      trainers: false,
      memberships: false,
      classes: false,
      bookings: true,
      calendar: false,
      payments: true,
      services: true,
      analytics: false,
      reports: false,
      notifications: true,
      crm: false,
    },
  };
}

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'Клиент', password: '' });
  const [edits, setEdits] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [rolePerms, setRolePerms] = useState(loadRolePerms());

  const emailSet = useMemo(() => new Set(users.map(u => u.email)), [users]);
  
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           u.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = filterRole === 'all' || u.role === filterRole;
      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, filterRole]);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    try { localStorage.setItem('role_permissions', JSON.stringify(rolePerms)); } catch (e) {}
  }, [rolePerms]);

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (e) {
      setMessage('Не удалось загрузить пользователей.');
      setMessageType('error');
    }
    setLoading(false);
  }

  async function handleCreate() {
    setMessage('');
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setMessage('Имя, email и пароль обязательны.');
      setMessageType('error');
      return;
    }
    if (emailSet.has(form.email.trim())) {
      setMessage('Пользователь с таким email уже существует.');
      setMessageType('error');
      return;
    }
    try {
      const created = await createUser(form);
      setUsers([created, ...users]);
      setForm({ name: '', email: '', phone: '', role: 'Клиент', password: '' });
      setMessage('✓ Пользователь успешно создан!');
      setMessageType('success');
    } catch (e) {
      setMessage('Ошибка создания пользователя.');
      setMessageType('error');
    }
  }

  async function handleSave(userId) {
    const next = edits[userId];
    if (!next) return;
    setMessage('');
    try {
      const updated = await updateUser(userId, next);
      setUsers(users.map(u => (u.id === userId ? updated : u)));
      setEdits((prev) => {
        const copy = { ...prev };
        delete copy[userId];
        return copy;
      });
      setMessage('✓ Изменения сохранены успешно!');
      setMessageType('success');
    } catch (e) {
      setMessage('Ошибка сохранения.');
      setMessageType('error');
    }
  }

  function handleEdit(userId, patch) {
    setEdits(prev => ({
      ...prev,
      [userId]: { ...prev[userId], ...patch },
    }));
  }

  const getRoleColor = (role) => {
    const option = ROLE_OPTIONS.find(o => o.value === role);
    return option?.color || '#16a34a';
  };

  const togglePermission = (role, permId) => {
    setRolePerms(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [permId]: !prev[role]?.[permId],
      },
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>👥 Управление пользователями</h1>
          <p style={{ color: 'var(--text-secondary)' }} className="text-sm mt-2">Полный учет всех пользователей и управление правами доступа</p>
        </div>
        <button 
          onClick={load} 
          className="px-4 py-2 rounded-xl font-semibold transition-all duration-300 text-white"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          🔄 Обновить
        </button>
      </div>

      {/* Форма создания пользователя */}
      <div className="glass-card p-6">
        <h2 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>➕ Создать нового пользователя</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <input 
            className="px-4 py-3 rounded-xl border transition focus:outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--card-bg)',
              color: 'var(--text-primary)',
              borderColor: 'var(--card-border)',
              '--tw-ring-color': 'var(--accent)'
            }}
            placeholder="Имя" 
            value={form.name} 
            onChange={(e) => setForm({ ...form, name: e.target.value })} 
          />
          <input 
            className="px-4 py-3 rounded-xl border transition focus:outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--card-bg)',
              color: 'var(--text-primary)',
              borderColor: 'var(--card-border)',
              '--tw-ring-color': 'var(--accent)'
            }}
            placeholder="Email" 
            value={form.email} 
            onChange={(e) => setForm({ ...form, email: e.target.value })} 
          />
          <input 
            className="px-4 py-3 rounded-xl border transition focus:outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--card-bg)',
              color: 'var(--text-primary)',
              borderColor: 'var(--card-border)',
              '--tw-ring-color': 'var(--accent)'
            }}
            placeholder="Телефон" 
            value={form.phone} 
            onChange={(e) => setForm({ ...form, phone: e.target.value })} 
          />
          <select 
            className="px-4 py-3 rounded-xl border transition focus:outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--card-bg)',
              color: 'var(--text-primary)',
              borderColor: 'var(--card-border)',
              '--tw-ring-color': 'var(--accent)'
            }}
            value={form.role} 
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <input 
            className="px-4 py-3 rounded-xl border transition focus:outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--card-bg)',
              color: 'var(--text-primary)',
              borderColor: 'var(--card-border)',
              '--tw-ring-color': 'var(--accent)'
            }}
            placeholder="Пароль" 
            type="password" 
            value={form.password} 
            onChange={(e) => setForm({ ...form, password: e.target.value })} 
          />
          <button 
            onClick={handleCreate} 
            className="px-4 py-3 rounded-xl text-white font-semibold transition-all duration-300 transform hover:scale-105"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            ✓ Создать
          </button>
        </div>
        
        {message && (
          <div 
            className="mt-4 p-4 rounded-xl font-semibold text-center"
            style={{
              backgroundColor: messageType === 'success' ? 'rgba(22,163,74,0.1)' : 'rgba(239,68,68,0.1)',
              color: messageType === 'success' ? 'var(--accent)' : '#ef4444',
              border: messageType === 'success' ? '1px solid rgba(22,163,74,0.3)' : '1px solid rgba(239,68,68,0.3)'
            }}
          >
            {message}
          </div>
        )}
      </div>

      {/* Фильтры и поиск */}
      <div className="glass-card p-6 flex flex-col md:flex-row gap-4">
        <input 
          className="flex-1 px-4 py-3 rounded-xl border transition focus:outline-none focus:ring-2"
          style={{
            backgroundColor: 'var(--card-bg)',
            color: 'var(--text-primary)',
            borderColor: 'var(--card-border)',
            '--tw-ring-color': 'var(--accent)'
          }}
          placeholder="🔍 Поиск по имени или email..." 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
        />
        <select 
          className="px-4 py-3 rounded-xl border transition focus:outline-none focus:ring-2"
          style={{
            backgroundColor: 'var(--card-bg)',
            color: 'var(--text-primary)',
            borderColor: 'var(--card-border)',
            '--tw-ring-color': 'var(--accent)'
          }}
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
        >
          <option value="all">Все роли</option>
          {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>

      <div className="glass-card p-6">
        <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>🔐 Матрица прав доступа</h2>
        <div className="overflow-auto">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="p-3 text-left">Раздел</th>
                {ROLE_OPTIONS.map(r => (
                  <th key={r.value} className="p-3 text-left">{r.value}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map(p => (
                <tr key={p.id} className="border-t hover:bg-white/5">
                  <td className="p-3">{p.label}</td>
                  {ROLE_OPTIONS.map(r => (
                    <td key={r.value} className="p-3">
                      <button
                        onClick={() => togglePermission(r.value, p.id)}
                        className={`px-3 py-1 rounded text-sm ${rolePerms?.[r.value]?.[p.id] ? 'bg-emerald-600 text-white' : 'bg-white/5 text-slate-400'}`}
                      >
                        {rolePerms?.[r.value]?.[p.id] ? 'Разрешено' : 'Запрещено'}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400 mt-3">Матрица демонстрационная. Для реального контроля нужно связать с сервером.</p>
      </div>

      {/* Таблица пользователей */}
      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b" style={{ borderColor: 'var(--card-border)' }}>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            📋 Список пользователей
            <span className="text-sm px-3 py-1 rounded-full" style={{ backgroundColor: 'var(--accent)', color: 'white' }}>
              {filteredUsers.length}
            </span>
          </h2>
        </div>
        <div className="overflow-auto">
          <table className="w-full">
            <thead style={{ backgroundColor: 'var(--card-bg)', borderBottom: '1px solid var(--card-border)' }}>
              <tr>
                <th className="p-4 text-left font-semibold" style={{ color: 'var(--text-primary)' }}>Имя</th>
                <th className="p-4 text-left font-semibold" style={{ color: 'var(--text-primary)' }}>Email</th>
                <th className="p-4 text-left font-semibold" style={{ color: 'var(--text-primary)' }}>Телефон</th>
                <th className="p-4 text-left font-semibold" style={{ color: 'var(--text-primary)' }}>Роль</th>
                <th className="p-4 text-left font-semibold" style={{ color: 'var(--text-primary)' }}>Новый пароль</th>
                <th className="p-4 text-left font-semibold" style={{ color: 'var(--text-primary)' }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const draft = edits[u.id] || {};
                return (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <td className="p-4">
                      <input 
                        className="px-3 py-2 rounded-lg border transition focus:outline-none focus:ring-2 w-full"
                        style={{
                          backgroundColor: 'var(--card-bg)',
                          color: 'var(--text-primary)',
                          borderColor: 'var(--card-border)',
                          '--tw-ring-color': 'var(--accent)'
                        }}
                        defaultValue={u.name} 
                        onChange={(e) => handleEdit(u.id, { name: e.target.value })} 
                      />
                    </td>
                    <td className="p-4">
                      <input 
                        className="px-3 py-2 rounded-lg border transition focus:outline-none focus:ring-2 w-full"
                        style={{
                          backgroundColor: 'var(--card-bg)',
                          color: 'var(--text-primary)',
                          borderColor: 'var(--card-border)',
                          '--tw-ring-color': 'var(--accent)'
                        }}
                        defaultValue={u.email} 
                        onChange={(e) => handleEdit(u.id, { email: e.target.value })} 
                      />
                    </td>
                    <td className="p-4">
                      <input 
                        className="px-3 py-2 rounded-lg border transition focus:outline-none focus:ring-2 w-full"
                        style={{
                          backgroundColor: 'var(--card-bg)',
                          color: 'var(--text-primary)',
                          borderColor: 'var(--card-border)',
                          '--tw-ring-color': 'var(--accent)'
                        }}
                        defaultValue={u.phone || ''} 
                        onChange={(e) => handleEdit(u.id, { phone: e.target.value })} 
                      />
                    </td>
                    <td className="p-4">
                      <select 
                        className="px-3 py-2 rounded-lg border transition focus:outline-none focus:ring-2 w-full font-semibold"
                        style={{
                          backgroundColor: 'var(--card-bg)',
                          color: getRoleColor(draft.role || u.role),
                          borderColor: getRoleColor(draft.role || u.role),
                          '--tw-ring-color': 'var(--accent)'
                        }}
                        defaultValue={u.role} 
                        onChange={(e) => handleEdit(u.id, { role: e.target.value })}
                      >
                        {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </td>
                    <td className="p-4">
                      <input 
                        className="px-3 py-2 rounded-lg border transition focus:outline-none focus:ring-2 w-full"
                        style={{
                          backgroundColor: 'var(--card-bg)',
                          color: 'var(--text-primary)',
                          borderColor: 'var(--card-border)',
                          '--tw-ring-color': 'var(--accent)'
                        }}
                        type="password" 
                        placeholder="••••••" 
                        value={draft.password || ''} 
                        onChange={(e) => handleEdit(u.id, { password: e.target.value })} 
                      />
                    </td>
                    <td className="p-4">
                      <button 
                        onClick={() => handleSave(u.id)} 
                        className="px-4 py-2 rounded-lg text-white font-semibold transition-all duration-300 transform hover:scale-105 whitespace-nowrap"
                        style={{ backgroundColor: 'var(--accent)' }}
                      >
                        ✓ Сохранить
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && !loading && (
                <tr>
                  <td className="p-6 text-center" style={{ color: 'var(--text-secondary)' }} colSpan="6">
                    📭 Пользователи не найдены
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td className="p-6 text-center" style={{ color: 'var(--text-secondary)' }} colSpan="6">
                    ⏳ Загрузка...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Информационная панель */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>📊 Информация о правах доступа</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ROLE_OPTIONS.map(opt => (
            <div 
              key={opt.value}
              className="p-4 rounded-xl border"
              style={{ 
                backgroundColor: 'var(--card-bg)',
                borderColor: opt.color
              }}
            >
              <p className="font-semibold mb-2" style={{ color: opt.color }}>{opt.label}</p>
              <ul className="text-sm space-y-1" style={{ color: 'var(--text-secondary)' }}>
                {opt.value === 'Администратор' && (
                  <>
                    <li>✓ Полный доступ ко всем функциям</li>
                    <li>✓ Управление пользователями</li>
                    <li>✓ Финансовые отчёты</li>
                    <li>✓ Системные настройки</li>
                  </>
                )}
                {opt.value === 'Тренер' && (
                  <>
                    <li>✓ Управление тренировками</li>
                    <li>✓ Просмотр членов</li>
                    <li>✓ Аналитика</li>
                    <li>✗ Нет доступа к финансам</li>
                  </>
                )}
                {opt.value === 'Клиент' && (
                  <>
                    <li>✓ Бронирование тренировок</li>
                    <li>✓ История платежей</li>
                    <li>✓ Личный профиль</li>
                    <li>✗ Нет доступа к управлению</li>
                  </>
                )}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
