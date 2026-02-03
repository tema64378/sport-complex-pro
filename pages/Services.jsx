import React, { useEffect, useMemo, useState } from 'react';
import { isApiAvailable, fetchMembers, fetchServices, fetchReceipts, createReceipt, updateReceipt, createPayment, fetchPaymentProviders } from '../api';

const SERVICE_CATALOG = [
  { id: 1, name: 'Доступ в тренажерный зал', category: 'Фитнес', price: 600, unit: 'посещение', description: 'Свободный доступ к тренажерам' },
  { id: 2, name: 'Персональная тренировка', category: 'Тренер', price: 1800, unit: 'час', description: 'Индивидуальная работа с тренером' },
  { id: 3, name: 'Консультация тренера', category: 'Тренер', price: 900, unit: 'сессия', description: 'Подбор плана и рекомендаций' },
  { id: 4, name: 'Бассейн', category: 'Вода', price: 700, unit: 'час', description: 'Доступ в бассейн и сауну' },
  { id: 5, name: 'Теннисный корт', category: 'Спорт', price: 1200, unit: 'час', description: 'Аренда корта и инвентаря' },
  { id: 6, name: 'Групповое занятие', category: 'Группы', price: 500, unit: 'занятие', description: 'Йога, пилатес, функционал' },
];

