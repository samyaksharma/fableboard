/**
 * Normalise VITE_SERVER_URL. A value without a scheme ("my-app.up.railway.app") would be
 * treated by the browser as a path relative to the page, so the requests would go to the
 * client's own host. A trailing slash or "/api" is stripped because callers append "/api".
 */
export function normalizeServerUrl(raw: string | undefined): string {
  let url = (raw ?? '').trim().replace(/\/+$/, '').replace(/\/api$/i, '');
  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url;
}
