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

/** Pasted values often carry surrounding whitespace or quotes ("abc", 'abc'). */
export function cleanEnvValue(raw: string | undefined): string {
  return (raw ?? '').trim().replace(/^(["'])(.*)\1$/, '$2').trim();
}

/**
 * Normalise CONVEX_URL to the bare deployment origin. A trailing slash, whitespace, quotes or an
 * "/api" suffix all make requests fail at the network level, and http:// is not served by Convex.
 */
export function normalizeConvexUrl(raw: string | undefined): string {
  const value = cleanEnvValue(raw);
  if (!value) return '';
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (url.hostname.endsWith('.convex.cloud')) url.protocol = 'https:';
    return url.origin;
  } catch {
    return withScheme;
  }
}
