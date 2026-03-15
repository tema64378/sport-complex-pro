import React, { useEffect, useMemo, useState } from 'react';
import { fetchBookings, createBooking, updateBooking, deleteBooking, isApiAvailable } from '../apiClient';

const DENSITY_KEY = 'bookings_density_v2';

function loadDensity() {
  try {
    return localStorage.getItem(DENSITY_KEY) || 'comfortable';
  } catch (e) {
    return 'comfortable';
  }
}

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [density, setDensity] = useState(loadDensity());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ member: '', className: '', date: '', time: '', status: 'Подтверждено' });
  const [useApi, setUseApi] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const ok = await isApiAvailable();
      if (!mounted) return;
      setUseApi(ok);
      if (ok) {
        try {
          const data = await fetchBookings();
          if (!mounted) return;
          setBookings(data || []);
          setLoading(false);
          return;
        } catch (e) {}
      }
      const saved = localStorage.getItem('bookings');
      if (saved) {
        setBookings(JSON.parse(saved));
      } else {
        const init = [
          { id: 1, member: 'Мария Иванова', className: 'Йога для начинающих', date: '2024-01-29', time: '09:00', status: 'Подтверждено' },
          { id: 2, member: 'Сергей Кузнецов', className: 'Кроссфит', date: '2024-01-29', time: '10:00', status: 'Ожидание' },
        ];
        setBookings(init);
        localStorage.setItem('bookings', JSON.stringify(init));
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!useApi) localStorage.setItem('bookings', JSON.stringify(bookings));
  }, [bookings, useApi]);

  useEffect(() => {
    try {
      localStorage.setItem(DENSITY_KEY, density);
    } catch (e) {}
  }, [density]);

  const filteredBookings = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return bookings.filter((booking) => {
      const byStatus = filterStatus === 'all' || booking.status === filterStatus;
      const bySearch =
        !q
        || String(booking.member || '').toLowerCase().includes(q)
        || String(booking.className || booking.class || '').toLowerCase().includes(q);
      return byStatus && bySearch;
    });
  }, [bookings, filterStatus, searchTerm]);

  const statusColors = {
    Подтверждено: 'status-badge status-ok',
    Ожидание: 'status-badge status-warning',
    Отменено: 'status-badge status-danger',
  };

  function openAdd() {
    setEditing(null);
    setForm({ member: '', className: '', date: new Date().toISOString().slice(0, 10), time: '09:00', status: 'Подтверждено' });
    setIsModalOpen(true);
  }

  function openEdit(booking) {
    setEditing(booking.id);
    setForm({ member: booking.member, className: booking.className || booking.class, date: booking.date, time: booking.time, status: booking.status });
    setIsModalOpen(true);
  }

  async function save() {
    if (!form.member || !form.className) return alert('Введите клиента и тренировку');
    if (useApi) {
      try {
        if (editing) {
          const updated = await updateBooking(editing, form);
          setBookings((prev) => prev.map((item) => (item.id === editing ? updated : item)));
        } else {
          const created = await createBooking(form);
          setBookings((prev) => [created, ...prev]);
        }
        setIsModalOpen(false);
        return;
      } catch (e) {}
    }

    if (editing) setBookings((prev) => prev.map((item) => (item.id === editing ? { ...item, ...form } : item)));
    else setBookings((prev) => [{ id: Date.now(), ...form }, ...prev]);
    setIsModalOpen(false);
  }

  async function remove(id) {
    if (!confirm('Удалить бронирование?')) return;
    if (useApi) {
      try {
        await deleteBooking(id);
      } catch (e) {}
    }
    setBookings((prev) => prev.filter((item) => item.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Бронирования</h1>
          <p className="text-gray-600">Управление записями клиентов • всего: {bookings.length}</p>
        </div>
        <button onClick={openAdd} className="bg-blue-600 text-white px-6 py-2 rounded">Новое бронирование</button>
      </div>

      <div className="glass-card p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="news-search">
            <i className="fas fa-search" />
            <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Поиск клиента/тренировки" />
          </label>
          <div className="flex gap-2 flex-wrap items-center">
            {['all', 'Подтверждено', 'Ожидание', 'Отменено'].map((status) => (
              <button key={status} onClick={() => setFilterStatus(status)} className={`chip ${filterStatus === status ? 'active' : ''}`}>
                {status === 'all' ? 'Все' : status}
              </button>
            ))}
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-sm text-slate-600">Плотность:</span>
            <button className={`chip ${density === 'comfortable' ? 'active' : ''}`} onClick={() => setDensity('comfortable')}>Комфорт</button>
            <button className={`chip ${density === 'compact' ? 'active' : ''}`} onClick={() => setDensity('compact')}>Компактно</button>
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden table-shell">
        {loading ? (
          <div className="p-5 space-y-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="skeleton-card rounded-xl p-5" />
            ))}
          </div>
        ) : filteredBookings.length ? (
          <div className="overflow-auto">
            <table className={`w-full ${density === 'compact' ? 'table-compact' : 'table-comfortable'}`}>
              <thead>
                <tr>
                  <th>Клиент</th>
                  <th>Тренировка</th>
                  <th>Дата</th>
                  <th>Время</th>
                  <th>Статус</th>
                  <th className="text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map((booking) => (
                  <tr key={booking.id}>
                    <td className="font-medium">{booking.member}</td>
                    <td>{booking.className || booking.class}</td>
                    <td>{booking.date}</td>
                    <td>{booking.time}</td>
                    <td><span className={statusColors[booking.status] || 'status-badge'}>{booking.status}</span></td>
                    <td className="text-right">
                      <div className="inline-flex gap-1">
                        <button onClick={() => openEdit(booking)} className="icon-btn" title="Редактировать"><i className="fas fa-pen" /></button>
                        <button onClick={() => remove(booking.id)} className="icon-btn" title="Удалить"><i className="fas fa-trash" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500">По текущему фильтру записей нет.</div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="glass-card p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">{editing ? 'Редактировать бронирование' : 'Новое бронирование'}</h3>
            <div className="grid gap-3">
              <input className="px-3 py-2 border rounded" placeholder="Клиент" value={form.member} onChange={(e) => setForm({ ...form, member: e.target.value })} />
              <input className="px-3 py-2 border rounded" placeholder="Тренировка" value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} />
              <input type="date" className="px-3 py-2 border rounded" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              <input type="time" className="px-3 py-2 border rounded" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
              <select className="px-3 py-2 border rounded" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option>Подтверждено</option>
                <option>Ожидание</option>
                <option>Отменено</option>
              </select>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded">Отмена</button>
              <button onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded">Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
