import React, { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { fetchAnalytics } from '../api';

const fallback = {
  metrics: {
    totalMembers: 0,
    avgAttendance: 0,
    activeClasses: 0,
    retentionRate: 0,
  },
  monthlyMembers: [
    { month: 'Янв', new: 0, churn: 0, total: 0 },
    { month: 'Фев', new: 0, churn: 0, total: 0 },
    { month: 'Мар', new: 0, churn: 0, total: 0 },
    { month: 'Апр', new: 0, churn: 0, total: 0 },
    { month: 'Май', new: 0, churn: 0, total: 0 },
    { month: 'Июн', new: 0, churn: 0, total: 0 },
  ],
  classAttendance: [],
  membershipDistribution: [],
  peakHours: [],
};

export default function Analytics() {
  const [data, setData] = useState(fallback);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetchAnalytics();
        if (!mounted) return;
        setData({
          metrics: res.metrics || fallback.metrics,
          monthlyMembers: res.monthlyMembers?.length ? res.monthlyMembers : fallback.monthlyMembers,
          classAttendance: res.classAttendance || [],
          membershipDistribution: res.membershipDistribution || [],
          peakHours: res.peakHours || [],
        });
      } catch (e) {}
    })();
    return () => { mounted = false; };
  }, []);

  const membershipDistribution = data.membershipDistribution.length
    ? data.membershipDistribution
    : [
        { name: 'Премиум', value: 0, color: '#16a34a' },
        { name: 'Стандарт', value: 0, color: '#059669' },
        { name: 'Базовый', value: 0, color: '#22c55e' },
      ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Аналитика</h1>
        <p className="text-slate-400 text-sm mt-2">Подробные инсайты и отчёты</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <p className="text-sm text-slate-400 mb-2">Всего клиентов</p>
          <p className="text-3xl font-bold text-slate-900">{data.metrics.totalMembers}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-slate-400 mb-2">Средняя посещаемость</p>
          <p className="text-3xl font-bold text-slate-900">{data.metrics.avgAttendance}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-slate-400 mb-2">Активные тренировки</p>
          <p className="text-3xl font-bold text-slate-900">{data.metrics.activeClasses}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-slate-400 mb-2">Процент удержания</p>
          <p className="text-3xl font-bold text-slate-900">{data.metrics.retentionRate}%</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Рост членства</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.monthlyMembers}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: '8px', color: '#fff' }} />
              <Legend />
              <Bar dataKey="new" name="Новые клиенты" fill="#16a34a" radius={[8, 8, 0, 0]} />
              <Bar dataKey="churn" name="Отток" fill="#ef4444" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Распределение абонементов</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={membershipDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                {membershipDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color || '#16a34a'} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: '8px', color: '#fff' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {membershipDistribution.map((item, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color || '#16a34a' }}></div>
                  <span className="text-gray-600">{item.name}</span>
                </div>
                <span className="font-medium text-gray-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-card p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Посещаемость классов</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.classAttendance}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: '8px', color: '#fff' }} />
            <Legend />
            <Bar dataKey="attendance" name="Посещаемость" fill="#16a34a" radius={[8, 8, 0, 0]} />
            <Bar dataKey="capacity" name="Вместимость" fill="#e5e7eb" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="glass-card p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Пиковые часы посещаемости</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.peakHours}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="hour" stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: '8px', color: '#fff' }} />
            <Line type="monotone" dataKey="members" stroke="#16a34a" strokeWidth={2} dot={{ fill: '#16a34a', r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
