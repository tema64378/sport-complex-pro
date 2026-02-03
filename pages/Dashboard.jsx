import React from 'react';
import StatCard from '../components/StatCard';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function Dashboard() {
  const membershipData = [
    { month: 'Jan', premium: 120, standard: 240, basic: 140 },
    { month: 'Feb', premium: 135, standard: 260, basic: 155 },
    { month: 'Mar', premium: 150, standard: 280, basic: 170 },
    { month: 'Apr', premium: 165, standard: 300, basic: 190 },
    { month: 'May', premium: 180, standard: 320, basic: 205 },
    { month: 'Jun', premium: 200, standard: 340, basic: 220 },
  ];

  const revenueData = [
    { month: 'Jan', revenue: 45000 },
    { month: 'Feb', revenue: 52000 },
    { month: 'Mar', revenue: 61000 },
    { month: 'Apr', revenue: 78000 },
    { month: 'May', revenue: 95000 },
    { month: 'Jun', revenue: 115000 },
  ];

  const classTypeData = [
    { name: 'Yoga', value: 25, color: '#3b82f6' },
    { name: 'CrossFit', value: 35, color: '#8b5cf6' },
    { name: 'Cardio', value: 20, color: '#ec4899' },
    { name: 'Strength', value: 20, color: '#f59e0b' },
  ];

  const upcomingClasses = [
    { id: 1, name: 'Yoga Basics', trainer: 'Sarah Smith', time: '09:00', members: 12 },
    { id: 2, name: 'CrossFit WOD', trainer: 'John Doe', time: '10:00', members: 15 },
    { id: 3, name: 'Cardio Blast', trainer: 'Emma Wilson', time: '11:00', members: 8 },
    { id: 4, name: 'Strength Training', trainer: 'Mike Johnson', time: '14:00', members: 10 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Главная</h1>
          <p className="text-gray-600 text-sm mt-2">Добро пожаловать в интерфейс управления</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors font-medium">
          <i className="fas fa-download mr-2"></i>
          Скачать отчёт
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Всего клиентов" 
          value="1 234" 
          change="+12.5%" 
          icon="fas fa-users"
          color="blue"
        />
        <StatCard 
          title="Активные тренировки" 
          value="24" 
          change="+8.2%" 
          icon="fas fa-dumbbell"
          color="green"
        />
        <StatCard 
          title="Сертифицированные тренеры" 
          value="18" 
          change="+5.1%" 
          icon="fas fa-person"
          color="purple"
        />
        <StatCard 
          title="Ежемесячный доход" 
          value="115 000 ₽" 
          change="+21.3%" 
          icon="fas fa-dollar-sign"
          color="yellow"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Membership Growth */}
        <div className="lg:col-span-2 glass-card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Рост членства</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={membershipData}>
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
              <Line type="monotone" dataKey="premium" stroke="#3b82f6" strokeWidth={2} />
              <Line type="monotone" dataKey="standard" stroke="#8b5cf6" strokeWidth={2} />
              <Line type="monotone" dataKey="basic" stroke="#ec4899" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Class Distribution */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Распределение тренировок</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={classTypeData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {classTypeData.map((entry, index) => (
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
            {classTypeData.map((item, index) => (
              <div key={index} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-gray-600">{item.name}</span>
                </div>
                <span className="font-medium text-gray-900">{item.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Тренд доходов</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={revenueData}>
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
            <Bar dataKey="revenue" fill="#3b82f6" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Upcoming Classes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Тренировки сегодня</h2>
          <div className="space-y-3">
            {upcomingClasses.map((cls) => (
              <div key={cls.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{cls.name}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                    <span><i className="fas fa-person mr-1"></i>{cls.trainer}</span>
                    <span><i className="fas fa-clock mr-1"></i>{cls.time.replace(' AM', '').replace(' PM', '')}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-600">{cls.members} участников</p>
                  <button className="mt-1 text-blue-600 hover:text-blue-700 text-sm font-medium">
                    Подробнее
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Быстрая статистика</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-500 text-white rounded-lg flex items-center justify-center">
                  <i className="fas fa-user-check"></i>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Регистраций сегодня</p>
                  <p className="text-2xl font-bold text-gray-900">142</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-500 text-white rounded-lg flex items-center justify-center">
                  <i className="fas fa-credit-card"></i>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Доход сегодня</p>
                  <p className="text-2xl font-bold text-gray-900">3 840 ₽</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-500 text-white rounded-lg flex items-center justify-center">
                  <i className="fas fa-exclamation-circle"></i>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Истекает скоро</p>
                  <p className="text-2xl font-bold text-gray-900">8 клиентов</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
