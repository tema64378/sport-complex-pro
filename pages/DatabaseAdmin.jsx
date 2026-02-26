import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchMembers,
  fetchTrainers,
  fetchClasses,
  fetchBookings,
  fetchPayments,
  fetchUsers,
  fetchMemberships,
  fetchNotifications,
  fetchReceipts,
  fetchDeals,
  fetchCrmNotes,
  fetchCalendarSlots,
  fetchServices,
} from '../api';

const DATASETS = [
  { id: 'members', label: 'Клиенты', fetcher: fetchMembers },
  { id: 'users', label: 'Пользователи', fetcher: fetchUsers },
  { id: 'trainers', label: 'Тренеры', fetcher: fetchTrainers },
  { id: 'memberships', label: 'Абонементы', fetcher: fetchMemberships },
  { id: 'classes', label: 'Тренировки', fetcher: fetchClasses },
  { id: 'bookings', label: 'Бронирования', fetcher: fetchBookings },
  { id: 'payments', label: 'Платежи', fetcher: fetchPayments },
  { id: 'receipts', label: 'Чеки', fetcher: fetchReceipts },
  { id: 'deals', label: 'Сделки', fetcher: fetchDeals },
  { id: 'crmNotes', label: 'CRM заметки', fetcher: fetchCrmNotes },
  { id: 'calendarSlots', label: 'Слоты календаря', fetcher: fetchCalendarSlots },
  { id: 'notifications', label: 'Уведомления', fetcher: fetchNotifications },
  { id: 'services', label: 'Услуги', fetcher: fetchServices },
];

const PAGE_SIZES = [10, 25, 50, 100];

function toCellText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (e) {
      return String(value);
    }
  }
  return String(value);
}

function normalizeRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload) return [];
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.rows)) return payload.rows;
  if (Array.isArray(payload.data)) return payload.data;
  if (typeof payload === 'object') return [payload];
  return [];
}

function parseComparable(value) {
  if (value === null || value === undefined || value === '') return { type: 'empty', value: '' };
  if (typeof value === 'number') return { type: 'number', value };
  if (typeof value === 'boolean') return { type: 'number', value: value ? 1 : 0 };

  const text = toCellText(value).trim();
  if (!text) return { type: 'empty', value: '' };

  const compact = text.replace(/\s/g, '');
  if (/^-?\d+([.,]\d+)?$/.test(compact)) {
    const parsed = Number(compact.replace(',', '.'));
    if (!Number.isNaN(parsed)) return { type: 'number', value: parsed };
  }

  const ts = Date.parse(text);
  if (!Number.isNaN(ts) && /[-/:.TZ]/.test(text)) return { type: 'date', value: ts };

  return { type: 'text', value: text.toLowerCase() };
}

function compareValues(left, right) {
  const a = parseComparable(left);
  const b = parseComparable(right);

  if (a.type === 'empty' && b.type !== 'empty') return 1;
  if (a.type !== 'empty' && b.type === 'empty') return -1;

  if (a.type === b.type) {
    if (a.type === 'text') return a.value.localeCompare(b.value, 'ru');
    if (a.value < b.value) return -1;
    if (a.value > b.value) return 1;
    return 0;
  }

  return a.type.localeCompare(b.type);
}

function escapeCsv(value) {
  const text = toCellText(value);
  if (text.includes('"') || text.includes(';') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function formatDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('ru-RU');
  } catch (e) {
    return String(value);
  }
}

