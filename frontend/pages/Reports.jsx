import React, { useState, useEffect } from 'react';
import { fetchMembersReport, fetchPaymentsReport, fetchBookingsReport, fetchSummary, downloadCsvReport } from '../api';

export default function Reports() {
  const [activeTab, setActiveTab] = useState('summary');
  const [summary, setSummary] = useState(null);
  const [members, setMembers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [serviceReport, setServiceReport] = useState([]);
  const [retentionReport, setRetentionReport] = useState([]);

  const [memberFilters, setMemberFilters] = useState({ membership: '', status: '' });
  const [paymentFilters, setPaymentFilters] = useState({ status: '' });
  const [bookingFilters, setBookingFilters] = useState({ status: '' });

  useEffect(() => {
    loadSummary();
    loadServiceReport();
    loadRetentionReport();
  }, []);

  async function loadSummary() {
    try {
      const data = await fetchSummary();
      setSummary(data.summary);
    } catch (e) {
      console.error('Failed to load summary:', e);
    }
  }

  async function loadMembersReport() {
    setLoading(true);
    try {
      const data = await fetchMembersReport(memberFilters);
      setMembers(data.data);
    } catch (e) {
      console.error('Failed to load members report:', e);
    }
    setLoading(false);
  }

  async function loadPaymentsReport() {
    setLoading(true);
    try {
      const data = await fetchPaymentsReport(paymentFilters);
      setPayments(data.data);
    } catch (e) {
      console.error('Failed to load payments report:', e);
    }
    setLoading(false);
  }

  async function loadBookingsReport() {
    setLoading(true);
    try {
      const data = await fetchBookingsReport(bookingFilters);
      setBookings(data.data);
    } catch (e) {
      console.error('Failed to load bookings report:', e);
    }
    setLoading(false);
  }

  const handleDownload = (type) => {
    const filters = type === 'members' ? memberFilters : type === 'payments' ? paymentFilters : bookingFilters;
    downloadCsvReport(type, filters);
  };

  function loadServiceReport() {
    try {
      const raw = localStorage.getItem('receipts');
      const receipts = raw ? JSON.parse(raw) : [];
      const totals = {};
      receipts.forEach(r => {
        (r.items || []).forEach(item => {
          totals[item.name] = (totals[item.name] || 0) + (item.price * item.qty);
        });
      });
      const rows = Object.entries(totals)
        .map(([name, revenue]) => ({ name, revenue }))
        .sort((a, b) => b.revenue - a.revenue);
      setServiceReport(rows);
    } catch (e) {
      setServiceReport([]);
    }
  }

  function loadRetentionReport() {
    try {
      const raw = localStorage.getItem('members');
      const members = raw ? JSON.parse(raw) : [];
      const total = members.length;
      const active = members.filter(m => m.status === 'Активный').length;
      const inactive = total - active;
      const rate = total ? Math.round((active / total) * 100) : 0;
      setRetentionReport([
        { label: 'Всего клиентов', value: total },
        { label: 'Активные', value: active },
        { label: 'Неактивные', value: inactive },
        { label: 'Удержание', value: `${rate}%` },
      ]);
    } catch (e) {
      setRetentionReport([]);
    }
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold">Отчеты и Аналитика</h1><p className="text-gray-600">Просмотр, фильтрация и скачивание отчетов из базы данных</p></div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {['summary', 'members', 'payments', 'bookings', 'services', 'retention'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 font-medium border-b-2 transition ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
            {tab === 'summary' ? 'Сводка' : tab === 'members' ? 'Клиенты' : tab === 'payments' ? 'Платежи' : tab === 'bookings' ? 'Бронирования' : tab === 'services' ? 'Услуги' : 'Удержание'}
          </button>
        ))}
      </div>

      {/* Summary Tab */}
      {activeTab === 'summary' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="glass-card p-6"><p className="text-slate-400 text-sm">Всего клиентов</p><p className="text-3xl font-bold text-slate-900 mt-2">{summary?.totalMembers || 0}</p></div>
          <div className="glass-card p-6"><p className="text-slate-400 text-sm">Тренеров</p><p className="text-3xl font-bold text-slate-900 mt-2">{summary?.totalTrainers || 0}</p></div>
          <div className="glass-card p-6"><p className="text-slate-400 text-sm">Классов</p><p className="text-3xl font-bold text-slate-900 mt-2">{summary?.totalClasses || 0}</p></div>
          <div className="glass-card p-6"><p className="text-slate-400 text-sm">Всего выручка</p><p className="text-3xl font-bold text-green-600 mt-2">₽{(summary?.totalRevenue || 0).toLocaleString('ru-RU')}</p></div>
          <div className="glass-card p-6"><p className="text-slate-400 text-sm">Подтвержденных</p><p className="text-3xl font-bold text-blue-600 mt-2">{summary?.confirmedBookings || 0}</p></div>
        </div>
      )}

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select value={memberFilters.membership} onChange={e => setMemberFilters({...memberFilters, membership: e.target.value})} className="px-3 py-2 border rounded bg-white/5 text-slate-200"><option value="">Все абонементы</option><option value="Премиум">Премиум</option><option value="Стандарт">Стандарт</option><option value="Базовый">Базовый</option></select>
            <select value={memberFilters.status} onChange={e => setMemberFilters({...memberFilters, status: e.target.value})} className="px-3 py-2 border rounded bg-white/5 text-slate-200"><option value="">Все статусы</option><option value="Активный">Активный</option><option value="Неактивный">Неактивный</option></select>
            <div className="flex gap-2"><button onClick={loadMembersReport} className="flex-1 bg-blue-600 text-white py-2 rounded">Применить</button><button onClick={() => handleDownload('members')} className="px-4 bg-green-600 text-white rounded">CSV</button></div>
          </div>
          <div className="glass-card overflow-hidden">
            <table className="w-full"><thead className="bg-white/5"><tr><th className="p-3 text-left">Имя</th><th className="p-3 text-left">Email</th><th className="p-3 text-left">Абонемент</th><th className="p-3 text-left">Статус</th><th className="p-3 text-left">Дата регистрации</th></tr></thead><tbody>{members.map(m => (<tr key={m.id} className="border-t hover:bg-white/5"><td className="p-3">{m.name}</td><td className="p-3">{m.email}</td><td className="p-3">{m.membership}</td><td className="p-3">{m.status}</td><td className="p-3">{m.joinDate}</td></tr>))}</tbody></table>
            {members.length === 0 && <div className="p-4 text-center text-slate-400">Данные не загружены. Примените фильтры.</div>}
          </div>
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select value={paymentFilters.status} onChange={e => setPaymentFilters({...paymentFilters, status: e.target.value})} className="px-3 py-2 border rounded bg-white/5 text-slate-200"><option value="">Все статусы</option><option value="Оплачен">Оплачен</option><option value="Не оплачен">Не оплачен</option></select>
            <div className="flex gap-2"><button onClick={loadPaymentsReport} className="flex-1 bg-blue-600 text-white py-2 rounded">Применить</button><button onClick={() => handleDownload('payments')} className="px-4 bg-green-600 text-white rounded">CSV</button></div>
          </div>
          <div className="glass-card overflow-hidden">
            <table className="w-full"><thead className="bg-white/5"><tr><th className="p-3 text-left">Клиент</th><th className="p-3 text-left">Сумма</th><th className="p-3 text-left">Метод</th><th className="p-3 text-left">Дата</th><th className="p-3 text-left">Статус</th></tr></thead><tbody>{payments.map(p => (<tr key={p.id} className="border-t hover:bg-white/5"><td className="p-3">{p.member}</td><td className="p-3">₽{p.amount.toLocaleString('ru-RU')}</td><td className="p-3">{p.method}</td><td className="p-3">{p.date}</td><td className="p-3">{p.status}</td></tr>))}</tbody></table>
            {payments.length === 0 && <div className="p-4 text-center text-slate-400">Данные не загружены. Примените фильтры.</div>}
          </div>
        </div>
      )}

      {/* Bookings Tab */}
      {activeTab === 'bookings' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select value={bookingFilters.status} onChange={e => setBookingFilters({...bookingFilters, status: e.target.value})} className="px-3 py-2 border rounded bg-white/5 text-slate-200"><option value="">Все статусы</option><option value="Подтверждено">Подтверждено</option><option value="Ожидание">Ожидание</option><option value="Отменено">Отменено</option></select>
            <div className="flex gap-2"><button onClick={loadBookingsReport} className="flex-1 bg-blue-600 text-white py-2 rounded">Применить</button><button onClick={() => handleDownload('bookings')} className="px-4 bg-green-600 text-white rounded">CSV</button></div>
          </div>
          <div className="glass-card overflow-hidden">
            <table className="w-full"><thead className="bg-white/5"><tr><th className="p-3 text-left">Клиент</th><th className="p-3 text-left">Тренировка</th><th className="p-3 text-left">Дата</th><th className="p-3 text-left">Время</th><th className="p-3 text-left">Статус</th></tr></thead><tbody>{bookings.map(b => (<tr key={b.id} className="border-t hover:bg-white/5"><td className="p-3">{b.member}</td><td className="p-3">{b.className}</td><td className="p-3">{b.date}</td><td className="p-3">{b.time}</td><td className="p-3">{b.status}</td></tr>))}</tbody></table>
            {bookings.length === 0 && <div className="p-4 text-center text-slate-400">Данные не загружены. Примените фильтры.</div>}
          </div>
        </div>
      )}

      {activeTab === 'services' && (
        <div className="space-y-4">
          <div className="glass-card overflow-hidden">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="p-3 text-left">Услуга</th>
                  <th className="p-3 text-left">Выручка</th>
                </tr>
              </thead>
              <tbody>
                {serviceReport.map((s, idx) => (
                  <tr key={idx} className="border-t hover:bg-white/5">
                    <td className="p-3">{s.name}</td>
                    <td className="p-3">₽{Number(s.revenue || 0).toLocaleString('ru-RU')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {serviceReport.length === 0 && <div className="p-4 text-center text-slate-400">Нет данных по услугам.</div>}
          </div>
        </div>
      )}

      {activeTab === 'retention' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {retentionReport.map((r, idx) => (
            <div key={idx} className="glass-card p-6">
              <p className="text-slate-400 text-sm">{r.label}</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">{r.value}</p>
            </div>
          ))}
          {retentionReport.length === 0 && <div className="glass-card p-6 text-slate-400">Нет данных.</div>}
        </div>
      )}
    </div>
  );
}
