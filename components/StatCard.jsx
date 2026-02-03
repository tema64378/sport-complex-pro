import React from 'react';

export default function StatCard({ title, value, change, icon, color }) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    pink: 'bg-pink-100 text-pink-600',
    indigo: 'bg-indigo-100 text-indigo-600',
  };

  const isPositive = change && change.startsWith('+');

  return (
    <div className="glass-card p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-600 text-sm font-medium mb-2">{title}</p>
          <p className="text-3xl font-bold text-slate-900">{value}</p>
          {change && (
            <p className={`text-sm font-medium mt-2 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              <i className={`fas fa-arrow-${isPositive ? 'up' : 'down'} mr-1`}></i>
              {change}
            </p>
          )}
        </div>
        <div className={`rounded-xl p-3 flex items-center justify-center`} style={{backgroundColor: 'rgba(99,102,241,0.08)'}}>
          <i className={`${icon} text-2xl text-slate-700`}></i>
        </div>
      </div>
    </div>
  );
}
