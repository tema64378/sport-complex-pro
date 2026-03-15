export function notify(message, type = 'info') {
  const text = String(message || '').trim();
  if (!text) return;

  try {
    if (typeof window !== 'undefined' && typeof window.__sportProToast === 'function') {
      window.__sportProToast(text, type);
      return;
    }
  } catch (e) {}

  if (type === 'error') {
    console.error(text);
    return;
  }
  console.log(text);
}