export default function DatabaseAdmin() {
  const [activeDataset, setActiveDataset] = useState('members');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterColumn, setFilterColumn] = useState('all');
  const [filterValue, setFilterValue] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortState, setSortState] = useState({ key: '', direction: 'asc' });
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshSeconds, setRefreshSeconds] = useState(15);
  const [lastSync, setLastSync] = useState(null);

  const activeConfig = useMemo(
    () => DATASETS.find((set) => set.id === activeDataset) || DATASETS[0],
    [activeDataset]
  );

  const loadDataset = useCallback(async (datasetId, options = {}) => {
    const config = DATASETS.find((set) => set.id === datasetId);
    if (!config) return;

    if (!options.silent) setLoading(true);
    if (!options.silent) setError('');

    try {
      const payload = await config.fetcher();
      setRows(normalizeRows(payload));
      setLastSync(new Date().toISOString());
    } catch (err) {
      if (!options.silent) {
        setError(`Не удалось загрузить "${config.label}".`);
      }
    } finally {
      if (!options.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setRows([]);
    setError('');
    setSearchTerm('');
    setFilterColumn('all');
    setFilterValue('all');
    setSortState({ key: '', direction: 'asc' });
    setPage(1);
    loadDataset(activeDataset);
  }, [activeDataset, loadDataset]);

  useEffect(() => {
    if (!autoRefresh) return undefined;

    const timer = setInterval(() => {
      loadDataset(activeDataset, { silent: true });
    }, Math.max(5, refreshSeconds) * 1000);

    return () => clearInterval(timer);
  }, [autoRefresh, refreshSeconds, activeDataset, loadDataset]);

  const columns = useMemo(() => {
    const seen = new Set();
    rows.forEach((row) => {
      Object.keys(row || {}).forEach((key) => seen.add(key));
    });
    const ordered = Array.from(seen);
    ordered.sort((a, b) => {
      if (a === 'id') return -1;
      if (b === 'id') return 1;
      return a.localeCompare(b, 'ru');
    });
    return ordered;
  }, [rows]);

  useEffect(() => {
    if (!columns.length) return;
    setSortState((prev) => (columns.includes(prev.key) ? prev : { key: columns[0], direction: 'asc' }));
    setFilterColumn((prev) => (prev === 'all' || columns.includes(prev) ? prev : 'all'));
  }, [columns]);

  const filterValues = useMemo(() => {
    if (filterColumn === 'all') return [];
    const values = Array.from(new Set(rows.map((row) => toCellText(row?.[filterColumn]))));
    values.sort((a, b) => a.localeCompare(b, 'ru'));
    return values;
  }, [rows, filterColumn]);

  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return rows.filter((row) => {
      if (!row || typeof row !== 'object') return false;

      const searchHit =
        !query ||
        columns.some((column) => toCellText(row[column]).toLowerCase().includes(query));

      const filterHit =
        filterColumn === 'all' ||
        filterValue === 'all' ||
        toCellText(row[filterColumn]) === filterValue;

      return searchHit && filterHit;
    });
  }, [rows, columns, searchTerm, filterColumn, filterValue]);

  const sortedRows = useMemo(() => {
    if (!sortState.key) return filteredRows;
    const next = [...filteredRows];
    next.sort((left, right) => {
      const base = compareValues(left?.[sortState.key], right?.[sortState.key]);
      return sortState.direction === 'asc' ? base : -base;
    });
    return next;
  }, [filteredRows, sortState]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, safePage, pageSize]);

  function changeSort(key) {
    setSortState((prev) => {
      if (prev.key !== key) return { key, direction: 'asc' };
      return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
    });
  }

  function exportCsv() {
    if (!columns.length || !sortedRows.length) return;
    const header = columns.map(escapeCsv).join(';');
    const lines = sortedRows.map((row) => columns.map((key) => escapeCsv(row?.[key])).join(';'));
    const csv = `\uFEFF${[header, ...lines].join('\n')}`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeDataset}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">База данных</h1>
          <p className="text-sm text-gray-600 mt-2">
            Админ-панель для просмотра, сортировки и фильтрации данных из API.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => loadDataset(activeDataset)}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium"
          >
            <i className="fas fa-rotate mr-2"></i>
            Обновить
          </button>
          <button
            onClick={exportCsv}
            disabled={!sortedRows.length}
            className="px-4 py-2 rounded-lg bg-slate-700 text-white font-medium disabled:opacity-40"
          >
            <i className="fas fa-file-csv mr-2"></i>
            CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <p className="text-sm text-slate-400">Активный набор</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{activeConfig.label}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-slate-400">Записей после фильтра</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{sortedRows.length}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-sm text-slate-400">Последняя синхронизация</p>
          <p className="text-xl font-bold text-slate-900 mt-1">{formatDateTime(lastSync)}</p>
        </div>
      </div>

      <div className="glass-card p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {DATASETS.map((set) => (
            <button
              key={set.id}
              onClick={() => setActiveDataset(set.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeDataset === set.id ? 'bg-blue-600 text-white' : 'bg-white/5 text-slate-900'
              }`}
            >
              {set.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <input
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              placeholder="Поиск по всем полям"
              className="w-full px-3 py-2 rounded-lg border bg-white/5 text-slate-900"
            />
          </div>
          <div>
            <select
              value={filterColumn}
              onChange={(e) => {
                setFilterColumn(e.target.value);
                setFilterValue('all');
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg border bg-white/5 text-slate-900"
            >
              <option value="all">Фильтр: все поля</option>
              {columns.map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={filterValue}
              onChange={(e) => {
                setFilterValue(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg border bg-white/5 text-slate-900"
              disabled={filterColumn === 'all'}
            >
              <option value="all">Все значения</option>
              {filterValues.map((value) => (
                <option key={value || '(empty)'} value={value}>
                  {value || '(пусто)'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg border bg-white/5 text-slate-900"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} строк
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Автообновление
            </label>
            <select
              value={refreshSeconds}
              onChange={(e) => setRefreshSeconds(Number(e.target.value))}
              className="px-2 py-2 rounded-lg border bg-white/5 text-slate-900"
              disabled={!autoRefresh}
            >
              <option value={10}>10с</option>
              <option value={15}>15с</option>
              <option value={30}>30с</option>
              <option value={60}>60с</option>
            </select>
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        {loading ? (
          <div className="p-6 text-slate-600">Загрузка...</div>
        ) : error ? (
          <div className="p-6 text-red-600">{error}</div>
        ) : !columns.length ? (
          <div className="p-6 text-slate-600">Нет данных в выбранном наборе.</div>
        ) : (
          <>
            <div className="overflow-auto">
              <table className="w-full min-w-[900px]">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column}
                        onClick={() => changeSort(column)}
                        className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer select-none"
                      >
                        <span className="inline-flex items-center gap-1">
                          {column}
                          {sortState.key === column && (
                            <i
                              className={`fas ${
                                sortState.direction === 'asc' ? 'fa-sort-up' : 'fa-sort-down'
                              }`}
                            ></i>
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {pageRows.map((row, index) => (
                    <tr key={row?.id ?? `${activeDataset}-${safePage}-${index}`} className="hover:bg-white/5">
                      {columns.map((column) => {
                        const fullValue = toCellText(row?.[column]);
                        const shortValue =
                          fullValue.length > 120 ? `${fullValue.slice(0, 120)}...` : fullValue || '—';
                        return (
                          <td
                            key={`${row?.id ?? index}-${column}`}
                            className="px-4 py-3 text-sm text-slate-800 align-top"
                            title={fullValue}
                            style={{ maxWidth: '280px', wordBreak: 'break-word' }}
                          >
                            {shortValue}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-white/10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-slate-600">
                Страница {safePage} из {totalPages} • Всего строк: {sortedRows.length}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  disabled={safePage <= 1}
                  className="px-3 py-1.5 rounded bg-white/10 text-slate-900 disabled:opacity-40"
                >
                  Назад
                </button>
                <button
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={safePage >= totalPages}
                  className="px-3 py-1.5 rounded bg-white/10 text-slate-900 disabled:opacity-40"
                >
                  Вперед
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
