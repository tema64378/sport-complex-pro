import React, { useState, useEffect } from 'react';
import { fetchTrainers, createTrainer, updateTrainer, deleteTrainer, isApiAvailable } from '../api';

export default function Trainers() {
  const [trainers, setTrainers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', specialty: '', experience: '', members: 0, rating: 5 });
  const [useApi, setUseApi] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const ok = await isApiAvailable();
      if (!mounted) return;
      setUseApi(ok);
      if (ok) {
        try {
          const data = await fetchTrainers();
          setTrainers(data);
          return;
        } catch (e) {
          // fallback
        }
      }
      const saved = localStorage.getItem('trainers');
      if (saved) setTrainers(JSON.parse(saved));
      else {
        const init = [
          { id: 1, name: 'Светлана Смирнова', email: 'svetlana.smirnova@mail.ru', phone: '+7 (915) 200-01-01', specialty: 'Йога', experience: '8 лет', members: 24, rating: 4.8 },
          { id: 2, name: 'Иван Иванов', email: 'ivan.ivanov@mail.ru', phone: '+7 (915) 200-02-02', specialty: 'Кроссфит', experience: '6 лет', members: 32, rating: 4.9 },
        ];
        setTrainers(init);
        localStorage.setItem('trainers', JSON.stringify(init));
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => { if (!useApi) localStorage.setItem('trainers', JSON.stringify(trainers)); }, [trainers, useApi]);

  const filtered = trainers.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.specialty.toLowerCase().includes(searchTerm.toLowerCase()));

  function openAdd() { setEditing(null); setForm({ name: '', email: '', phone: '', specialty: '', experience: '', members: 0, rating: 5 }); setIsModalOpen(true); }
  function openEdit(t) { setEditing(t.id); setForm({ name: t.name, email: t.email, phone: t.phone, specialty: t.specialty, experience: t.experience, members: t.members, rating: t.rating }); setIsModalOpen(true); }

  async function save() {
    if (!form.name || !form.email) return alert('Введите имя и email');
    if (useApi) {
      try {
        if (editing) {
          const updated = await updateTrainer(editing, form);
          setTrainers(prev => prev.map(p => p.id === editing ? updated : p));
        } else {
          const created = await createTrainer(form);
          setTrainers(prev => [created, ...prev]);
        }
        setIsModalOpen(false);
      } catch (e) {
        alert('Ошибка API, выполняю локально');
        if (editing) setTrainers(prev => prev.map(p => p.id === editing ? { ...p, ...form } : p));
        else setTrainers(prev => [{ id: Date.now(), ...form }, ...prev]);
        setIsModalOpen(false);
      }
    } else {
      if (editing) setTrainers(prev => prev.map(p => p.id === editing ? { ...p, ...form } : p));
      else setTrainers(prev => [{ id: Date.now(), ...form }, ...prev]);
      setIsModalOpen(false);
    }
  }

  async function remove(id) {
    if (!confirm('Удалить тренера?')) return;
    if (useApi) {
      try { await deleteTrainer(id); setTrainers(prev => prev.filter(p => p.id !== id)); }
      catch (e) { alert('Ошибка API, удаляю локально'); setTrainers(prev => prev.filter(p => p.id !== id)); }
    } else setTrainers(prev => prev.filter(p => p.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Тренеры</h1>
          <p className="text-gray-600 text-sm mt-2">Управление тренирующим персоналом</p>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg">
            <i className="fas fa-plus mr-2"></i>Добавить тренера
          </button>
        </div>
      </div>

      <div className="relative">
        <i className="fas fa-search absolute left-4 top-3 text-slate-300"></i>
        <input type="text" placeholder="Поиск по имени или специальности..." className="w-full pl-12 pr-4 py-2 border rounded bg-white/5 text-slate-200" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(trainer => (
          <div key={trainer.id} className="glass-card p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">{trainer.name.charAt(0)}</div>
              <div>
                <h3 className="font-bold text-slate-900">{trainer.name}</h3>
                <p className="text-sm text-slate-400">{trainer.specialty}</p>
              </div>
            </div>
            <div className="space-y-2 mb-4">
              <p className="text-sm text-slate-400"><i className="fas fa-envelope mr-2 text-blue-400"></i>{trainer.email}</p>
              <p className="text-sm text-slate-400"><i className="fas fa-phone mr-2 text-blue-400"></i>{trainer.phone}</p>
              <p className="text-sm text-slate-400"><i className="fas fa-briefcase mr-2 text-blue-400"></i>{trainer.experience}</p>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-lg font-bold text-slate-900">{trainer.members}</p>
                <p className="text-xs text-slate-400">Активные клиенты</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(trainer)} className="px-3 py-2 bg-white/5 text-blue-400 rounded">Править</button>
                <button onClick={() => remove(trainer.id)} className="px-3 py-2 bg-white/5 text-red-400 rounded">Удалить</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="glass-card p-6 w-full max-w-lg">
            <h3 className="text-lg font-bold mb-4">{editing ? 'Редактировать тренера' : 'Добавить тренера'}</h3>
            <div className="grid gap-3">
              <input className="px-3 py-2 border rounded bg-white/5 text-slate-200" placeholder="Имя" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              <input className="px-3 py-2 border rounded bg-white/5 text-slate-200" placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              <input className="px-3 py-2 border rounded bg-white/5 text-slate-200" placeholder="Телефон" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              <input className="px-3 py-2 border rounded bg-white/5 text-slate-200" placeholder="Специальность" value={form.specialty} onChange={e => setForm({...form, specialty: e.target.value})} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded text-slate-200">Отмена</button>
              <button onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded">Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
