import React from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function Analytics() {
  const monthlyMembersData = [
    { month: 'Янв', new: 45, churn: 12, total: 780 },
    { month: 'Фев', new: 52, churn: 8, total: 824 },
    { month: 'Мар', new: 48, churn: 10, total: 862 },
    { month: 'Апр', new: 63, churn: 6, total: 919 },
    { month: 'Май', new: 71, churn: 9, total: 981 },
    { month: 'Июн', new: 55, churn: 5, total: 1031 },
  ];

  const classAttendanceData = [
    { name: 'Йога', attendance: 320, capacity: 400 },
    { name: 'Кроссфит', attendance: 380, capacity: 400 },
    { name: 'Кардио', attendance: 290, capacity: 350 },
    { name: 'Силовые', attendance: 410, capacity: 450 },
    { name: 'Пилатес', attendance: 250, capacity: 300 },
  ];

  const membershipDistribution = [
    { name: 'Премиум', value: 450, color: '#8b5cf6' },
    { name: 'Стандарт', value: 520, color: '#3b82f6' },
    { name: 'Базовый', value: 264, color: '#f59e0b' },
  ];

  const peakHoursData = [
    { hour: '06:00', members: 45 },
    { hour: '07:00', members: 125 },
    { hour: '08:00', members: 230 },
    { hour: '09:00', members: 195 },
    { hour: '17:00', members: 320 },
    { hour: '18:00', members: 410 },
    { hour: '19:00', members: 380 },
    { hour: '20:00', members: 210 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Аналитика</h1>
        <p className="text-slate-400 text-sm mt-2">Подробные инсайты и отчёты</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <p className="text-sm text-slate-400 mb-2">Всего клиентов</p>
          <p className="text-3xl font-bold text-slate-900">1 234</p>
          <p className="text-xs text-green-600 mt-2"><i className="fas fa-arrow-up mr-1"></i>+6.5% этот месяц</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-slate-400 mb-2">Средняя посещаемость</p>
          <p className="text-3xl font-bold text-slate-900">324</p>
          <p className="text-xs text-green-600 mt-2"><i className="fas fa-arrow-up mr-1"></i>+8.2% этот месяц</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-slate-400 mb-2">Активные тренировки</p>
          <p className="text-3xl font-bold text-slate-900">24</p>
          <p className="text-xs text-orange-600 mt-2"><i className="fas fa-equals mr-1"></i>Стабильно</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-slate-400 mb-2">Процент удержания</p>
          <p className="text-3xl font-bold text-slate-900">94.2%</p>
          <p className="text-xs text-green-600 mt-2"><i className="fas fa-arrow-up mr-1"></i>+2.1% этот месяц</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Member Growth */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Рост членства</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyMembersData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
              <Legend />
              <Bar dataKey="new" name="Новые клиенты" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              <Bar dataKey="churn" name="Отток" fill="#ef4444" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Membership Distribution */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Распределение абонементов</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={membershipDistribution}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {membershipDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {membershipDistribution.map((item, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-gray-600">{item.name}</span>
                </div>
                <span className="font-medium text-gray-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Class Attendance */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Посещаемость классов вместимости</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={classAttendanceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip 
              contentStyle={{
                backgroundColor: '#1f2937',
                border: 'none',
                borderRadius: '8px',
                color: '#fff'
              }}
            />
            <Legend />
            <Bar dataKey="attendance" name="Посещаемость" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            <Bar dataKey="capacity" name="Вместимость" fill="#e5e7eb" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Peak Hours */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Пиковые часы посещаемости</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={peakHoursData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="hour" stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip 
              contentStyle={{
                backgroundColor: '#1f2937',
                border: 'none',
                borderRadius: '8px',
                color: '#fff'
              }}
            />
            <Line 
              type="monotone" 
              dataKey="members" 
              stroke="#3b82f6" 
              strokeWidth={2}
              dot={{ fill: '#3b82f6', r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
