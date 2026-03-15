import React, { useEffect, useMemo, useState } from 'react';
import { fetchPayments, createPayment, updatePayment, deletePayment, isApiAvailable, fetchPaymentProviders, createMockPaymentLink, createYooKassaPayment, createTinkoffInit, createTinkoffSbpQr, createTinkoffSberpayQr } from '../apiClient';
import { notify } from '../utils/toast';

const CLOUDPAYMENTS_SCRIPT_SRC = 'https://widget.cloudpayments.ru/bundles/cloudpayments';

function ensureCloudPaymentsLoaded() {
  if (window.CloudPayments) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-cloudpayments="1"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('CloudPayments load failed')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = CLOUDPAYMENTS_SCRIPT_SRC;
    script.async = true;
    script.dataset.cloudpayments = '1';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('CloudPayments load failed'));
    document.head.appendChild(script);
  });
}

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [density, setDensity] = useState(() => {
    try {
      return localStorage.getItem('payments_density_v2') || 'comfortable';
    } catch (e) {
      return 'comfortable';
    }
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ member: '', amount: '', date: '', status: 'Оплачен', method: '', provider: '' });
  const [useApi, setUseApi] = useState(false);
  const [providers, setProviders] = useState([
    { id: 'yookassa', name: 'YooKassa' },
    { id: 'cloudpayments', name: 'CloudPayments' },
    { id: 'tinkoff', name: 'Тинькофф' },
    { id: 'sberpay', name: 'СберPay' },
    { id: 'sbp', name: 'СБП' },
  ]);
  const [mockLink, setMockLink] = useState('');
  const [mockProvider, setMockProvider] = useState('');
  const [mockAmount, setMockAmount] = useState('');
  const [yooLink, setYooLink] = useState('');
  const [tinkoffLink, setTinkoffLink] = useState('');
  const [tinkoffPaymentId, setTinkoffPaymentId] = useState('');
  const [sbpQrSvg, setSbpQrSvg] = useState('');
  const [sberpayQrSvg, setSberpayQrSvg] = useState('');
  const [realAmount, setRealAmount] = useState('');
  const [realDescription, setRealDescription] = useState('Оплата услуг');

  useEffect(() => {
    let mounted = true;
    (async () => {
      const ok = await isApiAvailable();
      if (!mounted) return;
      setUseApi(ok);
      if (ok) {
        try {
          const data = await fetchPayments();
          if (!mounted) return;
          setPayments(data);
          const providerData = await fetchPaymentProviders();
          setProviders(providerData.providers || []);
          if (!mockProvider && providerData.providers?.length) setMockProvider(providerData.providers[0].id);
          return;
        } catch (e) {}
      }
      const saved = localStorage.getItem('payments');
      if (saved) setPayments(JSON.parse(saved));
      else {
        const init = [
          { id: 1, member: 'Мария Иванова', amount: 1500, method: 'Кредитная карта', date: '2024-01-28', status: 'Оплачен' },
          { id: 2, member: 'Сергей Кузнецов', amount: 14999, method: 'Банк перевод', date: '2024-01-27', status: 'Оплачен' },
        ];
        setPayments(init); localStorage.setItem('payments', JSON.stringify(init));
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => { if (!useApi) localStorage.setItem('payments', JSON.stringify(payments)); }, [payments, useApi]);
  useEffect(() => {
    try {
      localStorage.setItem('payments_density_v2', density);
    } catch (e) {}
  }, [density]);

  const statusColors = { 'Оплачен': 'status-badge status-ok', 'Не оплачен': 'status-badge status-warning', 'Ошибка': 'status-badge status-danger' };

  const totalRevenueNumber = payments.filter(p => p.status === 'Оплачен').reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const formatCurrency = (value) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(value);
  const totalRevenue = formatCurrency(totalRevenueNumber);
  const localOrigin = typeof window === 'undefined' ? 'http://localhost:3000' : window.location.origin;
  const paidUrl = `${localOrigin}/paid`;
  const failedUrl = `${localOrigin}/failed`;

  const filteredPayments = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return payments.filter((payment) => {
      const byStatus = filterStatus === 'all' || payment.status === filterStatus;
      const bySearch = !q || String(payment.member || '').toLowerCase().includes(q) || String(payment.method || '').toLowerCase().includes(q);
      return byStatus && bySearch;
    });
  }, [payments, filterStatus, searchTerm]);

  function openAdd() { setEditing(null); setForm({ member: '', amount: '', date: new Date().toISOString().slice(0,10), status: 'Оплачен', method: '', provider: '' }); setIsModalOpen(true); }
  function openEdit(p) { setEditing(p.id); setForm({ member: p.member, amount: p.amount, date: p.date, status: p.status, method: p.method, provider: p.provider || '' }); setIsModalOpen(true); }

  async function save() {
    if (!form.member || !form.amount) return alert('Введите имя клиента и сумму');
    const payload = { member: form.member, amount: Number(form.amount), date: form.date, status: form.status, method: form.method, provider: form.provider };
    if (useApi) {
      try {
        if (editing) { const updated = await updatePayment(editing, payload); setPayments(prev => prev.map(p => p.id === editing ? updated : p)); }
        else { const created = await createPayment(payload); setPayments(prev => [created, ...prev]); }
        setIsModalOpen(false);
      } catch (e) { alert('Ошибка API, сохраняю локально'); if (editing) setPayments(prev => prev.map(p => p.id === editing ? { ...p, ...payload } : p)); else setPayments(prev => [{ id: Date.now(), ...payload }, ...prev]); setIsModalOpen(false); }
    } else { if (editing) setPayments(prev => prev.map(p => p.id === editing ? { ...p, ...payload } : p)); else setPayments(prev => [{ id: Date.now(), ...payload }, ...prev]); setIsModalOpen(false); }
  }

  async function remove(id) { if (!confirm('Удалить платёж?')) return; if (useApi) { try { await deletePayment(id); setPayments(prev => prev.filter(p => p.id !== id)); } catch (e) { alert('Ошибка API, удаляю локально'); setPayments(prev => prev.filter(p => p.id !== id)); } } else setPayments(prev => prev.filter(p => p.id !== id)); }

  async function generateMockLink() {
    if (!mockProvider) return;
    try {
      const res = await createMockPaymentLink({
        provider: mockProvider,
        amount: Number(mockAmount || totalRevenueNumber || 0),
        description: 'Демо-оплата услуг',
      });
      setMockLink(res.url);
    } catch (e) {
      setMockLink('Не удалось создать ссылку');
    }
  }

  async function initYooKassa() {
    try {
      const res = await createYooKassaPayment({
        amount: Number(realAmount || 0),
        description: realDescription,
        returnUrl: paidUrl,
      });
      const link = res?.confirmation?.confirmation_url || '';
      setYooLink(link || 'Не удалось получить ссылку');
    } catch (e) {
      setYooLink('Ошибка YooKassa');
    }
  }

  async function initTinkoff() {
    try {
      const res = await createTinkoffInit({
        amount: Number(realAmount || 0),
        description: realDescription,
        successUrl: paidUrl,
        failUrl: failedUrl,
      });
      setTinkoffPaymentId(res?.PaymentId || '');
      setTinkoffLink(res?.PaymentURL || 'Не удалось получить ссылку');
    } catch (e) {
      setTinkoffLink('Ошибка Тинькофф');
    }
  }

  async function loadSbpQr() {
    if (!tinkoffPaymentId) return;
    try {
      const res = await createTinkoffSbpQr({ paymentId: tinkoffPaymentId });
      setSbpQrSvg(res?.QrCode || res?.Data || '');
    } catch (e) {
      setSbpQrSvg('Ошибка QR');
    }
  }

  async function loadSberpayQr() {
    if (!tinkoffPaymentId) return;
    try {
      const res = await createTinkoffSberpayQr({ paymentId: tinkoffPaymentId });
      setSberpayQrSvg(res?.QrCode || res?.Data || '');
    } catch (e) {
      setSberpayQrSvg('Ошибка QR');
    }
  }

  async function openCloudPaymentsWidget() {
    const publicId = import.meta.env.VITE_CLOUDPAYMENTS_PUBLIC_ID;
    if (!publicId) {
      notify('Нужен VITE_CLOUDPAYMENTS_PUBLIC_ID', 'warning');
      return;
    }
    try {
      await ensureCloudPaymentsLoaded();
    } catch (e) {
      notify('Не удалось загрузить CloudPayments Widget.', 'error');
      return;
    }

    const widget = new window.CloudPayments();
    widget.pay('charge', {
      publicId,
      description: realDescription,
      amount: Number(realAmount || 0),
      currency: 'RUB',
      accountId: 'demo-user',
      skin: 'classic',
    }, {
      onSuccess: async () => {
        try {
          await createPayment({
            member: 'VK Пользователь',
            amount: Number(realAmount || 0),
            method: 'CloudPayments Widget',
            date: new Date().toISOString().slice(0, 10),
            status: 'Оплачен',
            provider: 'CloudPayments',
          });
        } catch (e) {}
      },
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Платежи</h1>
          <p className="text-gray-600 text-sm mt-2">Управление платежами клиентов</p>
        </div>
        <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors font-medium">
          <i className="fas fa-plus mr-2"></i>
          Записать платёж
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-4">
          <p className="text-sm text-slate-400 mb-2">Общая выручка</p>
          <p className="text-3xl font-bold text-slate-900">{totalRevenue}</p>
          <p className="text-xs text-green-600 mt-2"><i className="fas fa-arrow-up mr-1"></i>Завершённые платежи</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-slate-400 mb-2">Всего транзакций</p>
          <p className="text-3xl font-bold text-slate-900">{payments.length}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-slate-400 mb-2">Ожидание</p>
          <p className="text-3xl font-bold text-yellow-600">{payments.filter(p => p.status === 'Не оплачен').length}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-slate-400 mb-2">Ошибки</p>
          <p className="text-3xl font-bold text-red-600">{payments.filter(p => p.status === 'Ошибка').length}</p>
        </div>
      </div>

      <div className="glass-card p-4">
        <h2 className="text-lg font-bold text-slate-900 mb-3">Российские платежные системы (демо)</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
          <select value={mockProvider} onChange={e => setMockProvider(e.target.value)} className="px-3 py-2 border rounded bg-white/5 text-slate-200">
            {providers.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <input type="number" className="px-3 py-2 border rounded bg-white/5 text-slate-200" placeholder="Сумма" value={mockAmount} onChange={e => setMockAmount(e.target.value)} />
          <button onClick={generateMockLink} className="bg-blue-600 text-white py-2 rounded">Создать ссылку</button>
          <div className="text-xs text-slate-400 break-all">{mockLink || 'Ссылка появится здесь'}</div>
        </div>
      </div>

      <div className="glass-card p-4">
        <h2 className="text-lg font-bold text-slate-900 mb-3">Реальные тестовые API</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center mb-4">
          <input type="number" className="px-3 py-2 border rounded bg-white/5 text-slate-200" placeholder="Сумма" value={realAmount} onChange={e => setRealAmount(e.target.value)} />
          <input className="px-3 py-2 border rounded bg-white/5 text-slate-200" placeholder="Назначение" value={realDescription} onChange={e => setRealDescription(e.target.value)} />
          <button onClick={initYooKassa} className="bg-blue-600 text-white py-2 rounded">YooKassa</button>
          <button onClick={initTinkoff} className="bg-slate-900 text-white py-2 rounded">Тинькофф</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-400">
          <div>YooKassa ссылка: {yooLink || '—'}</div>
          <div>Тинькофф ссылка: {tinkoffLink || '—'}</div>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
          <button onClick={loadSbpQr} className="bg-emerald-600 text-white py-2 rounded">СБП QR</button>
          <button onClick={loadSberpayQr} className="bg-green-700 text-white py-2 rounded">SberPay QR</button>
          <button onClick={openCloudPaymentsWidget} className="bg-sky-600 text-white py-2 rounded">CloudPayments Widget</button>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 rounded bg-white/5">
            <p className="text-xs text-slate-400 mb-2">СБП QR</p>
            {sbpQrSvg ? <div className="text-xs" dangerouslySetInnerHTML={{ __html: sbpQrSvg }} /> : <p className="text-xs text-slate-500">Нет данных</p>}
          </div>
          <div className="p-3 rounded bg-white/5">
            <p className="text-xs text-slate-400 mb-2">SberPay QR</p>
            {sberpayQrSvg ? <div className="text-xs" dangerouslySetInnerHTML={{ __html: sberpayQrSvg }} /> : <p className="text-xs text-slate-500">Нет данных</p>}
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="glass-card p-4 space-y-3">
        <label className="news-search">
          <i className="fas fa-search"></i>
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Поиск по клиенту или методу оплаты"
          />
        </label>
        <div className="flex gap-2 flex-wrap items-center">
          {['all', 'Оплачен', 'Не оплачен', 'Ошибка'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`chip ${filterStatus === status ? 'active' : ''}`}
            >
              {status === 'all' ? 'Все' : status}
            </button>
          ))}
          <span className="text-sm text-slate-600 ml-2">Плотность:</span>
          <button className={`chip ${density === 'comfortable' ? 'active' : ''}`} onClick={() => setDensity('comfortable')}>Комфорт</button>
          <button className={`chip ${density === 'compact' ? 'active' : ''}`} onClick={() => setDensity('compact')}>Компактно</button>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden table-shell">
        {filteredPayments.length ? (
        <div className="overflow-auto">
        <table className={`w-full ${density === 'compact' ? 'table-compact' : 'table-comfortable'}`}>
          <thead>
            <tr>
              <th>Клиент</th>
              <th>Сумма</th>
              <th>Метод оплаты</th>
              <th>Дата</th>
              <th>Статус</th>
              <th>Чек</th>
              <th>Провайдер</th>
              <th className="text-right">Действия</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.map((payment) => (
              <tr key={payment.id}>
                <td className="font-medium">{payment.member}</td>
                <td className="font-semibold">{formatCurrency(payment.amount)}</td>
                <td>{payment.method}</td>
                <td>{payment.date}</td>
                <td>
                  <span className={statusColors[payment.status] || 'status-badge'}>
                    {payment.status}
                  </span>
                </td>
                <td>{payment.receiptId ? `#${payment.receiptId}` : '-'}</td>
                <td>{payment.provider || '-'}</td>
                <td className="text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => openEdit(payment)} className="icon-btn transition-colors">
                      <i className="fas fa-pen"></i>
                    </button>
                    <button onClick={() => remove(payment.id)} className="icon-btn transition-colors">
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        ) : (
          <div className="p-8 text-center text-slate-500">Платежи не найдены по выбранным фильтрам.</div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="glass-card p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">{editing ? 'Редактировать платёж' : 'Новый платёж'}</h3>
            <div className="grid gap-3">
              <input className="px-3 py-2 border rounded bg-white/5 text-slate-200" placeholder="Клиент" value={form.member} onChange={e => setForm({...form, member: e.target.value})} />
              <input type="number" className="px-3 py-2 border rounded bg-white/5 text-slate-200" placeholder="Сумма" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
              <input className="px-3 py-2 border rounded bg-white/5 text-slate-200" placeholder="Метод" value={form.method} onChange={e => setForm({...form, method: e.target.value})} />
              <select className="px-3 py-2 border rounded bg-white/5 text-slate-200" value={form.provider} onChange={e => setForm({...form, provider: e.target.value})}>
                <option value="">Провайдер</option>
                {providers.map(p => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
              <input type="date" className="px-3 py-2 border rounded bg-white/5 text-slate-200" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
              <select className="px-3 py-2 border rounded bg-white/5 text-slate-200" value={form.status} onChange={e => setForm({...form, status: e.target.value})}><option>Оплачен</option><option>Не оплачен</option><option>Ошибка</option></select>
            </div>
            <div className="mt-4 flex justify-end gap-2"><button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded text-slate-200">Отмена</button><button onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded">Сохранить</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
