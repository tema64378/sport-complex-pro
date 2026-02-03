import React, { useState, useEffect } from 'react';
import { isApiAvailable, fetchMembers as apiFetchMembers, createMember as apiCreateMember, updateMember as apiUpdateMember, deleteMember as apiDeleteMember } from '../api';

export default function Members() {
  const [members, setMembers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMembership, setFilterMembership] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', membership: 'Премиум', joinDate: '', status: 'Активный' });
  const [useApi, setUseApi] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const ok = await isApiAvailable();
      if (!mounted) return;
      setUseApi(ok);
      if (ok) {
        try {
          const remote = await apiFetchMembers();
          if (!mounted) return;
          setMembers(remote);
          return;
        } catch (e) {}
      }
      const saved = localStorage.getItem('members');
      if (saved) {
        try { setMembers(JSON.parse(saved)); } catch (e) {}
      } else {
        const init = [
          { id: 1, name: 'Мария Иванова', email: 'maria.ivanova@mail.ru', phone: '+7 (910) 111-01-01', membership: 'Премиум', joinDate: '2023-01-15', status: 'Активный' },
          { id: 2, name: 'Сергей Кузнецов', email: 'sergey.kuznetsov@mail.ru', phone: '+7 (910) 111-02-02', membership: 'Стандарт', joinDate: '2023-02-20', status: 'Активный' },
        ];
        setMembers(init);
        localStorage.setItem('members', JSON.stringify(init));
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!useApi) localStorage.setItem('members', JSON.stringify(members));
  }, [members, useApi]);

  const filteredMembers = members.filter(member => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = member.name.toLowerCase().includes(q) || member.email.toLowerCase().includes(q);
    const matchesMembership = filterMembership === 'all' || member.membership === filterMembership;
    return matchesSearch && matchesMembership;
  });

  const membershipColors = { 'Премиум': 'bg-purple-100 text-purple-800', 'Стандарт': 'bg-blue-100 text-blue-800', 'Базовый': 'bg-gray-100 text-gray-800' };
  const statusColors = { 'Активный': 'bg-green-100 text-green-800', 'Неактивный': 'bg-red-100 text-red-800' };

  function openAdd() { setEditingMember(null); setForm({ name: '', email: '', phone: '', membership: 'Премиум', joinDate: new Date().toISOString().slice(0,10), status: 'Активный' }); setIsModalOpen(true); }
  function openEdit(m) { setEditingMember(m.id); setForm({ name: m.name, email: m.email, phone: m.phone, membership: m.membership, joinDate: m.joinDate, status: m.status }); setIsModalOpen(true); }

  async function saveMember() {
    if (!form.name.trim() || !form.email.trim()) return alert('Введите имя и email');
    if (useApi) {
      try {
        if (editingMember) { const u = await apiUpdateMember(editingMember, form); setMembers(p => p.map(m => m.id === editingMember ? u : m)); }
        else { const c = await apiCreateMember(form); setMembers(p => [c, ...p]); }
        setIsModalOpen(false);
      } catch (e) { if (editingMember) setMembers(p => p.map(m => m.id === editingMember ? {...m, ...form} : m)); else setMembers(p => [{id: Date.now(), ...form}, ...p]); setIsModalOpen(false); }
    } else {
      if (editingMember) setMembers(p => p.map(m => m.id === editingMember ? {...m, ...form} : m));
      else setMembers(p => [{id: Date.now(), ...form}, ...p]);
      setIsModalOpen(false);
    }
  }

  async function deleteMember(id) {
    if (!confirm('Удалить клиента?')) return;
    if (useApi) { try { await apiDeleteMember(id); setMembers(p => p.filter(m => m.id !== id)); } catch (e) { setMembers(p => p.filter(m => m.id !== id)); } }
    else setMembers(p => p.filter(m => m.id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold">Клиенты</h1><p className="text-gray-600 text-sm">Всего: {members.length}</p></div>
        <button onClick={openAdd} className="bg-blue-600 text-white px-6 py-2 rounded"><i className="fas fa-plus mr-2"></i>Добавить клиента</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative"><i className="fas fa-search absolute left-4 top-3 text-slate-300"></i><input type="text" placeholder="Поиск..." className="w-full pl-12 pr-4 py-2 border rounded bg-white/5 text-slate-200" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
        <select value={filterMembership} onChange={e => setFilterMembership(e.target.value)} className="px-4 py-2 border rounded bg-white/5 text-slate-200"><option value="all">Все абонементы</option><option value="Премиум">Премиум</option><option value="Стандарт">Стандарт</option><option value="Базовый">Базовый</option></select>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead className="bg-white/5"><tr><th className="px-6 py-3 text-left">Имя</th><th className="px-6 py-3 text-left">Email</th><th className="px-6 py-3 text-left">Телефон</th><th className="px-6 py-3 text-left">Абонемент</th><th className="px-6 py-3 text-left">Дата</th><th className="px-6 py-3 text-left">Статус</th><th className="px-6 py-3 text-right">Действия</th></tr></thead>
          <tbody className="divide-y">
            {filteredMembers.map(m => (
              <tr key={m.id} className="hover:bg-white/5"><td className="px-6 py-3">{m.name}</td><td className="px-6 py-3">{m.email}</td><td className="px-6 py-3">{m.phone}</td><td className="px-6 py-3"><span className={`px-3 py-1 rounded text-sm ${membershipColors[m.membership]}`}>{m.membership}</span></td><td className="px-6 py-3">{m.joinDate}</td><td className="px-6 py-3"><span className={`px-3 py-1 rounded text-sm ${statusColors[m.status]}`}>{m.status}</span></td><td className="px-6 py-3 text-right"><button onClick={() => openEdit(m)} className="text-blue-400 mr-2">Править</button><button onClick={() => deleteMember(m.id)} className="text-red-400">Удалить</button></td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="glass-card p-6 max-w-md w-full"><h3 className="text-lg font-bold mb-4">{editingMember ? 'Редактировать' : 'Добавить'}</h3>
            <div className="grid gap-3"><input className="px-3 py-2 border rounded bg-white/5 text-slate-200" placeholder="Имя" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /><input className="px-3 py-2 border rounded bg-white/5 text-slate-200" placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /><input className="px-3 py-2 border rounded bg-white/5 text-slate-200" placeholder="Телефон" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /><select className="px-3 py-2 border rounded bg-white/5 text-slate-200" value={form.membership} onChange={e => setForm({...form, membership: e.target.value})}><option>Премиум</option><option>Стандарт</option><option>Базовый</option></select><input className="px-3 py-2 border rounded bg-white/5 text-slate-200" type="date" value={form.joinDate} onChange={e => setForm({...form, joinDate: e.target.value})} /><select className="px-3 py-2 border rounded bg-white/5 text-slate-200" value={form.status} onChange={e => setForm({...form, status: e.target.value})}><option>Активный</option><option>Неактивный</option></select></div>
            <div className="mt-4 flex justify-end gap-2"><button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded text-slate-200">Отмена</button><button onClick={saveMember} className="px-4 py-2 bg-blue-600 text-white rounded">Сохранить</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
