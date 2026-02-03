import React, { useEffect, useState } from 'react';
import { fetchBookings, fetchPayments, fetchReceipts, fetchMembers, isApiAvailable } from '../api';

export default function Client() {
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [member, setMember] = useState(null);
  const [useApi, setUseApi] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const ok = await isApiAvailable();
      if (!mounted) return;
      setUseApi(ok);
      if (ok) {
        try {
          const [b, p, r, m] = await Promise.all([
            fetchBookings(),
            fetchPayments(),
            fetchReceipts(),
            fetchMembers(),
          ]);
          if (!mounted) return;
          setBookings(b);
          setPayments(p);
          setReceipts(r);
          setMember(m[0] || null);
          return;
        } catch (e) {}
      }
      const localBookings = JSON.parse(localStorage.getItem('bookings') || '[]');
      const localPayments = JSON.parse(localStorage.getItem('payments') || '[]');
      const localReceipts = JSON.parse(localStorage.getItem('receipts') || '[]');
      const localMembers = JSON.parse(localStorage.getItem('members') || '[]');
      setBookings(localBookings);
      setPayments(localPayments);
      setReceipts(localReceipts);
      setMember(localMembers[0] || null);
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Мой кабинет</h1>
        <p className="text-slate-400 text-sm mt-2">Персональные данные, бронирования и оплаты</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <p className="text-sm text-slate-400">Активные бронирования</p>
          <p className="text-2xl font-bold text-slate-900">{bookings.filter(b => b.status === 'Подтверждено').length}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-slate-400">Оплаченные услуги</p>
          <p className="text-2xl font-bold text-slate-900">{payments.filter(p => p.status === 'Оплачен').length}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-slate-400">Сформированные чеки</p>
          <p className="text-2xl font-bold text-slate-900">{receipts.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Профиль клиента</h2>
          {member ? (
            <div className="space-y-2 text-sm text-slate-400">
              <p><span className="text-slate-600">Имя:</span> {member.name}</p>
              <p><span className="text-slate-600">Email:</span> {member.email}</p>
              <p><span className="text-slate-600">Телефон:</span> {member.phone}</p>
              <p><span className="text-slate-600">Абонемент:</span> {member.membership}</p>
              <p><span className="text-slate-600">Статус:</span> {member.status}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Нет данных профиля.</p>
          )}
        </div>

        <div className="glass-card p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Последние платежи</h2>
          <div className="space-y-3">
            {payments.slice(0, 5).map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                <div>
                  <p className="text-sm text-slate-600">{p.date}</p>
                  <p className="text-sm text-slate-400">{p.method} • {p.status}</p>
                </div>
                <div className="text-slate-900 font-semibold">{Number(p.amount).toLocaleString('ru-RU')} ₽</div>
              </div>
            ))}
            {payments.length === 0 && <p className="text-sm text-slate-400">Платежей пока нет.</p>}
          </div>
        </div>
      </div>

      <div className="glass-card p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Ближайшие бронирования</h2>
        <div className="space-y-3">
          {bookings.slice(0, 5).map(b => (
            <div key={b.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
              <div>
                <p className="font-medium text-slate-900">{b.className || b.class}</p>
                <p className="text-sm text-slate-400">{b.date} • {b.time}</p>
              </div>
              <span className="text-sm text-slate-500">{b.status}</span>
            </div>
          ))}
          {bookings.length === 0 && <p className="text-sm text-slate-400">Бронирований пока нет.</p>}
        </div>
      </div>
    </div>
  );
}
