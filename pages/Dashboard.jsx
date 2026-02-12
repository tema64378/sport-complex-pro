import React, { useEffect, useState } from 'react';
import StatCard from '../components/StatCard';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { fetchAnalytics, fetchClasses } from '../api';

const fallback = {
  metrics: {
    totalMembers: 0,
    totalTrainers: 0,
    totalClasses: 0,
    monthRevenue: 0,
  },
  monthlyMembers: [
    { month: 'Янв', new: 0, churn: 0, total: 0 },
    { month: 'Фев', new: 0, churn: 0, total: 0 },
    { month: 'Мар', new: 0, churn: 0, total: 0 },
    { month: 'Апр', new: 0, churn: 0, total: 0 },
    { month: 'Май', new: 0, churn: 0, total: 0 },
    { month: 'Июн', new: 0, churn: 0, total: 0 },
  ],
  revenueByMonth: [],
  classAttendance: [],
};

export default function Dashboard() {
  const [data, setData] = useState(fallback);
  const [classes, setClasses] = useState([]);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetchAnalytics();
        if (!mounted) return;
        setData({
          metrics: res.metrics || fallback.metrics,
          monthlyMembers: res.monthlyMembers?.length ? res.monthlyMembers : fallback.monthlyMembers,
          revenueByMonth: res.revenueByMonth || [],
          classAttendance: res.classAttendance || [],
        });
      } catch (e) {}
    })();
    (async () => {
      try {
        const list = await fetchClasses();
        if (!mounted) return;
        setClasses(list.slice(0, 4));
      } catch (e) {}
    })();
    try {
      const raw = localStorage.getItem('notifications');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!mounted) return;
        setNotifications(parsed.slice(0, 3));
      }
    } catch (e) {}
    return () => { mounted = false; };
  }, []);

  const classDistribution = data.classAttendance.length
    ? data.classAttendance.map((c, idx) => ({
        name: c.name,
        value: c.attendance || 0,
        color: ['#16a34a', '#059669', '#22c55e', '#4ade80', '#15803d'][idx % 5],
      }))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Главная</h1>
          <p className="text-gray-600 text-sm mt-2">Добро пожаловать в интерфейс управления</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Всего клиентов" value={data.metrics.totalMembers.toLocaleString('ru-RU')} change="" icon="fas fa-users" color="green" />
        <StatCard title="Активные тренировки" value={data.metrics.totalClasses.toLocaleString('ru-RU')} change="" icon="fas fa-dumbbell" color="green" />
        <StatCard title="Тренеры" value={data.metrics.totalTrainers.toLocaleString('ru-RU')} change="" icon="fas fa-person" color="green" />
        <StatCard title="Доход за месяц" value={`${data.metrics.monthRevenue.toLocaleString('ru-RU')} ₽`} change="" icon="fas fa-dollar-sign" color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Рост членства</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.monthlyMembers}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: '8px', color: '#fff' }} />
              <Legend />
              <Line type="monotone" dataKey="new" name="Новые" stroke="#16a34a" strokeWidth={2} />
              <Line type="monotone" dataKey="churn" name="Отток" stroke="#ef4444" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Распределение тренировок</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={classDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                {classDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: '8px', color: '#fff' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {classDistribution.map((item, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-gray-600">{item.name}</span>
                </div>
                <span className="font-medium text-gray-900">{item.value}</span>
              </div>
            ))}
            {classDistribution.length === 0 && <p className="text-sm text-slate-400">Нет данных по тренировкам.</p>}
          </div>
        </div>
      </div>

      <div className="glass-card p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Тренд доходов</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.revenueByMonth}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: '8px', color: '#fff' }} />
            <Bar dataKey="revenue" fill="#16a34a" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Ближайшие тренировки</h2>
          <div className="space-y-3">
            {classes.map((cls) => (
              <div key={cls.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{cls.name}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                    <span><i className="fas fa-person mr-1"></i>{cls.trainerName || 'Без тренера'}</span>
                    <span><i className="fas fa-clock mr-1"></i>{cls.schedule || '-'}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-600">{cls.enrolled || 0} участников</p>
                </div>
              </div>
            ))}
            {classes.length === 0 && <p className="text-sm text-slate-400">Тренировок пока нет.</p>}
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Сводка за месяц</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">Доход</p>
                <p className="text-2xl font-bold text-gray-900">{data.metrics.monthRevenue.toLocaleString('ru-RU')} ₽</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">Новых клиентов</p>
                <p className="text-2xl font-bold text-gray-900">{data.metrics.newMembersMonth || 0}</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
              <div>
                <p className="text-sm text-gray-600">Активных абонементов</p>
                <p className="text-2xl font-bold text-gray-900">{data.metrics.activeMembers || 0}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Последние уведомления</h2>
        <div className="space-y-3">
          {notifications.map((n) => (
            <div key={n.id} className="flex items-center justify-between p-3 rounded bg-white/5">
              <div>
                <div className="text-xs text-slate-400">{n.type} • {n.createdAt}</div>
                <div className="text-slate-900 font-medium">{n.title}</div>
              </div>
              <span className={`text-xs px-2 py-1 rounded ${n.read ? 'bg-white/10 text-slate-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {n.read ? 'Прочитано' : 'Новое'}
              </span>
            </div>
          ))}
          {notifications.length === 0 && <p className="text-sm text-slate-400">Уведомлений пока нет.</p>}
        </div>
      </div>
    </div>
  );
}
