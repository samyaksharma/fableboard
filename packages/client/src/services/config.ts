// Empty means same-origin (dev proxy / single host). Set VITE_SERVER_URL when the API lives elsewhere.
export const SERVER_URL = ((import.meta.env.VITE_SERVER_URL as string | undefined) ?? '').replace(/\/$/, '');
export const API_BASE = `${SERVER_URL}/api`;

// GitHub/Google buttons are hidden unless the client is built with VITE_ENABLE_OAUTH=true.
export const OAUTH_ENABLED = import.meta.env.VITE_ENABLE_OAUTH === 'true';
