import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { cleanEnvValue, normalizeConvexUrl, normalizeOrigin } from './url.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '../../../../');
dotenv.config({ path: resolve(root, '.env') });
dotenv.config({ path: resolve(root, '.env.local') });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  // Number of reverse proxies in front of the server (Railway: 1). Needed for correct client IPs.
  trustProxy: process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : 0,
  clientUrl: normalizeOrigin(process.env.CLIENT_URL, 'http://localhost:5173'),
  serverUrl: normalizeOrigin(process.env.SERVER_URL, 'http://localhost:3001'),

  convexUrl: normalizeConvexUrl(process.env.CONVEX_URL),
  convexServerSecret: cleanEnvValue(process.env.CONVEX_SERVER_SECRET),

  githubClientId: process.env.GITHUB_CLIENT_ID || '',
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET || '',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',

  jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-change-me',
};
