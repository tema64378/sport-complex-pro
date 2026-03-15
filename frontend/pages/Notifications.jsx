import React, { useEffect, useMemo, useState } from 'react';
import {
  isApiAvailable,
  fetchNotifications as apiFetchNotifications,
  createNotification as apiCreateNotification,
  updateNotification as apiUpdateNotification,
  deleteNotification as apiDeleteNotification,
} from '../apiClient';

const seed = [
  {
    id: 1,
    type: 'Оплата',
    title: 'Просрочен платёж',
    message: 'Клиент Мария Иванова: счёт на 1 500 ₽ просрочен на 2 дня',
    createdAt: '2026-02-10 11:20',
    read: false,
  },
  {
    id: 2,
    type: 'Тренировка',
    title: 'Напоминание',
    message: 'Тренировка "Йога для начинающих" через 2 часа',
    createdAt: '2026-02-10 09:10',
    read: false,
  },
  {
    id: 3,
    type: 'Абонемент',
    title: 'Истекает абонемент',
    message: 'Клиент Сергей Кузнецов: осталось 3 дня',
    createdAt: '2026-02-09 18:05',
    read: true,
  },
  {
    id: 4,
    type: 'Система',
    title: 'Обновление расписания',
    message: 'Добавлены слоты в субботу',
    createdAt: '2026-02-08 12:30',
    read: true,
  },
];

function loadNotifications() {
  try {
    const raw = localStorage.getItem('notifications');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return seed;
}

function typePriority(type) {
  if (type === 'Оплата') return 'critical';
  if (type === 'Абонемент') return 'warning';
  if (type === 'Тренировка') return 'info';
  return 'info';
}

export default function Notifications() {
  const [notifications, setNotifications] = useState(loadNotifications());
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ type: 'Система', title: '', message: '' });
  const [useApi, setUseApi] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const ok = await isApiAvailable();
      setUseApi(ok);
      if (ok) {
        try {
          const remote = await apiFetchNotifications();
          setNotifications(remote);
          setLoading(false);
          return;
        } catch (e) {}
      }
      setNotifications(loadNotifications());
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!useApi) {
      try {
        localStorage.setItem('notifications', JSON.stringify(notifications));
      } catch (e) {}
    }
  }, [notifications, useApi]);

  const metrics = useMemo(() => {
    const unread = notifications.filter((item) => !item.read).length;
    const critical = notifications.filter((item) => typePriority(item.type) === 'critical').length;
    return {
      all: notifications.length,
      unread,
      critical,
    };
  }, [notifications]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notifications.filter((item) => {
      const byFilter =
        filter === 'all'
          ? true
          : filter === 'unread'
            ? !item.read
            : typePriority(item.type) === 'critical';
      if (!byFilter) return false;
      if (!q) return true;
      return (
        String(item.title || '').toLowerCase().includes(q)
        || String(item.message || '').toLowerCase().includes(q)
        || String(item.type || '').toLowerCase().includes(q)
      );
    });
  }, [notifications, filter, query]);

  async function toggleRead(id) {
    const next = notifications.find((n) => n.id === id);
    if (!next) return;
    const updated = { ...next, read: !next.read };
    if (useApi) {
      try {
        const saved = await apiUpdateNotification(id, { read: updated.read });
        setNotifications((prev) => prev.map((n) => (n.id === id ? saved : n)));
        return;
      } catch (e) {}
    }
    setNotifications((prev) => prev.map((n) => (n.id === id ? updated : n)));
  }

  async function remove(id) {
    if (useApi) {
      try {
        await apiDeleteNotification(id);
        setNotifications((prev) => prev.filter((n) => n.id !== id));
        return;
      } catch (e) {}
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  async function markAllRead() {
    const unread = notifications.filter((item) => !item.read);
    if (!unread.length) return;

    if (useApi) {
      try {
        await Promise.all(unread.map((item) => apiUpdateNotification(item.id, { read: true })));
      } catch (e) {}
    }

    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
  }

  async function addNotification() {
    if (!form.title.trim() || !form.message.trim()) return alert('Заполните заголовок и текст.');

    const item = {
      id: Date.now(),
      type: form.type,
      title: form.title,
      message: form.message,
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      read: false,
    };

    if (useApi) {
      try {
        const saved = await apiCreateNotification({
          type: form.type,
          title: form.title,
          message: form.message,
        });
        setNotifications((prev) => [saved, ...prev]);
        setForm({ type: 'Система', title: '', message: '' });
        return;
      } catch (e) {}
    }

    setNotifications((prev) => [item, ...prev]);
    setForm({ type: 'Система', title: '', message: '' });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <p className="text-sm text-slate-400">Всего в inbox</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{metrics.all}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-slate-400">Непрочитанные</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">{metrics.unread}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-slate-400">Критичные</p>
          <p className="text-3xl font-bold text-red-600 mt-2">{metrics.critical}</p>
        </div>
      </div>

      <div className="glass-card p-6 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-lg font-bold text-slate-900">Inbox-центр</h2>
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: 'Все' },
              { id: 'unread', label: 'Непрочитанные' },
              { id: 'critical', label: 'Критичные' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`chip ${filter === tab.id ? 'active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
            <button className="action-btn" onClick={markAllRead}>
              <i className="fas fa-check-double" />
              Прочитать всё
            </button>
          </div>
        </div>

        <label className="news-search">
          <i className="fas fa-magnifying-glass" />
          <input
            placeholder="Поиск по уведомлениям"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="skeleton-card p-5 rounded-xl" />
            ))}
          </div>
        ) : filtered.length ? (
          <div className="space-y-3">
            {filtered.map((item) => {
              const priority = typePriority(item.type);
              return (
                <article key={item.id} className={`inbox-item ${priority} ${item.read ? 'read' : 'unread'}`}>
                  <div className="inbox-item-main">
                    <div className="inbox-topline">
                      <span className="inbox-type">{item.type}</span>
                      <span className="text-xs text-slate-500">{item.createdAt}</span>
                    </div>
                    <h3 className="inbox-title">{item.title}</h3>
                    <p className="inbox-message">{item.message}</p>
                  </div>
                  <div className="inbox-actions">
                    <button className="action-btn" onClick={() => toggleRead(item.id)}>
                      <i className={`fas ${item.read ? 'fa-eye-slash' : 'fa-eye'}`} />
                      {item.read ? 'Непроч.' : 'Прочитано'}
                    </button>
                    <button className="action-btn danger" onClick={() => remove(item.id)}>
                      <i className="fas fa-trash" />
                      Удалить
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-slate-500">Нет уведомлений под выбранный фильтр.</div>
        )}
      </div>

      <div className="glass-card p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Создать уведомление</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            className="px-3 py-2 border rounded bg-white/5 text-slate-900"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          >
            <option>Система</option>
            <option>Оплата</option>
            <option>Тренировка</option>
            <option>Абонемент</option>
          </select>
          <input
            className="px-3 py-2 border rounded bg-white/5 text-slate-900"
            placeholder="Заголовок"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <input
            className="px-3 py-2 border rounded bg-white/5 text-slate-900"
            placeholder="Сообщение"
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
          />
          <button onClick={addNotification} className="bg-blue-600 text-white py-2 rounded">
            Добавить
          </button>
        </div>
      </div>
    </div>
  );
}
