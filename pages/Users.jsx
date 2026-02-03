import React, { useEffect, useMemo, useState } from 'react';
import { fetchUsers, createUser, updateUser } from '../api';

const ROLE_OPTIONS = ['Администратор', 'Тренер', 'Клиент'];

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'Клиент', password: '' });
  const [edits, setEdits] = useState({});

  const emailSet = useMemo(() => new Set(users.map(u => u.email)), [users]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setMessage('');
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (e) {
      setMessage('Не удалось загрузить пользователей.');
    }
    setLoading(false);
  }

  async function handleCreate() {
    setMessage('');
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setMessage('Имя, email и пароль обязательны.');
      return;
    }
    if (emailSet.has(form.email.trim())) {
      setMessage('Пользователь с таким email уже существует.');
      return;
    }
    try {
      const created = await createUser(form);
      setUsers([created, ...users]);
      setForm({ name: '', email: '', phone: '', role: 'Клиент', password: '' });
      setMessage('Пользователь создан.');
    } catch (e) {
      setMessage('Ошибка создания пользователя.');
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
      setMessage('Изменения сохранены.');
    } catch (e) {
      setMessage('Ошибка сохранения.');
    }
  }

  function handleEdit(userId, patch) {
    setEdits(prev => ({
      ...prev,
      [userId]: { ...prev[userId], ...patch },
    }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Пользователи и роли</h1>
        <p className="text-slate-400 text-sm mt-2">Управление доступом и сотрудниками</p>
      </div>

      <div className="glass-card p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Создать пользователя</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input className="px-3 py-2 rounded border bg-white/5" placeholder="Имя" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="px-3 py-2 rounded border bg-white/5" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="px-3 py-2 rounded border bg-white/5" placeholder="Телефон" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <select className="px-3 py-2 rounded border bg-white/5" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <input className="px-3 py-2 rounded border bg-white/5" placeholder="Пароль" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </div>
        <button onClick={handleCreate} className="mt-4 bg-green-600 text-white px-4 py-2 rounded">Создать</button>
        {message && <p className="text-sm text-slate-400 mt-3">{message}</p>}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Список пользователей</h2>
          <button onClick={load} className="text-sm text-slate-500 hover:text-slate-900">Обновить</button>
        </div>
        <div className="overflow-auto">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="p-3 text-left">Имя</th>
                <th className="p-3 text-left">Email</th>
                <th className="p-3 text-left">Телефон</th>
                <th className="p-3 text-left">Роль</th>
                <th className="p-3 text-left">Новый пароль</th>
                <th className="p-3 text-left">Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const draft = edits[u.id] || {};
                return (
                  <tr key={u.id} className="border-t hover:bg-white/5">
                    <td className="p-3">
                      <input className="px-2 py-1 rounded bg-white/5 border" defaultValue={u.name} onChange={(e) => handleEdit(u.id, { name: e.target.value })} />
                    </td>
                    <td className="p-3">
                      <input className="px-2 py-1 rounded bg-white/5 border" defaultValue={u.email} onChange={(e) => handleEdit(u.id, { email: e.target.value })} />
                    </td>
                    <td className="p-3">
                      <input className="px-2 py-1 rounded bg-white/5 border" defaultValue={u.phone || ''} onChange={(e) => handleEdit(u.id, { phone: e.target.value })} />
                    </td>
                    <td className="p-3">
                      <select className="px-2 py-1 rounded bg-white/5 border" defaultValue={u.role} onChange={(e) => handleEdit(u.id, { role: e.target.value })}>
                        {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="p-3">
                      <input className="px-2 py-1 rounded bg-white/5 border" type="password" placeholder="••••••" value={draft.password || ''} onChange={(e) => handleEdit(u.id, { password: e.target.value })} />
                    </td>
                    <td className="p-3">
                      <button onClick={() => handleSave(u.id)} className="px-3 py-1 rounded bg-slate-900 text-white">Сохранить</button>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && !loading && (
                <tr><td className="p-4 text-slate-400" colSpan="6">Нет пользователей</td></tr>
              )}
              {loading && (
                <tr><td className="p-4 text-slate-400" colSpan="6">Загрузка...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
