const API_BASE = import.meta.env.VITE_API_BASE || '/api';

function getToken() {
  try { return localStorage.getItem('auth_token'); } catch (e) { return null; }
}

async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}

async function isApiAvailable() {
  try {
    const res = await fetch(`${API_BASE}/ping`, { method: 'GET' });
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function fetchMembers() {
  const res = await apiFetch(`${API_BASE}/members`);
  if (!res.ok) throw new Error('API fetch failed');
  return res.json();
}

async function createMember(member) {
  const res = await apiFetch(`${API_BASE}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(member),
  });
  if (!res.ok) throw new Error('API create failed');
  return res.json();
}

async function updateMember(id, member) {
  const res = await apiFetch(`${API_BASE}/members/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(member),
  });
  if (!res.ok) throw new Error('API update failed');
  return res.json();
}

async function deleteMember(id) {
  const res = await apiFetch(`${API_BASE}/members/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('API delete failed');
  return res.json();
}

// Trainers
async function fetchTrainers() {
  const res = await apiFetch(`${API_BASE}/trainers`);
  if (!res.ok) throw new Error('API fetch failed');
  return res.json();
}

async function createTrainer(trainer) {
  const res = await apiFetch(`${API_BASE}/trainers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(trainer),
  });
  if (!res.ok) throw new Error('API create failed');
  return res.json();
}

async function updateTrainer(id, trainer) {
  const res = await apiFetch(`${API_BASE}/trainers/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(trainer),
  });
  if (!res.ok) throw new Error('API update failed');
  return res.json();
}

async function deleteTrainer(id) {
  const res = await apiFetch(`${API_BASE}/trainers/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('API delete failed');
  return res.json();
}

// Classes
async function fetchClasses() {
  const res = await apiFetch(`${API_BASE}/classes`);
  if (!res.ok) throw new Error('API fetch failed');
  return res.json();
}

async function fetchWorkoutTemplates() {
  const res = await apiFetch(`${API_BASE}/workout-templates`);
  if (!res.ok) throw new Error('API fetch failed');
  return res.json();
}

async function fetchWorkoutTemplate(id) {
  const res = await apiFetch(`${API_BASE}/workout-templates/${id}`);
  if (!res.ok) throw new Error('API fetch failed');
  return res.json();
}

async function createClass(cls) {
  const res = await apiFetch(`${API_BASE}/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cls),
  });
  if (!res.ok) throw new Error('API create failed');
  return res.json();
}

async function updateClass(id, cls) {
  const res = await apiFetch(`${API_BASE}/classes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cls),
  });
  if (!res.ok) throw new Error('API update failed');
  return res.json();
}

async function deleteClass(id) {
  const res = await apiFetch(`${API_BASE}/classes/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('API delete failed');
  return res.json();
}

// Bookings
async function fetchBookings() {
  const res = await apiFetch(`${API_BASE}/bookings`);
  if (!res.ok) throw new Error('API fetch failed');
  return res.json();
}

async function createBooking(b) {
  const res = await apiFetch(`${API_BASE}/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(b),
  });
  if (!res.ok) throw new Error('API create failed');
  return res.json();
}

async function updateBooking(id, b) {
  const res = await apiFetch(`${API_BASE}/bookings/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(b),
  });
  if (!res.ok) throw new Error('API update failed');
  return res.json();
}

async function deleteBooking(id) {
  const res = await apiFetch(`${API_BASE}/bookings/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('API delete failed');
  return res.json();
}

// Payments
async function fetchPayments() {
  const res = await apiFetch(`${API_BASE}/payments`);
  if (!res.ok) throw new Error('API fetch failed');
  return res.json();
}

async function createPayment(p) {
  const res = await apiFetch(`${API_BASE}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(p),
  });
  if (!res.ok) throw new Error('API create failed');
  return res.json();
}

async function updatePayment(id, p) {
  const res = await apiFetch(`${API_BASE}/payments/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(p),
  });
  if (!res.ok) throw new Error('API update failed');
  return res.json();
}

