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
    <div className="glass-card p-6 transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-slate-600 text-xs uppercase tracking-widest mb-2">{title}</p>
          <p className="text-3xl font-semibold text-slate-900">{value}</p>
          {change && (
            <p className={`text-xs font-medium mt-2 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {change}
            </p>
          )}
        </div>
        <div className="text-slate-500">
          <i className={`${icon} text-xl`}></i>
        </div>
      </div>
    </div>
  );
}
