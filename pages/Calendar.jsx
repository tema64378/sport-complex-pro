import React, { useEffect, useMemo, useState } from 'react';
import { isApiAvailable, fetchCalendarSlots as apiFetchCalendarSlots, createCalendarSlot as apiCreateCalendarSlot, deleteCalendarSlot as apiDeleteCalendarSlot } from '../api';

const seed = [
  { id: 1, date: '2026-02-11', time: '10:00', className: 'Йога', trainer: 'Светлана Смирнова', capacity: 16, booked: 12 },
  { id: 2, date: '2026-02-11', time: '12:00', className: 'Кроссфит', trainer: 'Иван Иванов', capacity: 12, booked: 12 },
  { id: 3, date: '2026-02-12', time: '09:00', className: 'Пилатес', trainer: 'Мария Кузнецова', capacity: 14, booked: 7 },
  { id: 4, date: '2026-02-13', time: '19:00', className: 'Силовая', trainer: 'Антон Морозов', capacity: 10, booked: 8 },
];

function loadSlots() {
  try {
    const raw = localStorage.getItem('calendar_slots');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return seed;
}

export default function Calendar() {
  const [slots, setSlots] = useState(loadSlots());
  const [form, setForm] = useState({ date: '', time: '', className: '', trainer: '', capacity: 12, booked: 0 });
  const [useApi, setUseApi] = useState(false);

  useEffect(() => {
    (async () => {
      const ok = await isApiAvailable();
      setUseApi(ok);
      if (ok) {
        try {
          const remote = await apiFetchCalendarSlots();
          setSlots(remote);
          return;
        } catch (e) {}
      }
      setSlots(loadSlots());
    })();
  }, []);

  useEffect(() => {
    if (!useApi) {
      try { localStorage.setItem('calendar_slots', JSON.stringify(slots)); } catch (e) {}
    }
  }, [slots, useApi]);

  const grouped = useMemo(() => {
    const map = {};
    slots.forEach(s => {
      map[s.date] = map[s.date] || [];
      map[s.date].push(s);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [slots]);

  async function addSlot() {
    if (!form.date || !form.time || !form.className.trim()) return alert('Заполните дату, время и название.');
    const payload = { ...form, capacity: Number(form.capacity || 0), booked: Number(form.booked || 0) };
    if (useApi) {
      try {
        const created = await apiCreateCalendarSlot(payload);
        setSlots(prev => [created, ...prev]);
        setForm({ date: '', time: '', className: '', trainer: '', capacity: 12, booked: 0 });
        return;
      } catch (e) {}
    }
    setSlots(prev => [{ id: Date.now(), ...payload }, ...prev]);
    setForm({ date: '', time: '', className: '', trainer: '', capacity: 12, booked: 0 });
  }

  async function remove(id) {
    if (!confirm('Удалить слот?')) return;
    if (useApi) {
      try {
        await apiDeleteCalendarSlot(id);
        setSlots(prev => prev.filter(s => s.id !== id));
        return;
      } catch (e) {}
    }
    setSlots(prev => prev.filter(s => s.id !== id));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Календарь бронирований</h1>
        <p className="text-gray-600 text-sm mt-2">Планирование слотов и доступности</p>
      </div>

      <div className="glass-card p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Добавить слот</h2>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <input className="px-3 py-2 border rounded bg-white/5 text-slate-200" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
          <input className="px-3 py-2 border rounded bg-white/5 text-slate-200" type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
          <input className="px-3 py-2 border rounded bg-white/5 text-slate-200" placeholder="Тренировка" value={form.className} onChange={e => setForm({ ...form, className: e.target.value })} />
          <input className="px-3 py-2 border rounded bg-white/5 text-slate-200" placeholder="Тренер" value={form.trainer} onChange={e => setForm({ ...form, trainer: e.target.value })} />
          <input className="px-3 py-2 border rounded bg-white/5 text-slate-200" type="number" placeholder="Мест" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} />
          <button onClick={addSlot} className="bg-blue-600 text-white py-2 rounded">Добавить</button>
        </div>
      </div>

      <div className="space-y-4">
        {grouped.map(([date, items]) => (
          <div key={date} className="glass-card p-5 space-y-3">
            <h3 className="text-lg font-bold text-slate-900">{date}</h3>
            <div className="calendar-grid">
              {items.map(slot => (
                <div key={slot.id} className="calendar-slot p-4 rounded-lg border border-white/10 bg-white/5">
                  <div className="text-sm text-slate-400">{slot.time}</div>
                  <div className="text-lg font-semibold text-slate-900 mt-1">{slot.className}</div>
                  <div className="text-sm text-slate-400 mt-1">{slot.trainer || 'Без тренера'}</div>
                  <div className="text-sm mt-2 text-slate-400">Места: {slot.booked}/{slot.capacity}</div>
                  <button onClick={() => remove(slot.id)} className="mt-3 px-3 py-2 bg-white/5 text-red-400 rounded">Удалить</button>
                </div>
              ))}
            </div>
          </div>
        ))}
        {grouped.length === 0 && <p className="text-sm text-slate-400">Слотов пока нет.</p>}
      </div>
    </div>
  );
}
