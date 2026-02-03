import React, { useEffect, useMemo, useState } from 'react';
import { isApiAvailable, searchAll } from '../api';

function safeLoad(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return fallback;
}

function highlight(text, query) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + query.length);
  const after = text.slice(idx + query.length);
  return (
    <span>
      {before}
      <mark className="bg-yellow-200 text-slate-900 px-1 rounded">{match}</mark>
      {after}
    </span>
  );
}

export default function Search() {
  const [query, setQuery] = useState('');
  const [useApi, setUseApi] = useState(false);
  const [apiResults, setApiResults] = useState({ members: [], trainers: [], classes: [], deals: [], receipts: [] });

  const members = safeLoad('members', [
    { id: 1, name: 'Мария Иванова', email: 'maria.ivanova@mail.ru', membership: 'Премиум' },
    { id: 2, name: 'Сергей Кузнецов', email: 'sergey.kuznetsov@mail.ru', membership: 'Стандарт' },
  ]);
  const trainers = safeLoad('trainers', [
    { id: 1, name: 'Ирина Волкова', specialization: 'Йога' },
    { id: 2, name: 'Максим Орлов', specialization: 'Силовые' },
  ]);
  const classes = safeLoad('classes', [
    { id: 1, name: 'Йога для начинающих', level: 'Базовый' },
    { id: 2, name: 'Кроссфит', level: 'Продвинутый' },
  ]);
  const deals = safeLoad('deals', []);
  const receipts = safeLoad('receipts', []);

  useEffect(() => {
    (async () => {
      const ok = await isApiAvailable();
      setUseApi(ok);
    })();
  }, []);

  useEffect(() => {
    if (!useApi) return;
    if (!query.trim()) {
      setApiResults({ members: [], trainers: [], classes: [], deals: [], receipts: [] });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await searchAll(query);
        if (!cancelled) setApiResults(data);
      } catch (e) {}
    })();
    return () => { cancelled = true; };
  }, [query, useApi]);

  const results = useMemo(() => {
    if (useApi) return apiResults;
    const q = query.trim().toLowerCase();
    if (!q) return { members: [], trainers: [], classes: [], deals: [], receipts: [] };

    const match = (value) => String(value || '').toLowerCase().includes(q);
    return {
      members: members.filter(m => match(m.name) || match(m.email) || match(m.membership)),
      trainers: trainers.filter(t => match(t.name) || match(t.specialization)),
      classes: classes.filter(c => match(c.name) || match(c.level)),
      deals: deals.filter(d => match(d.client) || match(d.offer) || match(d.manager)),
      receipts: receipts.filter(r => match(r.member) || match(r.membership) || match(r.note)),
    };
  }, [query, members, trainers, classes, deals, receipts, apiResults, useApi]);

  const totalCount = Object.values(results).reduce((sum, list) => sum + list.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Быстрый поиск</h1>
        <p className="text-slate-400 text-sm mt-2">Мгновенный поиск по базе клиентов, тренеров, услуг и сделок</p>
      </div>

      <div className="glass-card p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[240px]">
            <i className="fas fa-search absolute left-4 top-3 text-slate-300"></i>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-2 border rounded bg-white/5 text-slate-200"
              placeholder="Введите имя, услугу, email или сделку"
            />
          </div>
          <span className="text-sm text-slate-500">Найдено: {totalCount}</span>
        </div>
      </div>

      {!query && (
        <div className="glass-card p-6 text-sm text-slate-400">
          Начните вводить запрос, чтобы увидеть результаты.
        </div>
      )}

      {query && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Клиенты</h2>
            <div className="space-y-2">
              {results.members.map(member => (
                <div key={member.id} className="p-3 rounded-lg bg-white/5">
                  <p className="font-medium text-slate-900">{highlight(member.name, query)}</p>
                  <p className="text-sm text-slate-500">{highlight(member.email, query)} • {member.membership}</p>
                </div>
              ))}
              {results.members.length === 0 && <p className="text-sm text-slate-400">Совпадений нет.</p>}
            </div>
          </div>

          <div className="glass-card p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Тренеры</h2>
            <div className="space-y-2">
              {results.trainers.map(trainer => (
                <div key={trainer.id} className="p-3 rounded-lg bg-white/5">
                  <p className="font-medium text-slate-900">{highlight(trainer.name, query)}</p>
                  <p className="text-sm text-slate-500">Специализация: {highlight(trainer.specialization, query)}</p>
                </div>
              ))}
              {results.trainers.length === 0 && <p className="text-sm text-slate-400">Совпадений нет.</p>}
            </div>
          </div>

          <div className="glass-card p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Тренировки</h2>
            <div className="space-y-2">
              {results.classes.map(item => (
                <div key={item.id} className="p-3 rounded-lg bg-white/5">
                  <p className="font-medium text-slate-900">{highlight(item.name, query)}</p>
                  <p className="text-sm text-slate-500">Уровень: {highlight(item.level, query)}</p>
                </div>
              ))}
              {results.classes.length === 0 && <p className="text-sm text-slate-400">Совпадений нет.</p>}
            </div>
          </div>

          <div className="glass-card p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Сделки</h2>
            <div className="space-y-2">
              {results.deals.map(deal => (
                <div key={deal.id} className="p-3 rounded-lg bg-white/5">
                  <p className="font-medium text-slate-900">{highlight(deal.client, query)}</p>
                  <p className="text-sm text-slate-500">{highlight(deal.offer, query)} • {deal.stage}</p>
                </div>
              ))}
              {results.deals.length === 0 && <p className="text-sm text-slate-400">Совпадений нет.</p>}
            </div>
          </div>

          <div className="glass-card p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Чеки</h2>
            <div className="space-y-2">
              {results.receipts.map(receipt => (
                <div key={receipt.id} className="p-3 rounded-lg bg-white/5">
                  <p className="font-medium text-slate-900">{highlight(receipt.memberName || receipt.member, query)}</p>
                  <p className="text-sm text-slate-500">Сумма: {Number(receipt.total || 0).toLocaleString('ru-RU')} ₽</p>
                </div>
              ))}
              {results.receipts.length === 0 && <p className="text-sm text-slate-400">Совпадений нет.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
