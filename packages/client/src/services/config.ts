// Empty means same-origin (dev proxy / single host). Set VITE_SERVER_URL when the API lives elsewhere.
export const SERVER_URL = ((import.meta.env.VITE_SERVER_URL as string | undefined) ?? '').replace(/\/$/, '');
export const API_BASE = `${SERVER_URL}/api`;
