import React, { useEffect, useMemo, useState } from 'react';
import {
  isApiAvailable,
  fetchMembers as apiFetchMembers,
  createMember as apiCreateMember,
  updateMember as apiUpdateMember,
  deleteMember as apiDeleteMember,
} from '../apiClient';
import { downloadExcelWorkbook } from '../utils/excel';

const FILTERS_KEY = 'members_filters_v2';
const DENSITY_KEY = 'members_density_v2';

function loadStoredFilters() {
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { searchTerm: '', filterMembership: 'all', filterStatus: 'all' };
}

function loadDensity() {
  try {
    return localStorage.getItem(DENSITY_KEY) || 'comfortable';
  } catch (e) {
    return 'comfortable';
  }
}

export default function Members() {
  const defaultFilters = loadStoredFilters();

  const [members, setMembers] = useState([]);
  const [searchTerm, setSearchTerm] = useState(defaultFilters.searchTerm || '');
  const [filterMembership, setFilterMembership] = useState(defaultFilters.filterMembership || 'all');
  const [filterStatus, setFilterStatus] = useState(defaultFilters.filterStatus || 'all');
  const [density, setDensity] = useState(loadDensity());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    membership: 'Премиум',
    joinDate: '',
    status: 'Активный',
  });
  const [useApi, setUseApi] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      const ok = await isApiAvailable();
      if (!mounted) return;
      setUseApi(ok);

      if (ok) {
        try {
          const remote = await apiFetchMembers();
          if (!mounted) return;
          setMembers(remote);
          setLoading(false);
          return;
        } catch (e) {}
      }

      const saved = localStorage.getItem('members');
      if (saved) {
        try {
          setMembers(JSON.parse(saved));
        } catch (e) {}
      } else {
        const init = [
          {
            id: 1,
            name: 'Мария Иванова',
            email: 'maria.ivanova@mail.ru',
            phone: '+7 (910) 111-01-01',
            membership: 'Премиум',
            joinDate: '2023-01-15',
            status: 'Активный',
          },
          {
            id: 2,
            name: 'Сергей Кузнецов',
            email: 'sergey.kuznetsov@mail.ru',
            phone: '+7 (910) 111-02-02',
            membership: 'Стандарт',
            joinDate: '2023-02-20',
            status: 'Неактивный',
          },
        ];
        setMembers(init);
        localStorage.setItem('members', JSON.stringify(init));
      }

      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        FILTERS_KEY,
        JSON.stringify({ searchTerm, filterMembership, filterStatus }),
      );
    } catch (e) {}
  }, [searchTerm, filterMembership, filterStatus]);

  useEffect(() => {
    try {
      localStorage.setItem(DENSITY_KEY, density);
    } catch (e) {}
  }, [density]);

  useEffect(() => {
    if (!useApi) localStorage.setItem('members', JSON.stringify(members));
  }, [members, useApi]);

  const filteredMembers = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    return members.filter((member) => {
      const matchesSearch =
        !q
        || String(member.name || '').toLowerCase().includes(q)
        || String(member.email || '').toLowerCase().includes(q)
        || String(member.phone || '').toLowerCase().includes(q);
      const matchesMembership = filterMembership === 'all' || member.membership === filterMembership;
      const matchesStatus = filterStatus === 'all' || member.status === filterStatus;
      return matchesSearch && matchesMembership && matchesStatus;
    });
  }, [members, searchTerm, filterMembership, filterStatus]);

  const membershipColors = {
    Премиум: 'status-badge status-info',
    Стандарт: 'status-badge',
    Базовый: 'status-badge status-muted',
  };
  const statusColors = {
    Активный: 'status-badge status-ok',
    Неактивный: 'status-badge status-danger',
  };

  function openAdd() {
    setEditingMember(null);
    setForm({
      name: '',
      email: '',
      phone: '',
      membership: 'Премиум',
      joinDate: new Date().toISOString().slice(0, 10),
      status: 'Активный',
    });
    setIsModalOpen(true);
  }

  function openEdit(member) {
    setEditingMember(member.id);
    setForm({
      name: member.name,
      email: member.email,
      phone: member.phone,
      membership: member.membership,
      joinDate: member.joinDate,
      status: member.status,
    });
    setIsModalOpen(true);
  }

  async function saveMember() {
    if (!form.name.trim() || !form.email.trim()) return alert('Введите имя и email');

    if (useApi) {
      try {
        if (editingMember) {
          const updated = await apiUpdateMember(editingMember, form);
          setMembers((prev) => prev.map((member) => (member.id === editingMember ? updated : member)));
        } else {
          const created = await apiCreateMember(form);
          setMembers((prev) => [created, ...prev]);
        }
        setIsModalOpen(false);
        return;
      } catch (e) {}
    }

    if (editingMember) {
      setMembers((prev) => prev.map((member) => (member.id === editingMember ? { ...member, ...form } : member)));
    } else {
      setMembers((prev) => [{ id: Date.now(), ...form }, ...prev]);
    }
    setIsModalOpen(false);
  }

  async function deleteMember(id) {
    if (!confirm('Удалить клиента?')) return;

    if (useApi) {
      try {
        await apiDeleteMember(id);
      } catch (e) {}
    }

    setMembers((prev) => prev.filter((member) => member.id !== id));
  }

  function resetFilters() {
    setSearchTerm('');
    setFilterMembership('all');
    setFilterStatus('all');
  }

  function exportExcel() {
    if (!filteredMembers.length) return;

    const columns = ['Имя', 'Email', 'Телефон', 'Абонемент', 'Дата регистрации', 'Статус'];
    const rows = filteredMembers.map((member) => [
      member.name,
      member.email,
      member.phone,
      member.membership,
      member.joinDate,
      member.status,
    ]);

    downloadExcelWorkbook(
      [{ name: 'Клиенты', columns, rows }],
      `members_${new Date().toISOString().slice(0, 10)}.xls`,
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Клиенты</h1>
          <p className="text-gray-600 text-sm">Всего: {members.length} • После фильтра: {filteredMembers.length}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportExcel} className="action-btn">
            <i className="fas fa-file-excel" />
            Excel
          </button>
          <button onClick={openAdd} className="bg-blue-600 text-white px-6 py-2 rounded">
            <i className="fas fa-plus mr-2" />
            Добавить клиента
          </button>
        </div>
      </div>

      <div className="glass-card p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="news-search md:col-span-2">
            <i className="fas fa-search" />
            <input
              type="text"
              placeholder="Поиск по имени, email или телефону"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </label>

          <select
            value={filterMembership}
            onChange={(e) => setFilterMembership(e.target.value)}
            className="px-3 py-2 border rounded bg-white/5 text-slate-900"
          >
            <option value="all">Все абонементы</option>
            <option value="Премиум">Премиум</option>
            <option value="Стандарт">Стандарт</option>
            <option value="Базовый">Базовый</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border rounded bg-white/5 text-slate-900"
          >
            <option value="all">Все статусы</option>
            <option value="Активный">Активный</option>
            <option value="Неактивный">Неактивный</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-600">Плотность:</span>
          <button className={`chip ${density === 'comfortable' ? 'active' : ''}`} onClick={() => setDensity('comfortable')}>Комфорт</button>
          <button className={`chip ${density === 'compact' ? 'active' : ''}`} onClick={() => setDensity('compact')}>Компактно</button>
          <button className="chip" onClick={resetFilters}>Сбросить фильтры</button>
        </div>
      </div>

      <div className="glass-card overflow-hidden table-shell">
        {loading ? (
          <div className="p-5 space-y-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="skeleton-card rounded-xl p-5" />
            ))}
          </div>
        ) : filteredMembers.length ? (
          <div className="overflow-auto">
            <table className={`w-full ${density === 'compact' ? 'table-compact' : 'table-comfortable'}`}>
              <thead>
                <tr>
                  <th>Имя</th>
                  <th>Email</th>
                  <th>Телефон</th>
                  <th>Абонемент</th>
                  <th>Дата</th>
                  <th>Статус</th>
                  <th className="text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => (
                  <tr key={member.id}>
                    <td className="font-medium">{member.name}</td>
                    <td>{member.email}</td>
                    <td>{member.phone}</td>
                    <td>
                      <span className={membershipColors[member.membership] || 'status-badge'}>{member.membership}</span>
                    </td>
                    <td>{member.joinDate}</td>
                    <td>
                      <span className={statusColors[member.status] || 'status-badge'}>{member.status}</span>
                    </td>
                    <td className="text-right">
                      <div className="inline-flex gap-1">
                        <button onClick={() => openEdit(member)} className="icon-btn" title="Редактировать">
                          <i className="fas fa-pen" />
                        </button>
                        <button onClick={() => deleteMember(member.id)} className="icon-btn" title="Удалить">
                          <i className="fas fa-trash" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500">По текущим фильтрам клиенты не найдены.</div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="glass-card p-6 max-w-md w-full">
            <h3 className="text-lg font-bold mb-4">{editingMember ? 'Редактировать клиента' : 'Добавить клиента'}</h3>
            <div className="grid gap-3">
              <input className="px-3 py-2 border rounded bg-white/5 text-slate-900" placeholder="Имя" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="px-3 py-2 border rounded bg-white/5 text-slate-900" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input className="px-3 py-2 border rounded bg-white/5 text-slate-900" placeholder="Телефон" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <select className="px-3 py-2 border rounded bg-white/5 text-slate-900" value={form.membership} onChange={(e) => setForm({ ...form, membership: e.target.value })}>
                <option>Премиум</option>
                <option>Стандарт</option>
                <option>Базовый</option>
              </select>
              <input className="px-3 py-2 border rounded bg-white/5 text-slate-900" type="date" value={form.joinDate} onChange={(e) => setForm({ ...form, joinDate: e.target.value })} />
              <select className="px-3 py-2 border rounded bg-white/5 text-slate-900" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option>Активный</option>
                <option>Неактивный</option>
              </select>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded text-slate-900">Отмена</button>
              <button onClick={saveMember} className="px-4 py-2 bg-blue-600 text-white rounded">Сохранить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
