import React, { useEffect, useMemo, useState } from 'react';
import { isApiAvailable, fetchDeals, createDeal, updateDeal, deleteDeal } from '../api';

const DEFAULT_DEALS = [
  { id: 1, client: 'Мария Иванова', offer: 'Премиум абонемент 6 мес', value: 32000, stage: 'Переговоры', probability: 60, manager: 'Ирина', nextStep: 'Согласовать скидку', date: '2026-02-01' },
  { id: 2, client: 'ООО Альфа', offer: 'Корпоративные тренировки', value: 120000, stage: 'Предложение', probability: 45, manager: 'Антон', nextStep: 'Отправить договор', date: '2026-01-28' },
  { id: 3, client: 'Сергей Кузнецов', offer: 'Персональные тренировки (10)', value: 16000, stage: 'Закрыто', probability: 100, manager: 'Мария', nextStep: 'Оплата получена', date: '2026-01-24' },
];

function loadDeals() {
  try {
    const raw = localStorage.getItem('deals');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return DEFAULT_DEALS;
}

function saveDeals(deals) {
  try { localStorage.setItem('deals', JSON.stringify(deals)); } catch (e) {}
}

export default function Deals() {
  const [deals, setDeals] = useState([]);
  const [query, setQuery] = useState('');
  const [filterStage, setFilterStage] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ client: '', offer: '', value: '', stage: 'Лид', probability: 25, manager: '', nextStep: '', date: '' });
  const [useApi, setUseApi] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const ok = await isApiAvailable();
      if (!mounted) return;
      setUseApi(ok);
      if (ok) {
        try {
          const data = await fetchDeals();
          if (!mounted) return;
          setDeals(data);
          return;
        } catch (e) {}
      }
      setDeals(loadDeals());
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => { if (!useApi) saveDeals(deals); }, [deals, useApi]);

  const filteredDeals = useMemo(() => {
    const q = query.toLowerCase();
    return deals.filter(d => {
      const matchesQuery = d.client.toLowerCase().includes(q) || d.offer.toLowerCase().includes(q) || d.manager.toLowerCase().includes(q);
      const matchesStage = filterStage === 'all' || d.stage === filterStage;
      return matchesQuery && matchesStage;
    });
  }, [deals, query, filterStage]);

  const pipelineValue = deals.reduce((sum, d) => sum + Number(d.value || 0), 0);
  const weightedForecast = deals.reduce((sum, d) => sum + Number(d.value || 0) * (Number(d.probability || 0) / 100), 0);

  function openAdd() {
    setEditingId(null);
    setForm({ client: '', offer: '', value: '', stage: 'Лид', probability: 25, manager: '', nextStep: '', date: new Date().toISOString().slice(0, 10) });
    setIsModalOpen(true);
  }

  function openEdit(deal) {
    setEditingId(deal.id);
    setForm({ client: deal.client, offer: deal.offer, value: deal.value, stage: deal.stage, probability: deal.probability, manager: deal.manager, nextStep: deal.nextStep, date: deal.date });
    setIsModalOpen(true);
  }

  async function saveDeal() {
    if (!form.client.trim() || !form.offer.trim()) {
      alert('Укажите клиента и предложение.');
      return;
    }
    const payload = { ...form, value: Number(form.value), probability: Number(form.probability) };
    if (useApi) {
      try {
        if (editingId) {
          const updated = await updateDeal(editingId, payload);
          setDeals(prev => prev.map(d => d.id === editingId ? updated : d));
        } else {
          const created = await createDeal(payload);
          setDeals(prev => [created, ...prev]);
        }
        setIsModalOpen(false);
        return;
      } catch (e) {}
    }
    if (editingId) setDeals(prev => prev.map(d => d.id === editingId ? { ...d, ...payload } : d));
    else setDeals(prev => [{ id: Date.now(), ...payload }, ...prev]);
    setIsModalOpen(false);
  }

  async function removeDeal(id) {
    if (!confirm('Удалить сделку?')) return;
    if (useApi) {
      try { await deleteDeal(id); setDeals(prev => prev.filter(d => d.id !== id)); return; } catch (e) {}
    }
    setDeals(prev => prev.filter(d => d.id !== id));
  }

  const stageColors = {
    'Лид': 'bg-slate-100 text-slate-700',
    'Предложение': 'bg-blue-100 text-blue-800',
    'Переговоры': 'bg-yellow-100 text-yellow-800',
    'Закрыто': 'bg-green-100 text-green-800',
    'Потеряно': 'bg-red-100 text-red-800',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Сделки</h1>
          <p className="text-slate-400 text-sm">Планирование продаж и контроль статусов</p>
        </div>
        <button onClick={openAdd} className="bg-blue-600 text-white px-6 py-2 rounded-lg">Новая сделка</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <p className="text-sm text-slate-400">Общий объем</p>
          <p className="text-2xl font-bold text-slate-900">{pipelineValue.toLocaleString('ru-RU')} ₽</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-slate-400">Прогнозируемая выручка</p>
          <p className="text-2xl font-bold text-blue-600">{weightedForecast.toLocaleString('ru-RU')} ₽</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-slate-400">Активные сделки</p>
          <p className="text-2xl font-bold text-slate-900">{deals.filter(d => d.stage !== 'Закрыто' && d.stage !== 'Потеряно').length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <i className="fas fa-search absolute left-4 top-3 text-slate-300"></i>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-2 border rounded bg-white/5 text-slate-200"
            placeholder="Поиск по клиентам и предложениям"
          />
        </div>
        <select value={filterStage} onChange={e => setFilterStage(e.target.value)} className="px-4 py-2 border rounded bg-white/5 text-slate-200">
          <option value="all">Все стадии</option>
          <option>Лид</option>
          <option>Предложение</option>
          <option>Переговоры</option>
          <option>Закрыто</option>
          <option>Потеряно</option>
        </select>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full">
          <thead className="bg-white/5">
            <tr>
              <th className="p-3 text-left">Клиент</th>
              <th className="p-3 text-left">Предложение</th>
              <th className="p-3 text-left">Стадия</th>
              <th className="p-3 text-left">Вероятность</th>
              <th className="p-3 text-left">Сумма</th>
              <th className="p-3 text-left">Ответственный</th>
              <th className="p-3 text-left">Следующий шаг</th>
              <th className="p-3 text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredDeals.map(deal => (
              <tr key={deal.id} className="hover:bg-white/5">
                <td className="p-3 font-medium text-slate-900">{deal.client}</td>
                <td className="p-3 text-slate-600">{deal.offer}</td>
                <td className="p-3"><span className={`px-3 py-1 rounded-full text-sm ${stageColors[deal.stage]}`}>{deal.stage}</span></td>
                <td className="p-3 text-slate-600">{deal.probability}%</td>
                <td className="p-3 text-slate-600">{Number(deal.value).toLocaleString('ru-RU')} ₽</td>
                <td className="p-3 text-slate-600">{deal.manager}</td>
                <td className="p-3 text-slate-600">{deal.nextStep}</td>
                <td className="p-3 text-right">
                  <button onClick={() => openEdit(deal)} className="text-blue-400 mr-2">Править</button>
                  <button onClick={() => removeDeal(deal.id)} className="text-red-400">Удалить</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="glass-card p-6 w-full max-w-lg">
            <h3 className="text-lg font-bold mb-4">{editingId ? 'Редактировать сделку' : 'Новая сделка'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input className="px-3 py-2 border rounded bg-white/5 text-slate-200" placeholder="Клиент" value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} />
              <input className="px-3 py-2 border rounded bg-white/5 text-slate-200" placeholder="Предложение" value={form.offer} onChange={e => setForm({ ...form, offer: e.target.value })} />
              <input type="number" className="px-3 py-2 border rounded bg-white/5 text-slate-200" placeholder="Сумма" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} />
              <select className="px-3 py-2 border rounded bg-white/5 text-slate-200" value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })}>
                <option>Лид</option>
                <option>Предложение</option>
                <option>Переговоры</option>
                <option>Закрыто</option>
                <option>Потеряно</option>
              </select>
              <input type="number" className="px-3 py-2 border rounded bg-white/5 text-slate-200" placeholder="Вероятность" value={form.probability} onChange={e => setForm({ ...form, probability: e.target.value })} />
              <input className="px-3 py-2 border rounded bg-white/5 text-slate-200" placeholder="Ответственный" value={form.manager} onChange={e => setForm({ ...form, manager: e.target.value })} />
              <input className="px-3 py-2 border rounded bg-white/5 text-slate-200" placeholder="Следующий шаг" value={form.nextStep} onChange={e => setForm({ ...form, nextStep: e.target.value })} />
              <input type="date" className="px-3 py-2 border rounded bg-white/5 text-slate-200" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded text-slate-200">Отмена</button>
              <button onClick={saveDeal} className="px-4 py-2 bg-blue-600 text-white rounded">Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
