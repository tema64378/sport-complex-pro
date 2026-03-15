import React, { useEffect, useMemo, useState } from 'react';
import { isApiAvailable, fetchMemberships as apiFetchMemberships, createMembership as apiCreateMembership, updateMembership as apiUpdateMembership, deleteMembership as apiDeleteMembership } from '../api';

const seedPlans = [
  { id: 1, name: 'Базовый', price: 1990, period: 'месяц', visits: 8, perks: ['Тренажёрный зал', 'Групповые занятия'] },
  { id: 2, name: 'Стандарт', price: 3490, period: 'месяц', visits: 16, perks: ['Зал + бассейн', 'Группы', '1 консультация тренера'] },
  { id: 3, name: 'Премиум', price: 5990, period: 'месяц', visits: 'Безлимит', perks: ['Все зоны', '2 персональные тренировки', 'Приоритет бронирования'] },
];

function loadPlans() {
  try {
    const raw = localStorage.getItem('membership_plans');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return seedPlans;
}

export default function Memberships() {
  const [plans, setPlans] = useState(loadPlans());
  const [form, setForm] = useState({ name: '', price: '', period: 'месяц', visits: '', perks: '' });
  const [editingId, setEditingId] = useState(null);
  const [useApi, setUseApi] = useState(false);

  useEffect(() => {
    (async () => {
      const ok = await isApiAvailable();
      setUseApi(ok);
      if (ok) {
        try {
          const remote = await apiFetchMemberships();
          setPlans(remote);
          return;
        } catch (e) {}
      }
      setPlans(loadPlans());
    })();
  }, []);

  useEffect(() => {
    if (!useApi) {
      try { localStorage.setItem('membership_plans', JSON.stringify(plans)); } catch (e) {}
    }
  }, [plans, useApi]);

  const stats = useMemo(() => {
    const total = plans.length;
    const avgPrice = total ? Math.round(plans.reduce((s, p) => s + Number(p.price || 0), 0) / total) : 0;
    return { total, avgPrice };
  }, [plans]);

  function resetForm() {
    setForm({ name: '', price: '', period: 'месяц', visits: '', perks: '' });
    setEditingId(null);
  }

  async function savePlan() {
    if (!form.name.trim() || !String(form.price).trim()) return alert('Название и цена обязательны.');
    const payload = {
      id: editingId || Date.now(),
      name: form.name,
      price: Number(form.price),
      period: form.period,
      visits: form.visits || '—',
      perks: form.perks.split(',').map(p => p.trim()).filter(Boolean),
    };
    if (useApi) {
      try {
        if (editingId) {
          const updated = await apiUpdateMembership(editingId, payload);
          setPlans(prev => prev.map(p => p.id === editingId ? updated : p));
        } else {
          const created = await apiCreateMembership(payload);
          setPlans(prev => [created, ...prev]);
        }
        resetForm();
        return;
      } catch (e) {}
    }
    if (editingId) setPlans(prev => prev.map(p => p.id === editingId ? payload : p));
    else setPlans(prev => [payload, ...prev]);
    resetForm();
  }

  function editPlan(plan) {
    setEditingId(plan.id);
    setForm({
      name: plan.name,
      price: plan.price,
      period: plan.period,
      visits: plan.visits,
      perks: (plan.perks || []).join(', '),
    });
  }

  async function removePlan(id) {
    if (!confirm('Удалить тариф?')) return;
    if (useApi) {
      try {
        await apiDeleteMembership(id);
        setPlans(prev => prev.filter(p => p.id !== id));
        return;
      } catch (e) {}
    }
    setPlans(prev => prev.filter(p => p.id !== id));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Абонементы и тарифы</h1>
        <p className="text-gray-600 text-sm mt-2">Управление пакетами и условиями для клиентов</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-4">
          <p className="text-sm text-slate-400">Всего тарифов</p>
          <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-slate-400">Средняя цена</p>
          <p className="text-3xl font-bold text-slate-900">{stats.avgPrice.toLocaleString('ru-RU')} ₽</p>
        </div>
      </div>

      <div className="glass-card p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">{editingId ? 'Редактировать тариф' : 'Создать тариф'}</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input className="px-3 py-2 border rounded bg-white/5 text-slate-200" placeholder="Название" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="px-3 py-2 border rounded bg-white/5 text-slate-200" placeholder="Цена" type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
          <select className="px-3 py-2 border rounded bg-white/5 text-slate-200" value={form.period} onChange={e => setForm({ ...form, period: e.target.value })}>
            <option>месяц</option>
            <option>квартал</option>
            <option>год</option>
          </select>
          <input className="px-3 py-2 border rounded bg-white/5 text-slate-200" placeholder="Лимит посещений" value={form.visits} onChange={e => setForm({ ...form, visits: e.target.value })} />
          <input className="px-3 py-2 border rounded bg-white/5 text-slate-200" placeholder="Преимущества (через запятую)" value={form.perks} onChange={e => setForm({ ...form, perks: e.target.value })} />
        </div>
        <div className="flex gap-2">
          <button onClick={savePlan} className="bg-blue-600 text-white px-4 py-2 rounded">{editingId ? 'Сохранить' : 'Добавить'}</button>
          {editingId && <button onClick={resetForm} className="px-4 py-2 border rounded text-slate-200">Отмена</button>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {plans.map(plan => (
          <div key={plan.id} className="glass-card p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
              <span className="text-sm text-slate-400">{plan.period}</span>
            </div>
            <p className="text-3xl font-bold text-slate-900">{plan.price.toLocaleString('ru-RU')} ₽</p>
            <p className="text-sm text-slate-400">Посещений: {plan.visits}</p>
            <div className="space-y-1 text-sm text-slate-400">
              {(plan.perks || []).map((p, idx) => <div key={idx}>• {p}</div>)}
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => editPlan(plan)} className="px-3 py-2 bg-white/5 text-blue-400 rounded">Править</button>
              <button onClick={() => removePlan(plan.id)} className="px-3 py-2 bg-white/5 text-red-400 rounded">Удалить</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
