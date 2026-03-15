import React, { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { isApiAvailable, fetchForecast } from '../api';

const fallbackHistory = [
  { month: 'Авг', visits: 820, pool: 260, tennis: 140 },
  { month: 'Сен', visits: 870, pool: 300, tennis: 150 },
  { month: 'Окт', visits: 910, pool: 320, tennis: 160 },
  { month: 'Ноя', visits: 980, pool: 340, tennis: 180 },
  { month: 'Дек', visits: 1020, pool: 360, tennis: 200 },
  { month: 'Янв', visits: 1100, pool: 390, tennis: 220 },
];

function calcForecast(history, key) {
  const last = history.slice(-3).map(item => item[key]);
  const avg = last.reduce((sum, v) => sum + v, 0) / last.length;
  return Math.round(avg * 1.06);
}

export default function Forecast() {
  const [history, setHistory] = useState(fallbackHistory);
  const [useApi, setUseApi] = useState(false);

  useEffect(() => {
    (async () => {
      const ok = await isApiAvailable();
      setUseApi(ok);
      if (ok) {
        try {
          const data = await fetchForecast();
          if (data.history?.length) setHistory(data.history);
        } catch (e) {}
      }
    })();
  }, []);

  const forecastData = useMemo(() => {
    const forecastVisits = calcForecast(history, 'visits');
    const forecastPool = calcForecast(history, 'pool');
    const forecastTennis = calcForecast(history, 'tennis');

    return [
      ...history.map(item => ({ ...item, forecast: null })),
      { month: 'Фев', visits: null, pool: null, tennis: null, forecast: forecastVisits, forecastPool, forecastTennis },
      { month: 'Мар', visits: null, pool: null, tennis: null, forecast: Math.round(forecastVisits * 1.04), forecastPool: Math.round(forecastPool * 1.03), forecastTennis: Math.round(forecastTennis * 1.02) },
    ];
  }, [history]);

  const offerPlan = [
    { title: 'Пакет Утро + Бассейн', reason: 'Рост спроса на бассейн в будни', target: 'Клиенты 25-40', discount: '15%', period: 'Февраль' },
    { title: 'Семейный теннис', reason: 'Сезонный рост кортов', target: 'Семьи с детьми', discount: '10%', period: 'Март' },
    { title: 'Фитнес 12 визитов', reason: 'Стабильный спрос на зал', target: 'Новые клиенты', discount: '5%', period: 'Февраль' },
  ];

  const capacityPlan = [
    { area: 'Тренажерный зал', action: 'Увеличить смену тренеров', effect: '+12% пропускной способности' },
    { area: 'Бассейн', action: 'Добавить 2 утренние дорожки', effect: '+8% доступности' },
    { area: 'Теннисные корты', action: 'Перераспределить прайм-тайм', effect: 'Сокращение ожидания до 10 минут' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Прогноз спроса и план предложений</h1>
        <p className="text-slate-400 text-sm mt-2">Модуль прогнозирования помогает планировать ресурсы и акции</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Прогноз посещаемости</h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={forecastData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
              <Legend />
              <Area type="monotone" dataKey="visits" name="Факт" stroke="#3b82f6" fill="#93c5fd" />
              <Area type="monotone" dataKey="forecast" name="Прогноз" stroke="#22c55e" fill="#86efac" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Спрос по услугам</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={forecastData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }} />
              <Legend />
              <Bar dataKey="pool" name="Бассейн" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
              <Bar dataKey="tennis" name="Теннис" fill="#f59e0b" radius={[8, 8, 0, 0]} />
              <Bar dataKey="forecastPool" name="Прогноз бассейн" fill="#7dd3fc" radius={[8, 8, 0, 0]} />
              <Bar dataKey="forecastTennis" name="Прогноз теннис" fill="#fcd34d" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">План предложений</h2>
          <div className="space-y-3">
            {offerPlan.map((offer, idx) => (
              <div key={idx} className="p-4 rounded-lg border border-white/10 bg-white/5">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-900">{offer.title}</h3>
                  <span className="px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">Скидка {offer.discount}</span>
                </div>
                <p className="text-sm text-slate-400 mt-2">Причина: {offer.reason}</p>
                <div className="flex flex-wrap gap-3 text-xs text-slate-500 mt-3">
                  <span>Цель: {offer.target}</span>
                  <span>Период: {offer.period}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">План мощности</h2>
          <div className="space-y-3">
            {capacityPlan.map((item, idx) => (
              <div key={idx} className="p-4 rounded-lg border border-white/10 bg-white/5">
                <p className="text-sm text-slate-400">Зона</p>
                <p className="text-lg font-semibold text-slate-900">{item.area}</p>
                <p className="text-sm text-slate-500 mt-1">Действие: {item.action}</p>
                <p className="text-sm text-blue-600 mt-1">Эффект: {item.effect}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
