import React, { useEffect, useMemo, useState } from 'react';

const seed = [
  { id: 1, type: 'Оплата', title: 'Просрочен платёж', message: 'Клиент Мария Иванова: счёт на 1 500 ₽ просрочен на 2 дня', createdAt: '2026-02-10 11:20', read: false },
  { id: 2, type: 'Тренировка', title: 'Напоминание', message: 'Тренировка "Йога для начинающих" через 2 часа', createdAt: '2026-02-10 09:10', read: false },
  { id: 3, type: 'Абонемент', title: 'Истекает абонемент', message: 'Клиент Сергей Кузнецов: осталось 3 дня', createdAt: '2026-02-09 18:05', read: true },
  { id: 4, type: 'Система', title: 'Обновление расписания', message: 'Добавлены слоты в субботу', createdAt: '2026-02-08 12:30', read: true },
];

function loadNotifications() {
  try {
    const raw = localStorage.getItem('notifications');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return seed;
}

export default function Notifications() {
  const [notifications, setNotifications] = useState(loadNotifications());
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState({ type: 'Система', title: '', message: '' });

  useEffect(() => {
    try { localStorage.setItem('notifications', JSON.stringify(notifications)); } catch (e) {}
  }, [notifications]);

  const filtered = useMemo(() => {
    if (filter === 'unread') return notifications.filter(n => !n.read);
    if (filter === 'read') return notifications.filter(n => n.read);
    return notifications;
  }, [notifications, filter]);

  function toggleRead(id) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: !n.read } : n));
  }

  function remove(id) {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }

  function addNotification() {
    if (!form.title.trim() || !form.message.trim()) return alert('Заполните заголовок и текст.');
    const item = {
      id: Date.now(),
      type: form.type,
      title: form.title,
      message: form.message,
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      read: false,
    };
    setNotifications(prev => [item, ...prev]);
    setForm({ type: 'Система', title: '', message: '' });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Уведомления</h1>
        <p className="text-gray-600 text-sm mt-2">Просрочки, напоминания, системные события</p>
      </div>

      <div className="glass-card p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Создать уведомление</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select className="px-3 py-2 border rounded bg-white/5 text-slate-200" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
            <option>Система</option>
            <option>Оплата</option>
            <option>Тренировка</option>
            <option>Абонемент</option>
          </select>
          <input className="px-3 py-2 border rounded bg-white/5 text-slate-200" placeholder="Заголовок" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <input className="px-3 py-2 border rounded bg-white/5 text-slate-200" placeholder="Сообщение" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
          <button onClick={addNotification} className="bg-blue-600 text-white py-2 rounded">Добавить</button>
        </div>
      </div>

      <div className="flex gap-2 border-b">
        {[
          { id: 'all', label: 'Все' },
          { id: 'unread', label: 'Непрочитанные' },
          { id: 'read', label: 'Прочитанные' },
        ].map(t => (
          <button key={t.id} onClick={() => setFilter(t.id)} className={`px-4 py-2 font-medium border-b-2 transition ${filter === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map(n => (
          <div key={n.id} className={`glass-card p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 ${n.read ? 'opacity-80' : ''}`}>
            <div>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span className="px-2 py-1 rounded bg-white/5">{n.type}</span>
                <span>{n.createdAt}</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mt-2">{n.title}</h3>
              <p className="text-slate-400 mt-1">{n.message}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => toggleRead(n.id)} className="px-4 py-2 border rounded text-slate-200">{n.read ? 'Отметить непроч.' : 'Прочитать'}</button>
              <button onClick={() => remove(n.id)} className="px-4 py-2 bg-red-600 text-white rounded">Удалить</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-slate-400">Нет уведомлений.</p>}
      </div>
    </div>
  );
}