function loadMembers() {
  try {
    const raw = localStorage.getItem('members');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [
    { id: 101, name: 'Мария Иванова', membership: 'Премиум' },
    { id: 102, name: 'Сергей Кузнецов', membership: 'Стандарт' },
  ];
}

function loadReceipts() {
  try {
    const raw = localStorage.getItem('receipts');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

function saveReceipts(receipts) {
  try { localStorage.setItem('receipts', JSON.stringify(receipts)); } catch (e) {}
}

const membershipDiscounts = {
  'Премиум': 0.1,
  'Стандарт': 0.05,
  'Базовый': 0,
};

export default function Services() {
  const [members, setMembers] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [cart, setCart] = useState({});
  const [receipts, setReceipts] = useState([]);
  const [note, setNote] = useState('');
  const [services, setServices] = useState(SERVICE_CATALOG);
  const [useApi, setUseApi] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Карта');
  const [paymentStatus, setPaymentStatus] = useState('Оплачен');
  const [paymentProvider, setPaymentProvider] = useState('');
  const [providers, setProviders] = useState([
    { id: 'yookassa', name: 'YooKassa' },
    { id: 'cloudpayments', name: 'CloudPayments' },
    { id: 'tinkoff', name: 'Тинькофф' },
    { id: 'sberpay', name: 'СберPay' },
    { id: 'sbp', name: 'СБП' },
  ]);

  useEffect(() => {
    (async () => {
      const ok = await isApiAvailable();
      setUseApi(ok);
      if (ok) {
        try {
          const [m, s, r, p] = await Promise.all([fetchMembers(), fetchServices(), fetchReceipts(), fetchPaymentProviders()]);
          setMembers(m);
          setServices(s);
          setReceipts(r);
          setProviders(p.providers || []);
          if (!paymentProvider && p.providers?.length) setPaymentProvider(p.providers[0].name);
          return;
        } catch (e) {}
      }
      setMembers(loadMembers());
      setServices(SERVICE_CATALOG);
      setReceipts(loadReceipts());
    })();
  }, []);

  useEffect(() => { if (!useApi) saveReceipts(receipts); }, [receipts, useApi]);

  const selectedMember = useMemo(() => members.find(m => String(m.id) === String(selectedMemberId)), [members, selectedMemberId]);

  const items = useMemo(() => services
    .filter(s => cart[s.id])
    .map(s => ({ ...s, qty: cart[s.id] })), [cart, services]);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discountRate = selectedMember ? (membershipDiscounts[selectedMember.membership] ?? 0) : 0;
  const discount = subtotal * discountRate;
  const total = Math.max(subtotal - discount, 0);

  function updateQty(id, delta) {
    setCart(prev => {
      const next = { ...prev };
      const current = next[id] || 0;
      const updated = Math.max(current + delta, 0);
      if (updated === 0) delete next[id];
      else next[id] = updated;
      return next;
    });
  }

  function clearCart() {
    setCart({});
    setNote('');
  }

  function buildReceiptPayload() {
    if (!selectedMember) {
      alert('Выберите клиента.');
      return;
    }
    if (items.length === 0) {
      alert('Добавьте услуги в чек.');
      return;
    }
    return {
      memberId: selectedMember.id,
      memberName: selectedMember.name,
      membership: selectedMember.membership,
      items,
      subtotal,
      discount,
      total,
      createdAt: new Date().toISOString(),
      note,
    };
  }

  async function createReceiptAndPayment() {
    const payload = buildReceiptPayload();
    if (!payload) return;
    if (useApi) {
      try {
        const receipt = await createReceipt(payload);
        const payment = await createPayment({
          member: payload.memberName,
          amount: payload.total,
          method: paymentMethod,
          date: new Date().toISOString().slice(0, 10),
          status: paymentStatus,
          provider: paymentProvider,
          receiptId: receipt.id,
        });
        const linkedReceipt = await updateReceipt(receipt.id, { paymentId: payment.id });
        setReceipts(prev => [linkedReceipt, ...prev]);
        clearCart();
        return;
      } catch (e) {
        alert('Ошибка API, чек сохранен локально.');
      }
    }
    const receipt = { id: Date.now(), ...payload };
    setReceipts(prev => [receipt, ...prev]);
    clearCart();
  }

  function exportPdf(receipt) {
    const w = window.open('', '_blank', 'width=720,height=900');
    if (!w) return;
    const rows = receipt.items.map(item => `<tr><td>${item.name}</td><td>${item.qty}</td><td>${(item.price * item.qty).toLocaleString('ru-RU')} ₽</td></tr>`).join('');
    w.document.write(`
      <html>
        <head>
          <title>Чек #${receipt.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
            h1 { font-size: 20px; margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border-bottom: 1px solid #e2e8f0; padding: 8px; text-align: left; }
            .total { margin-top: 16px; font-size: 18px; font-weight: 700; }
            .muted { color: #64748b; font-size: 12px; }
          </style>
        </head>
        <body>
          <h1>Чек к оплате</h1>
          <div class="muted">Клиент: ${receipt.memberName || receipt.member}</div>
          <div class="muted">Дата: ${new Date(receipt.createdAt).toLocaleString('ru-RU')}</div>
          <table>
            <thead><tr><th>Услуга</th><th>Кол-во</th><th>Сумма</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="total">Итого: ${Number(receipt.total || 0).toLocaleString('ru-RU')} ₽</div>
          <div class="muted">Способ оплаты: ${paymentMethod}</div>
        </body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Услуги и чек</h1>
        <p className="text-slate-400 text-sm mt-2">Учет потребленных услуг, формирование чека и оплата</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Каталог услуг</h2>
                <p className="text-sm text-slate-400">Быстро добавляйте позиции в чек клиента</p>
              </div>
              <select
                value={selectedMemberId}
                onChange={e => setSelectedMemberId(e.target.value)}
                className="px-4 py-2 rounded-lg border bg-white/5 text-slate-200"
              >
                <option value="">Выберите клиента</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name} ({m.membership})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {services.map(service => (
                <div key={service.id} className="p-4 rounded-lg border border-white/10 bg-white/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-400">{service.category}</p>
                      <h3 className="text-lg font-semibold text-slate-900">{service.name}</h3>
                    </div>
                    <span className="px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">{service.price} ₽</span>
                  </div>
                  <p className="text-sm text-slate-400 mt-2">{service.description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Ед: {service.unit}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(service.id, -1)} className="w-8 h-8 rounded-full border text-slate-600">-</button>
                      <span className="w-6 text-center text-slate-900">{cart[service.id] || 0}</span>
                      <button onClick={() => updateQty(service.id, 1)} className="w-8 h-8 rounded-full border text-slate-600">+</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">История чеков</h2>
            <div className="space-y-3">
              {receipts.slice(0, 5).map(receipt => (
                <div key={receipt.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <div>
                    <p className="font-medium text-slate-900">{receipt.memberName || receipt.member}</p>
                    <p className="text-xs text-slate-400">{new Date(receipt.createdAt).toLocaleString('ru-RU')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-400">{receipt.items.length} позиций</p>
                    <p className="text-lg font-semibold text-slate-900">{receipt.total.toLocaleString('ru-RU')} ₽</p>
                    <button onClick={() => exportPdf(receipt)} className="mt-2 text-xs text-blue-500">PDF</button>
                  </div>
                </div>
              ))}
              {receipts.length === 0 && <p className="text-sm text-slate-400">Чеки еще не сформированы.</p>}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Чек к оплате</h2>
            <div className="space-y-2">
              {items.map(item => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{item.name} x {item.qty}</span>
                  <span className="font-medium text-slate-900">{(item.price * item.qty).toLocaleString('ru-RU')} ₽</span>
                </div>
              ))}
              {items.length === 0 && <p className="text-sm text-slate-400">Добавьте услуги, чтобы сформировать чек.</p>}
            </div>
            <div className="border-t border-white/10 pt-4 space-y-2">
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>Подытог</span>
                <span>{subtotal.toLocaleString('ru-RU')} ₽</span>
              </div>
              <div className="flex items-center justify-between text-sm text-slate-500">
                <span>Скидка по абонементу</span>
                <span>-{discount.toLocaleString('ru-RU')} ₽</span>
              </div>
              <div className="flex items-center justify-between text-lg font-semibold text-slate-900">
                <span>Итого</span>
                <span>{total.toLocaleString('ru-RU')} ₽</span>
              </div>
            </div>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border bg-white/5 text-slate-200"
              placeholder="Комментарий к чеку"
            />
            <div className="grid grid-cols-1 gap-2">
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="px-3 py-2 rounded-lg border bg-white/5 text-slate-200">
                <option>Карта</option>
                <option>Наличные</option>
                <option>Онлайн</option>
              </select>
              <select value={paymentProvider} onChange={e => setPaymentProvider(e.target.value)} className="px-3 py-2 rounded-lg border bg-white/5 text-slate-200">
                <option value="">Провайдер оплаты</option>
                {providers.map(p => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
              <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)} className="px-3 py-2 rounded-lg border bg-white/5 text-slate-200">
                <option>Оплачен</option>
                <option>Не оплачен</option>
              </select>
              <div className="flex gap-2">
                <button onClick={clearCart} className="flex-1 border border-white/10 py-2 rounded-lg text-slate-600">Очистить</button>
                <button onClick={createReceiptAndPayment} className="flex-1 bg-blue-600 text-white py-2 rounded-lg">Сформировать чек и оплату</button>
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Подсказки</h3>
            <p className="text-sm text-slate-400">Система учитывает количество услуг и применяет скидку по абонементу клиента.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-sm">Премиум -10%</span>
              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-sm">Стандарт -5%</span>
              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-sm">Базовый 0%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
