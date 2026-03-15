import React, { useEffect, useMemo, useState } from 'react';
import { fetchBookings, fetchPayments, fetchReceipts, fetchMembers, isApiAvailable } from '../api';

function money(value) {
  return `${Number(value || 0).toLocaleString('ru-RU')} ₽`;
}

export default function Client({ onNavigate }) {
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const ok = await isApiAvailable();
      if (!mounted) return;

      if (ok) {
        try {
          const [b, p, r, m] = await Promise.all([
            fetchBookings(),
            fetchPayments(),
            fetchReceipts(),
            fetchMembers(),
          ]);
          if (!mounted) return;
          setBookings(b || []);
          setPayments(p || []);
          setReceipts(r || []);
          setMember((m || [])[0] || null);
          setLoading(false);
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
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const paidPayments = useMemo(
    () => payments.filter((item) => item.status === 'Оплачен'),
    [payments]
  );
  const totalPaid = useMemo(
    () => paidPayments.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [paidPayments]
  );
  const confirmedBookings = useMemo(
    () => bookings.filter((item) => item.status === 'Подтверждено'),
    [bookings]
  );

  const quickActions = [
    { id: 'bookings', label: 'Записаться', icon: 'fas fa-calendar-plus' },
    { id: 'payments', label: 'Оплатить', icon: 'fas fa-credit-card' },
    { id: 'notifications', label: 'Уведомления', icon: 'fas fa-bell' },
  ];

  return (
    <div className="space-y-6">
      <section className="glass-card p-6 reveal-up">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Личный кабинет клиента</h2>
            <p className="text-slate-600 text-sm mt-2">Профиль, история платежей и ближайшие записи в одном месте.</p>
          </div>
          <div className="quick-action-row">
            {quickActions.map((item) => (
              <button
                key={item.id}
                type="button"
                className="quick-action-btn"
                onClick={() => onNavigate && onNavigate(item.id)}
              >
                <i className={item.icon} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="glass-card p-5 skeleton-card" />
          ))}
        </div>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-card p-4">
            <p className="text-sm text-slate-400">Активные бронирования</p>
            <p className="text-2xl font-bold text-slate-900">{confirmedBookings.length}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-sm text-slate-400">Оплаченные услуги</p>
            <p className="text-2xl font-bold text-slate-900">{paidPayments.length}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-sm text-slate-400">Сумма оплат</p>
            <p className="text-2xl font-bold text-slate-900">{money(totalPaid)}</p>
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1 glass-card p-6 reveal-up">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Профиль</h3>
          {member ? (
            <div className="profile-detail-card">
              <div className="profile-head">
                <div className="profile-big-avatar">{member.name?.slice(0, 1)?.toUpperCase() || 'U'}</div>
                <div>
                  <p className="profile-name-lg">{member.name}</p>
                  <p className="profile-sub">{member.membership || 'Абонемент не указан'}</p>
                </div>
              </div>
              <div className="profile-grid">
                <div>
                  <span>Email</span>
                  <strong>{member.email || '—'}</strong>
                </div>
                <div>
                  <span>Телефон</span>
                  <strong>{member.phone || '—'}</strong>
                </div>
                <div>
                  <span>Статус</span>
                  <strong>{member.status || '—'}</strong>
                </div>
                <div>
                  <span>Дата вступления</span>
                  <strong>{member.joinDate || '—'}</strong>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Нет данных профиля.</p>
          )}
        </div>

        <div className="xl:col-span-2 glass-card p-6 reveal-up">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Последние оплаты</h3>
          <div className="space-y-3">
            {payments.slice(0, 6).map((payment) => (
              <div key={payment.id} className="schedule-row">
                <div>
                  <div className="font-medium text-slate-900">{money(payment.amount)}</div>
                  <div className="text-sm text-slate-600 mt-1">{payment.method || 'Метод не указан'} • {payment.status}</div>
                </div>
                <span className="text-xs text-slate-500">{payment.date || '—'}</span>
              </div>
            ))}
            {!payments.length && <p className="text-sm text-slate-500">Платежей пока нет.</p>}
          </div>
        </div>
      </section>

      <section className="glass-card p-6 reveal-up">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Ближайшие бронирования</h3>
        <div className="space-y-3">
          {bookings.slice(0, 6).map((booking) => (
            <div key={booking.id} className="schedule-row">
              <div>
                <p className="font-medium text-slate-900">{booking.className || booking.class || 'Тренировка'}</p>
                <p className="text-sm text-slate-600 mt-1">{booking.date || '—'} • {booking.time || '—'}</p>
              </div>
              <span className="state-pill unread">{booking.status || '—'}</span>
            </div>
          ))}
          {!bookings.length && <p className="text-sm text-slate-500">Бронирований пока нет.</p>}
        </div>
      </section>

      <section className="glass-card p-6 reveal-up">
        <h3 className="text-lg font-bold text-slate-900 mb-3">История чеков</h3>
        <div className="text-sm text-slate-600">Сформировано чеков: <strong>{receipts.length}</strong></div>
      </section>
    </div>
  );
}
