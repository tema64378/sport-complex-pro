import React, { useEffect, useMemo, useState } from 'react';
import StatCard from '../components/StatCard';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  fetchAnalytics,
  fetchClasses,
  fetchNotifications,
  fetchPayments,
  fetchMembers,
} from '../api';

const fallback = {
  metrics: {
    totalMembers: 0,
    totalTrainers: 0,
    totalClasses: 0,
    monthRevenue: 0,
    activeMembers: 0,
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
};

function shortDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
  } catch (e) {
    return String(value);
  }
}

function safeAmount(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}

export default function Dashboard({ onNavigate }) {
  const [data, setData] = useState(fallback);
  const [classes, setClasses] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [payments, setPayments] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);

      const [analyticsRes, classesRes, notificationsRes, paymentsRes, membersRes] = await Promise.allSettled([
        fetchAnalytics(),
        fetchClasses(),
        fetchNotifications(),
        fetchPayments(),
        fetchMembers(),
      ]);

      if (!mounted) return;

      if (analyticsRes.status === 'fulfilled') {
        const res = analyticsRes.value;
        setData({
          metrics: { ...fallback.metrics, ...(res.metrics || {}) },
          monthlyMembers: res.monthlyMembers?.length ? res.monthlyMembers : fallback.monthlyMembers,
          revenueByMonth: Array.isArray(res.revenueByMonth) ? res.revenueByMonth : [],
        });
      } else {
        setData(fallback);
      }

      if (classesRes.status === 'fulfilled') setClasses(classesRes.value || []);
      if (notificationsRes.status === 'fulfilled') setNotifications(notificationsRes.value || []);
      if (paymentsRes.status === 'fulfilled') setPayments(paymentsRes.value || []);
      if (membersRes.status === 'fulfilled') setMembers(membersRes.value || []);

      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const kpis = useMemo(() => {
    const paidCount = payments.filter((payment) => payment.status === 'Оплачен').length;
    const pendingCount = payments.filter((payment) => payment.status !== 'Оплачен').length;

    return [
      {
        title: 'Всего клиентов',
        value: data.metrics.totalMembers.toLocaleString('ru-RU'),
        change: `Активных: ${data.metrics.activeMembers || 0}`,
        icon: 'fas fa-users',
      },
      {
        title: 'Тренировки в системе',
        value: data.metrics.totalClasses.toLocaleString('ru-RU'),
        change: `Ближайших: ${classes.slice(0, 6).length}`,
        icon: 'fas fa-dumbbell',
      },
      {
        title: 'Доход за месяц',
        value: `${safeAmount(data.metrics.monthRevenue).toLocaleString('ru-RU')} ₽`,
        change: `Оплачено: ${paidCount}, ожидание: ${pendingCount}`,
        icon: 'fas fa-ruble-sign',
      },
      {
        title: 'Непрочитанные события',
        value: notifications.filter((item) => !item.read).length,
        change: `Всего в ленте: ${notifications.length}`,
        icon: 'fas fa-inbox',
      },
    ];
  }, [classes, data.metrics, notifications, payments]);

  const attentionItems = useMemo(() => {
    const pendingPayments = payments.filter((item) => item.status !== 'Оплачен').length;
    const lowLoadedClasses = classes.filter((item) => Number(item.enrolled || 0) < 4).length;
    const inactiveMembers = members.filter((item) => item.status && item.status !== 'Активный').length;
    const unreadNotifications = notifications.filter((item) => !item.read).length;

    return [
      {
        id: 'payments',
        label: 'Ожидают оплаты',
        value: pendingPayments,
        hint: 'Проверьте счета и напомните клиентам о платеже.',
        tone: pendingPayments > 0 ? 'warning' : 'ok',
      },
      {
        id: 'bookings',
        label: 'Мало записей на тренировки',
        value: lowLoadedClasses,
        hint: 'Есть группы с низкой загрузкой, можно усилить продвижение.',
        tone: lowLoadedClasses > 0 ? 'warning' : 'ok',
      },
      {
        id: 'members',
        label: 'Неактивные клиенты',
        value: inactiveMembers,
        hint: 'Сегмент для реактивации через CRM-кампанию.',
        tone: inactiveMembers > 0 ? 'warning' : 'ok',
      },
      {
        id: 'notifications',
        label: 'Непрочитанные уведомления',
        value: unreadNotifications,
        hint: 'Проверьте входящие и закройте критичные задачи.',
        tone: unreadNotifications > 0 ? 'warning' : 'ok',
      },
    ];
  }, [classes, members, notifications, payments]);

  const quickActions = [
    { id: 'members', label: 'Новый клиент', icon: 'fas fa-user-plus' },
    { id: 'bookings', label: 'Создать запись', icon: 'fas fa-calendar-plus' },
    { id: 'payments', label: 'Принять оплату', icon: 'fas fa-credit-card' },
    { id: 'notifications', label: 'Открыть inbox', icon: 'fas fa-inbox' },
  ];

  const upcomingClasses = classes.slice(0, 6);
  const recentNotifications = notifications.slice(0, 5);

  return (
    <div className="space-y-6">
      <section className="glass-card p-6 reveal-up">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Операционный центр</h2>
            <p className="text-sm text-gray-600 mt-2">
              Быстрый срез по выручке, посещаемости и задачам, которые требуют внимания сегодня.
            </p>
          </div>
          <div className="quick-action-row">
            {quickActions.map((action) => (
              <button
                key={action.id}
                type="button"
                className="quick-action-btn"
                onClick={() => onNavigate && onNavigate(action.id)}
              >
                <i className={action.icon} />
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {loading ? (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="glass-card p-6 skeleton-card" />
          ))}
        </section>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 stagger-list">
          {kpis.map((item) => (
            <StatCard
              key={item.title}
              title={item.title}
              value={item.value}
              change={item.change}
              icon={item.icon}
              color="green"
            />
          ))}
        </section>
      )}

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 glass-card p-5 reveal-up">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Динамика клиентской базы</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.monthlyMembers}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.24)" />
              <XAxis dataKey="month" stroke="currentColor" />
              <YAxis stroke="currentColor" />
              <Tooltip contentStyle={{ border: 'none', borderRadius: 10 }} />
              <Legend />
              <Line type="monotone" dataKey="new" name="Новые" stroke="#16a34a" strokeWidth={2.6} />
              <Line type="monotone" dataKey="churn" name="Отток" stroke="#ef4444" strokeWidth={2.6} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-5 reveal-up">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Выручка по месяцам</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.revenueByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.24)" />
              <XAxis dataKey="month" stroke="currentColor" />
              <YAxis stroke="currentColor" />
              <Tooltip contentStyle={{ border: 'none', borderRadius: 10 }} />
              <Bar dataKey="revenue" fill="var(--accent)" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="glass-card p-5 reveal-up">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-gray-900">Требует внимания</h3>
            <button className="action-link-btn" onClick={() => onNavigate && onNavigate('notifications')}>
              Открыть inbox
            </button>
          </div>
          <div className="space-y-3">
            {attentionItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`attention-row ${item.tone}`}
                onClick={() => onNavigate && onNavigate(item.id)}
              >
                <div>
                  <p className="attention-label">{item.label}</p>
                  <p className="attention-hint">{item.hint}</p>
                </div>
                <span className="attention-value">{item.value}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="glass-card p-5 reveal-up">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-gray-900">Ближайшие тренировки</h3>
            <button className="action-link-btn" onClick={() => onNavigate && onNavigate('classes')}>
              Все тренировки
            </button>
          </div>
          <div className="space-y-3">
            {upcomingClasses.length ? (
              upcomingClasses.map((item) => (
                <div key={item.id} className="schedule-row">
                  <div>
                    <div className="font-semibold text-slate-900">{item.name}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {item.trainerName || 'Без тренера'} • {item.schedule || 'Расписание не указано'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Записаны</div>
                    <div className="font-semibold text-slate-900">{item.enrolled || 0}</div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">Тренировки еще не созданы.</p>
            )}
          </div>
        </div>
      </section>

      <section className="glass-card p-5 reveal-up">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-gray-900">Лента событий</h3>
          <button className="action-link-btn" onClick={() => onNavigate && onNavigate('notifications')}>
            Перейти к уведомлениям
          </button>
        </div>
        <div className="space-y-3">
          {recentNotifications.length ? (
            recentNotifications.map((item) => (
              <div key={item.id} className={`notification-row ${item.read ? 'read' : 'unread'}`}>
                <div>
                  <div className="text-xs text-slate-500">{item.type} • {item.createdAt}</div>
                  <div className="font-medium text-slate-900 mt-1">{item.title}</div>
                  <p className="text-sm text-slate-600 mt-1">{item.message}</p>
                </div>
                <span className={`state-pill ${item.read ? 'read' : 'unread'}`}>
                  {item.read ? 'Прочитано' : 'Новое'}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">Событий пока нет.</p>
          )}
        </div>
      </section>
    </div>
  );
}