async function deletePayment(id) {
  const res = await apiFetch(`${API_BASE}/payments/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('API delete failed');
  return res.json();
}

async function fetchPaymentProviders() {
  const res = await apiFetch(`${API_BASE}/payments/providers`);
  if (!res.ok) throw new Error('API fetch failed');
  return res.json();
}

async function createMockPaymentLink(payload) {
  const res = await apiFetch(`${API_BASE}/payments/mock-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('API create failed');
  return res.json();
}

// Notifications
async function fetchNotifications() {
  const res = await apiFetch(`${API_BASE}/notifications`);
  if (!res.ok) throw new Error('API fetch failed');
  return res.json();
}

async function createNotification(payload) {
  const res = await apiFetch(`${API_BASE}/notifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('API create failed');
  return res.json();
}

async function updateNotification(id, payload) {
  const res = await apiFetch(`${API_BASE}/notifications/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('API update failed');
  return res.json();
}

async function deleteNotification(id) {
  const res = await apiFetch(`${API_BASE}/notifications/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('API delete failed');
  return res.json();
}

// Membership plans
async function fetchMemberships() {
  const res = await apiFetch(`${API_BASE}/memberships`);
  if (!res.ok) throw new Error('API fetch failed');
  return res.json();
}

async function createMembership(payload) {
  const res = await apiFetch(`${API_BASE}/memberships`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('API create failed');
  return res.json();
}

async function updateMembership(id, payload) {
  const res = await apiFetch(`${API_BASE}/memberships/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('API update failed');
  return res.json();
}

async function deleteMembership(id) {
  const res = await apiFetch(`${API_BASE}/memberships/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('API delete failed');
  return res.json();
}

// CRM notes
async function fetchCrmNotes(memberId) {
  const url = memberId ? `${API_BASE}/crm/notes?memberId=${memberId}` : `${API_BASE}/crm/notes`;
  const res = await apiFetch(url);
  if (!res.ok) throw new Error('API fetch failed');
  return res.json();
}

async function createCrmNote(payload) {
  const res = await apiFetch(`${API_BASE}/crm/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('API create failed');
  return res.json();
}

async function deleteCrmNote(id) {
  const res = await apiFetch(`${API_BASE}/crm/notes/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('API delete failed');
  return res.json();
}

// Calendar slots
async function fetchCalendarSlots() {
  const res = await apiFetch(`${API_BASE}/calendar/slots`);
  if (!res.ok) throw new Error('API fetch failed');
  return res.json();
}

async function createCalendarSlot(payload) {
  const res = await apiFetch(`${API_BASE}/calendar/slots`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('API create failed');
  return res.json();
}

async function deleteCalendarSlot(id) {
  const res = await apiFetch(`${API_BASE}/calendar/slots/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('API delete failed');
  return res.json();
}

async function createYooKassaPayment(payload) {
  const res = await apiFetch(`${API_BASE}/payments/yookassa/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('API create failed');
  return res.json();
}

async function createTinkoffInit(payload) {
  const res = await apiFetch(`${API_BASE}/payments/tinkoff/init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('API create failed');
  return res.json();
}

async function createTinkoffSbpQr(payload) {
  const res = await apiFetch(`${API_BASE}/payments/tinkoff/sbp-qr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('API create failed');
  return res.json();
}

async function createTinkoffSberpayQr(payload) {
  const res = await apiFetch(`${API_BASE}/payments/tinkoff/sberpay-qr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('API create failed');
  return res.json();
}

// Auth
async function registerUser(payload) {
  const res = await apiFetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Auth register failed');
  return res.json();
}

async function loginUser(payload) {
  const res = await apiFetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Auth login failed');
  return res.json();
}

async function logoutUser() {
  const res = await apiFetch(`${API_BASE}/auth/logout`, { method: 'POST' });
  if (!res.ok) throw new Error('Auth logout failed');
  return res.json();
}

async function fetchMe() {
  const res = await apiFetch(`${API_BASE}/auth/me`);
  if (!res.ok) throw new Error('Auth me failed');
  return res.json();
}

async function updateMyProfile(payload) {
  const body = JSON.stringify(payload || {});
  const request = (method) => apiFetch(`${API_BASE}/auth/profile`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  let res = await request('PATCH');
  if (!res.ok && [404, 405, 501].includes(res.status)) {
    res = await request('POST');
  }

  if (!res.ok) {
    let message = `Profile update failed (HTTP ${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch (e) {
      try {
        const text = (await res.text()).trim();
        if (text) message = text.slice(0, 180);
      } catch (_) {}
    }
    throw new Error(message);
  }
  return res.json();
}

async function loginVkDemo() {
  const res = await apiFetch(`${API_BASE}/auth/vk-demo`, { method: 'POST' });
  if (!res.ok) throw new Error('Auth vk demo failed');
  return res.json();
}

async function completeVkOneTap(payload) {
  const res = await apiFetch(`${API_BASE}/auth/vk/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {}),
  });
  if (!res.ok) throw new Error('Auth vk complete failed');
  return res.json();
}

// Services & Receipts
async function fetchServices() {
  const res = await apiFetch(`${API_BASE}/services`);
  if (!res.ok) throw new Error('API fetch failed');
  return res.json();
}

async function fetchReceipts() {
  const res = await apiFetch(`${API_BASE}/receipts`);
  if (!res.ok) throw new Error('API fetch failed');
  return res.json();
}

async function createReceipt(payload) {
  const res = await apiFetch(`${API_BASE}/receipts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('API create failed');
  return res.json();
}

async function updateReceipt(id, payload) {
  const res = await apiFetch(`${API_BASE}/receipts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('API update failed');
  return res.json();
}

// Deals
async function fetchDeals() {
  const res = await apiFetch(`${API_BASE}/deals`);
  if (!res.ok) throw new Error('API fetch failed');
  return res.json();
}

async function createDeal(payload) {
  const res = await apiFetch(`${API_BASE}/deals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('API create failed');
  return res.json();
}

async function updateDeal(id, payload) {
  const res = await apiFetch(`${API_BASE}/deals/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('API update failed');
  return res.json();
}

async function deleteDeal(id) {
  const res = await apiFetch(`${API_BASE}/deals/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('API delete failed');
  return res.json();
}

// Forecast
async function fetchForecast() {
  const res = await apiFetch(`${API_BASE}/forecast`);
  if (!res.ok) throw new Error('API fetch failed');
  return res.json();
}

// Search
async function searchAll(query) {
  const res = await apiFetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('API search failed');
  return res.json();
}

// Reports
async function fetchMembersReport(filters = {}) {
  let url = `${API_BASE}/reports/members`;
  const params = new URLSearchParams();
  if (filters.membership) params.append('membership', filters.membership);
  if (filters.status) params.append('status', filters.status);
  if (params.toString()) url += '?' + params.toString();
  
  const res = await apiFetch(url);
  if (!res.ok) throw new Error('Report fetch failed');
  return res.json();
}

async function fetchPaymentsReport(filters = {}) {
  let url = `${API_BASE}/reports/payments`;
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (params.toString()) url += '?' + params.toString();
  
  const res = await apiFetch(url);
  if (!res.ok) throw new Error('Report fetch failed');
  return res.json();
}

async function fetchBookingsReport(filters = {}) {
  let url = `${API_BASE}/reports/bookings`;
  const params = new URLSearchParams();
  if (filters.status) params.append('status', filters.status);
  if (params.toString()) url += '?' + params.toString();
  
  const res = await apiFetch(url);
  if (!res.ok) throw new Error('Report fetch failed');
  return res.json();
}

async function fetchSummary() {
  const res = await apiFetch(`${API_BASE}/reports/summary`);
  if (!res.ok) throw new Error('Summary fetch failed');
  return res.json();
}

async function downloadCsvReport(reportType, filters = {}) {
  let url = `${API_BASE}/reports/${reportType}?format=csv`;
  if (filters.membership) url += `&membership=${filters.membership}`;
  if (filters.status) url += `&status=${filters.status}`;

  const res = await apiFetch(url);
  if (!res.ok) throw new Error('Report download failed');
  const blob = await res.blob();
  const fileName = `${reportType}_report.csv`;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

// Users
async function fetchUsers() {
  const res = await apiFetch(`${API_BASE}/users`);
  if (!res.ok) throw new Error('Users fetch failed');
  return res.json();
}

async function createUser(payload) {
  const res = await apiFetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Users create failed');
  return res.json();
}

async function updateUser(id, payload) {
  const res = await apiFetch(`${API_BASE}/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Users update failed');
  return res.json();
}

// Analytics
async function fetchAnalytics() {
  const res = await apiFetch(`${API_BASE}/analytics/overview`);
  if (!res.ok) throw new Error('Analytics fetch failed');
  return res.json();
}

export { isApiAvailable, fetchMembers, createMember, updateMember, deleteMember,
  fetchTrainers, createTrainer, updateTrainer, deleteTrainer,
  fetchClasses, createClass, updateClass, deleteClass, fetchWorkoutTemplates, fetchWorkoutTemplate,
  fetchBookings, createBooking, updateBooking, deleteBooking,
  fetchPayments, createPayment, updatePayment, deletePayment,
  registerUser, loginUser, logoutUser, fetchMe, loginVkDemo,
  updateMyProfile,
  fetchServices, fetchReceipts, createReceipt, updateReceipt,
  fetchDeals, createDeal, updateDeal, deleteDeal, fetchForecast, searchAll,
  fetchMembersReport, fetchPaymentsReport, fetchBookingsReport, fetchSummary, downloadCsvReport,
  fetchPaymentProviders, createMockPaymentLink,
  createYooKassaPayment, createTinkoffInit, createTinkoffSbpQr, createTinkoffSberpayQr,
  fetchUsers, createUser, updateUser, fetchAnalytics, completeVkOneTap,
  fetchNotifications, createNotification, updateNotification, deleteNotification,
  fetchMemberships, createMembership, updateMembership, deleteMembership,
  fetchCrmNotes, createCrmNote, deleteCrmNote,
  fetchCalendarSlots, createCalendarSlot, deleteCalendarSlot };
