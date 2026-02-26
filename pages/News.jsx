import React, { useMemo, useState } from 'react';

const NEWS_ITEMS = [
  {
    id: 1,
    title: 'Открыт набор в утренние функциональные группы',
    category: 'Тренировки',
    date: '2026-02-20',
    priority: 'high',
    summary: 'Добавили 4 новых слота в 07:00 и 08:00 для клиентов, которым удобно тренироваться до работы.',
  },
  {
    id: 2,
    title: 'Новая система персональных рекомендаций',
    category: 'Обновления',
    date: '2026-02-16',
    priority: 'medium',
    summary: 'В CRM появились подсказки по продлению абонемента и индивидуальным программам для клиентов группы риска.',
  },
  {
    id: 3,
    title: 'Weekend Battle: клубный мини-турнир',
    category: 'События',
    date: '2026-02-12',
    priority: 'high',
    summary: 'В субботу пройдет открытый турнир по функциональному многоборью. Регистрация до пятницы включительно.',
  },
  {
    id: 4,
    title: 'Техническое окно на платежном шлюзе',
    category: 'Сервис',
    date: '2026-02-08',
    priority: 'low',
    summary: 'В ночь с 12 на 13 февраля с 02:00 до 03:00 возможны короткие задержки подтверждения платежей.',
  },
  {
    id: 5,
    title: 'Запущена программа лояльности для семейных абонементов',
    category: 'Продажи',
    date: '2026-02-05',
    priority: 'medium',
    summary: 'Новый тариф для семей: скидка 12% при одновременном оформлении двух и более абонементов.',
  },
  {
    id: 6,
    title: 'Обновлен дизайн личного кабинета клиента',
    category: 'Обновления',
    date: '2026-02-01',
    priority: 'low',
    summary: 'Сделали интерфейс проще: быстрый доступ к записям, оплатам, заморозке абонемента и истории посещений.',
  },
];

const PRIORITY_LABEL = {
  high: 'Важное',
  medium: 'Плановое',
  low: 'Инфо',
};

function sortByDateDesc(items) {
  return [...items].sort((a, b) => new Date(b.date) - new Date(a.date));
}

export default function News() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Все');

  const categories = useMemo(() => {
    return ['Все', ...new Set(NEWS_ITEMS.map((item) => item.category))];
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return sortByDateDesc(
      NEWS_ITEMS.filter((item) => {
        const byCategory = category === 'Все' || item.category === category;
        const byQuery = !normalized
          || item.title.toLowerCase().includes(normalized)
          || item.summary.toLowerCase().includes(normalized);
        return byCategory && byQuery;
      }),
    );
  }, [query, category]);

  const importantCount = filtered.filter((item) => item.priority === 'high').length;

  return (
    <section className="news-layout">
      <div className="news-toolbar glass-card">
        <div className="news-toolbar-head">
          <h2>Лента новостей</h2>
          <p>Собирайте ключевые изменения клуба в одном месте и быстро фильтруйте их по темам.</p>
        </div>
        <div className="news-toolbar-controls">
          <label className="news-search">
            <i className="fas fa-magnifying-glass" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по заголовку и описанию"
            />
          </label>
          <div className="news-filter">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                className={`chip ${category === item ? 'active' : ''}`}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="news-stats">
        <article className="stat-tile glass-card">
          <span>Всего новостей</span>
          <strong>{filtered.length}</strong>
        </article>
        <article className="stat-tile glass-card">
          <span>Важные</span>
          <strong>{importantCount}</strong>
        </article>
        <article className="stat-tile glass-card">
          <span>Категорий</span>
          <strong>{Math.max(categories.length - 1, 0)}</strong>
        </article>
      </div>

      <div className="news-grid">
        {filtered.map((item) => (
          <article key={item.id} className="news-card glass-card">
            <header className="news-card-head">
              <span className={`priority-badge priority-${item.priority}`}>
                {PRIORITY_LABEL[item.priority]}
              </span>
              <time dateTime={item.date}>
                {new Date(item.date).toLocaleDateString('ru-RU', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </time>
            </header>
            <h3>{item.title}</h3>
            <p>{item.summary}</p>
            <footer>
              <span className="category-pill">
                <i className="fas fa-tag" />
                {item.category}
              </span>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}
