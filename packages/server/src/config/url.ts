/**
 * Normalise a configured origin/URL. Browsers send `Origin` without a trailing slash and CORS
 * compares it as an exact string, so "https://app.vercel.app/" would never match. A bare host
 * gets a scheme (http for localhost, https otherwise).
 */
export function normalizeOrigin(raw: string | undefined, fallback = ''): string {
  let url = (raw ?? '').trim().replace(/\/+$/, '');
  if (!url) return fallback;
  if (!/^https?:\/\//i.test(url)) {
    url = `${/^(localhost|127\.0\.0\.1)(:|$)/i.test(url) ? 'http' : 'https'}://${url}`;
  }
  return url;
}
