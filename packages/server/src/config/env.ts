import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load .env (secrets) and .env.local (written by `convex dev`) from the monorepo root
const root = resolve(__dirname, '../../../../');
dotenv.config({ path: resolve(root, '.env') });
dotenv.config({ path: resolve(root, '.env.local') });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  serverUrl: process.env.SERVER_URL || 'http://localhost:3001',

  // Convex persistence (optional: without it everything stays in memory)
  convexUrl: process.env.CONVEX_URL || '',
  convexServerSecret: process.env.CONVEX_SERVER_SECRET || '',

  // OAuth
  githubClientId: process.env.GITHUB_CLIENT_ID || '',
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET || '',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-change-me',
};
