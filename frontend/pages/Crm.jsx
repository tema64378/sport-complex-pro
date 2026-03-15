import React, { useEffect, useMemo, useState } from 'react';
import { isApiAvailable, fetchMembers as apiFetchMembers, fetchBookings as apiFetchBookings, fetchPayments as apiFetchPayments, fetchCrmNotes as apiFetchCrmNotes, createCrmNote as apiCreateCrmNote, deleteCrmNote as apiDeleteCrmNote } from '../api';

const seedNotes = [
  { id: 1, memberId: 1, text: 'Предпочитает тренировки утром', createdAt: '2026-02-01' },
  { id: 2, memberId: 2, text: 'Аллергия на латекс — избегать резинок', createdAt: '2026-02-05' },
];

function loadMembers() {
  try {
    const raw = localStorage.getItem('members');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [
    { id: 1, name: 'Мария Иванова', email: 'maria.ivanova@mail.ru', phone: '+7 (910) 111-01-01', membership: 'Премиум', status: 'Активный' },
    { id: 2, name: 'Сергей Кузнецов', email: 'sergey.kuznetsov@mail.ru', phone: '+7 (910) 111-02-02', membership: 'Стандарт', status: 'Активный' },
  ];
}

function loadNotes() {
  try {
    const raw = localStorage.getItem('crm_notes');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return seedNotes;
}

function loadBookings() {
  try {
    const raw = localStorage.getItem('bookings');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

function loadPayments() {
  try {
    const raw = localStorage.getItem('payments');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

export default function Crm() {
  const [members, setMembers] = useState(loadMembers());
  const [notes, setNotes] = useState(loadNotes());
  const [selectedId, setSelectedId] = useState(members[0]?.id || null);
  const [noteText, setNoteText] = useState('');
  const [bookings, setBookings] = useState(loadBookings());
  const [payments, setPayments] = useState(loadPayments());
  const [useApi, setUseApi] = useState(false);

  useEffect(() => {
    (async () => {
      const ok = await isApiAvailable();
      setUseApi(ok);
      if (ok) {
        try {
          const [m, b, p] = await Promise.all([apiFetchMembers(), apiFetchBookings(), apiFetchPayments()]);
          setMembers(m);
          setBookings(b);
          setPayments(p);
          if (m[0]?.id) setSelectedId(m[0].id);
        } catch (e) {}
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!useApi || !selectedId) return;
      try {
        const remote = await apiFetchCrmNotes(selectedId);
        setNotes(remote);
      } catch (e) {}
    })();
  }, [useApi, selectedId]);

  useEffect(() => {
    if (!useApi) {
      try { localStorage.setItem('crm_notes', JSON.stringify(notes)); } catch (e) {}
    }
  }, [notes, useApi]);

  const current = useMemo(() => members.find(m => m.id === selectedId), [members, selectedId]);
  const currentNotes = useMemo(() => notes.filter(n => n.memberId === selectedId), [notes, selectedId]);
  const currentBookings = useMemo(() => bookings.filter(b => b.member === current?.name), [bookings, current]);
  const currentPayments = useMemo(() => payments.filter(p => p.member === current?.name), [payments, current]);

  async function addNote() {
    if (!noteText.trim() || !selectedId) return;
    const item = { id: Date.now(), memberId: selectedId, text: noteText.trim(), createdAt: new Date().toISOString().slice(0, 10) };
    if (useApi) {
      try {
        const saved = await apiCreateCrmNote({ memberId: selectedId, text: noteText.trim() });
        setNotes(prev => [saved, ...prev]);
        setNoteText('');
        return;
      } catch (e) {}
    }
    setNotes(prev => [item, ...prev]);
    setNoteText('');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">CRM профили клиентов</h1>
        <p className="text-gray-600 text-sm mt-2">История, заметки и активность клиента</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card p-5 space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Клиенты</h2>
          <div className="space-y-2">
            {members.map(m => (
              <button
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className={`w-full text-left px-4 py-3 rounded-lg transition ${selectedId === m.id ? 'bg-white/10' : 'hover:bg-white/5'}`}
              >
                <div className="text-slate-900 font-semibold">{m.name}</div>
                <div className="text-xs text-slate-400">{m.membership} • {m.status}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="glass-card p-5 lg:col-span-2 space-y-4">
          {!current && <p className="text-slate-400">Выберите клиента.</p>}
          {current && (
            <>
              <div>
                <h2 className="text-xl font-bold text-slate-900">{current.name}</h2>
                <p className="text-sm text-slate-400 mt-1">{current.email} • {current.phone}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-card p-4">
                  <p className="text-sm text-slate-400">Абонемент</p>
                  <p className="text-lg font-semibold text-slate-900">{current.membership}</p>
                </div>
                <div className="glass-card p-4">
                  <p className="text-sm text-slate-400">Статус</p>
                  <p className="text-lg font-semibold text-slate-900">{current.status}</p>
                </div>
              </div>

              <div className="glass-card p-4 space-y-3">
                <h3 className="text-lg font-semibold text-slate-900">Заметки тренера</h3>
                <div className="flex gap-2">
                  <input className="flex-1 px-3 py-2 border rounded bg-white/5 text-slate-200" placeholder="Добавить заметку" value={noteText} onChange={e => setNoteText(e.target.value)} />
                  <button onClick={addNote} className="bg-blue-600 text-white px-4 py-2 rounded">Добавить</button>
                </div>
                <div className="space-y-2">
                  {currentNotes.map(n => (
                    <div key={n.id} className="p-3 rounded bg-white/5">
                      <div className="text-xs text-slate-400">{n.createdAt}</div>
                      <div className="text-slate-200">{n.text}</div>
                    </div>
                  ))}
                  {currentNotes.length === 0 && <p className="text-sm text-slate-400">Заметок нет.</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass-card p-4">
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">История посещений</h3>
                  <div className="space-y-2">
                    {currentBookings.map(b => (
                      <div key={b.id} className="text-sm text-slate-400">
                        {b.date} • {b.className || b.class} • {b.status}
                      </div>
                    ))}
                    {currentBookings.length === 0 && <p className="text-sm text-slate-400">Посещений нет.</p>}
                  </div>
                </div>
                <div className="glass-card p-4">
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">История платежей</h3>
                  <div className="space-y-2">
                    {currentPayments.map(p => (
                      <div key={p.id} className="text-sm text-slate-400">
                        {p.date} • {p.amount} ₽ • {p.status}
                      </div>
                    ))}
                    {currentPayments.length === 0 && <p className="text-sm text-slate-400">Платежей нет.</p>}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
