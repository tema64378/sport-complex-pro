import React, { useState, useEffect } from 'react';
import { fetchBookings, createBooking, updateBooking, deleteBooking, isApiAvailable } from '../api';

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ member: '', className: '', date: '', time: '', status: 'Подтверждено' });
  const [useApi, setUseApi] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const ok = await isApiAvailable();
      if (!mounted) return;
      setUseApi(ok);
      if (ok) {
        try { const data = await fetchBookings(); setBookings(data); return; } catch (e) {}
      }
      const saved = localStorage.getItem('bookings');
      if (saved) setBookings(JSON.parse(saved));
      else {
        const init = [
          { id: 1, member: 'Мария Иванова', className: 'Йога для начинающих', date: '2024-01-29', time: '09:00', status: 'Подтверждено' },
          { id: 2, member: 'Сергей Кузнецов', className: 'Кроссфит', date: '2024-01-29', time: '10:00', status: 'Подтверждено' },
        ];
        setBookings(init); localStorage.setItem('bookings', JSON.stringify(init));
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => { if (!useApi) localStorage.setItem('bookings', JSON.stringify(bookings)); }, [bookings, useApi]);

  const filteredBookings = bookings.filter(booking => filterStatus === 'all' || booking.status === filterStatus);

  const statusColors = { 'Подтверждено': 'bg-green-100 text-green-800', 'Ожидание': 'bg-yellow-100 text-yellow-800', 'Отменено': 'bg-red-100 text-red-800' };
  const statusIcons = { 'Подтверждено': 'fa-check-circle text-green-600', 'Ожидание': 'fa-clock text-yellow-600', 'Отменено': 'fa-times-circle text-red-600' };

  function openAdd() { setEditing(null); setForm({ member: '', className: '', date: new Date().toISOString().slice(0,10), time: '09:00', status: 'Подтверждено' }); setIsModalOpen(true); }
  function openEdit(b) { setEditing(b.id); setForm({ member: b.member, className: b.className || b.class, date: b.date, time: b.time, status: b.status }); setIsModalOpen(true); }

  async function save() {
    if (!form.member || !form.className) return alert('Введите клиента и тренировку');
    if (useApi) {
      try {
        if (editing) { const updated = await updateBooking(editing, form); setBookings(prev => prev.map(p => p.id === editing ? updated : p)); }
        else { const created = await createBooking(form); setBookings(prev => [created, ...prev]); }
        setIsModalOpen(false);
      } catch (e) { alert('Ошибка API, выполняю локально'); if (editing) setBookings(prev => prev.map(p => p.id === editing ? { ...p, ...form } : p)); else setBookings(prev => [{ id: Date.now(), ...form }, ...prev]); setIsModalOpen(false); }
    } else { if (editing) setBookings(prev => prev.map(p => p.id === editing ? { ...p, ...form } : p)); else setBookings(prev => [{ id: Date.now(), ...form }, ...prev]); setIsModalOpen(false); }
  }

  async function remove(id) { if (!confirm('Удалить бронирование?')) return; if (useApi) { try { await deleteBooking(id); setBookings(prev => prev.filter(p => p.id !== id)); } catch (e) { alert('Ошибка API, удаляю локально'); setBookings(prev => prev.filter(p => p.id !== id)); } } else setBookings(prev => prev.filter(p => p.id !== id)); }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Бронирования</h1>
          <p className="text-gray-600">Управление бронированиями</p>
        </div>
        <button onClick={openAdd} className="bg-blue-600 text-white px-6 py-2 rounded">Новое бронирование</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-4"><p className="text-sm text-slate-400">Подтверждено</p><p className="text-2xl font-bold text-slate-900">{bookings.filter(b => b.status === 'Подтверждено').length}</p></div>
        <div className="glass-card p-4"><p className="text-sm text-slate-400">Ожидание</p><p className="text-2xl font-bold text-slate-900">{bookings.filter(b => b.status === 'Ожидание').length}</p></div>
        <div className="glass-card p-4"><p className="text-sm text-slate-400">Отменено</p><p className="text-2xl font-bold text-slate-900">{bookings.filter(b => b.status === 'Отменено').length}</p></div>
      </div>

      <div className="flex gap-4">
        {['all','Подтверждено','Ожидание','Отменено'].map(s => (<button key={s} onClick={() => setFilterStatus(s)} className={`px-4 py-2 rounded ${filterStatus===s ? 'bg-blue-600 text-white' : 'bg-white/5 border text-slate-200'}`}>{s==='all'?'Все':s}</button>))}
      </div>

      <div className="glass-card p-4">
        <table className="w-full">
          <thead><tr><th className="p-3 text-left">Клиент</th><th className="p-3 text-left">Тренировка</th><th className="p-3 text-left">Дата и время</th><th className="p-3 text-left">Статус</th><th className="p-3 text-right">Действия</th></tr></thead>
          <tbody>
            {filteredBookings.map(b => (<tr key={b.id} className="border-t"><td className="p-3">{b.member}</td><td className="p-3">{b.className||b.class}</td><td className="p-3">{b.date} в {b.time}</td><td className="p-3"><span className={`px-3 py-1 rounded ${statusColors[b.status]}`}>{b.status}</span></td><td className="p-3 text-right"><button onClick={() => openEdit(b)} className="px-3 py-1 bg-white/5 text-blue-400 rounded mr-2">Править</button><button onClick={() => remove(b.id)} className="px-3 py-1 bg-white/5 text-red-400 rounded">Удалить</button></td></tr>))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="glass-card p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">{editing ? 'Редактировать бронирование' : 'Новое бронирование'}</h3>
            <div className="grid gap-3">
              <input className="px-3 py-2 border rounded" placeholder="Клиент" value={form.member} onChange={e => setForm({...form, member: e.target.value})} />
              <input className="px-3 py-2 border rounded" placeholder="Тренировка" value={form.className} onChange={e => setForm({...form, className: e.target.value})} />
              <input type="date" className="px-3 py-2 border rounded" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
              <input type="time" className="px-3 py-2 border rounded" value={form.time} onChange={e => setForm({...form, time: e.target.value})} />
              <select className="px-3 py-2 border rounded" value={form.status} onChange={e => setForm({...form, status: e.target.value})}><option>Подтверждено</option><option>Ожидание</option><option>Отменено</option></select>
            </div>
            <div className="mt-4 flex justify-end gap-2"><button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded">Отмена</button><button onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded">Сохранить</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
