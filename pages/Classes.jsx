import React, { useState, useEffect } from 'react';
import { fetchClasses, createClass, updateClass, deleteClass, isApiAvailable } from '../api';

export default function Classes() {
  const [classes, setClasses] = useState([]);
  const [filterLevel, setFilterLevel] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', trainerName: '', schedule: '', capacity: 10, enrolled: 0, level: 'Начинающие' });
  const [useApi, setUseApi] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const ok = await isApiAvailable();
      if (!mounted) return;
      setUseApi(ok);
      if (ok) {
        try { const data = await fetchClasses(); setClasses(data); return; } catch (e) { }
      }
      const saved = localStorage.getItem('classes');
      if (saved) setClasses(JSON.parse(saved));
      else {
        const init = [
          { id: 1, name: 'Йога для начинающих', trainerName: 'Светлана Смирнова', schedule: 'вт, ср, пт - 09:00', capacity: 20, enrolled: 18, level: 'Начинающие' },
          { id: 2, name: 'Кроссфит', trainerName: 'Иван Иванов', schedule: 'Каждый день - 10:00', capacity: 15, enrolled: 15, level: 'Средние' },
        ];
        setClasses(init); localStorage.setItem('classes', JSON.stringify(init));
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => { if (!useApi) localStorage.setItem('classes', JSON.stringify(classes)); }, [classes, useApi]);

  const filteredClasses = classes.filter(cls => filterLevel === 'all' || cls.level === filterLevel);

  function openAdd() { setEditing(null); setForm({ name: '', trainerName: '', schedule: '', capacity: 10, enrolled: 0, level: 'Начинающие' }); setIsModalOpen(true); }
  function openEdit(cls) { setEditing(cls.id); setForm({ name: cls.name, trainerName: cls.trainerName, schedule: cls.schedule, capacity: cls.capacity, enrolled: cls.enrolled, level: cls.level }); setIsModalOpen(true); }

  async function save() {
    if (!form.name) return alert('Введите название');
    if (useApi) {
      try {
        if (editing) { const updated = await updateClass(editing, form); setClasses(prev => prev.map(p => p.id === editing ? updated : p)); }
        else { const created = await createClass(form); setClasses(prev => [created, ...prev]); }
        setIsModalOpen(false);
      } catch (e) { alert('Ошибка API, выполняю локально'); if (editing) setClasses(prev => prev.map(p => p.id === editing ? { ...p, ...form } : p)); else setClasses(prev => [{ id: Date.now(), ...form }, ...prev]); setIsModalOpen(false); }
    } else { if (editing) setClasses(prev => prev.map(p => p.id === editing ? { ...p, ...form } : p)); else setClasses(prev => [{ id: Date.now(), ...form }, ...prev]); setIsModalOpen(false); }
  }

  async function remove(id) { if (!confirm('Удалить тренировку?')) return; if (useApi) { try { await deleteClass(id); setClasses(prev => prev.filter(p => p.id !== id)); } catch (e) { alert('Ошибка API, удаляю локально'); setClasses(prev => prev.filter(p => p.id !== id)); } } else setClasses(prev => prev.filter(p => p.id !== id)); }

  const levelColors = { 'Начинающие': 'bg-green-100 text-green-800', 'Средние': 'bg-yellow-100 text-yellow-800', 'Продвинутые': 'bg-red-100 text-red-800' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Тренировки</h1>
          <p className="text-gray-600">Управление тренировками</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openAdd} className="bg-blue-600 text-white px-4 py-2 rounded">Добавить тренировку</button>
        </div>
      </div>

      <div className="flex gap-4">
        {['all', 'Начинающие', 'Средние', 'Продвинутые'].map(level => (
          <button key={level} onClick={() => setFilterLevel(level)} className={`px-4 py-2 rounded ${filterLevel===level ? 'bg-blue-600 text-white' : 'bg-white/5 border text-slate-200'}`}>{level==='all'?'Все':level}</button>
        ))}
      </div>

      <div className="glass-card p-4">
        <table className="w-full">
          <thead><tr>
            <th className="p-3 text-left">Название</th><th className="p-3 text-left">Тренер</th><th className="p-3 text-left">Расписание</th><th className="p-3 text-left">Места</th><th className="p-3 text-left">Уровень</th><th className="p-3 text-right">Действия</th>
          </tr></thead>
          <tbody>
            {filteredClasses.map(cls => (
              <tr key={cls.id} className="border-t hover:bg-white/5"><td className="p-3 font-medium text-slate-900">{cls.name}</td><td className="p-3">{cls.trainerName || cls.trainer}</td><td className="p-3">{cls.schedule}</td><td className="p-3">{cls.enrolled}/{cls.capacity}</td><td className="p-3"><span className={`px-3 py-1 rounded ${levelColors[cls.level] || ''}`}>{cls.level}</span></td><td className="p-3 text-right"><button onClick={() => openEdit(cls)} className="px-3 py-1 bg-white/5 text-blue-400 rounded mr-2">Править</button><button onClick={() => remove(cls.id)} className="px-3 py-1 bg-white/5 text-red-400 rounded">Удалить</button></td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="glass-card p-6 w-full max-w-lg">
            <h3 className="text-lg font-bold mb-4">{editing ? 'Редактировать тренировку' : 'Добавить тренировку'}</h3>
            <div className="grid gap-3">
              <input className="px-3 py-2 border rounded bg-white/5 text-slate-200" placeholder="Название" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              <input className="px-3 py-2 border rounded bg-white/5 text-slate-200" placeholder="Тренер" value={form.trainerName} onChange={e => setForm({...form, trainerName: e.target.value})} />
              <input className="px-3 py-2 border rounded bg-white/5 text-slate-200" placeholder="Расписание" value={form.schedule} onChange={e => setForm({...form, schedule: e.target.value})} />
            </div>
            <div className="mt-4 flex justify-end gap-2"><button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded text-slate-200">Отмена</button><button onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded">Сохранить</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
