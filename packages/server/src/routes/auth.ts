import express, { Router, type Router as ExpressRouter } from 'express';
import { config } from '../config/env.js';
import * as authService from '../services/authService.js';
import { generateId } from '@fableboard/shared';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { registerSchema, loginSchema } from '@fableboard/shared';

const router: ExpressRouter = Router();

// --- Which sign-in methods are available (lets the client hide unconfigured buttons) ---

router.get('/auth/providers', (_req, res) => {
  res.json({
    password: true,
    guest: true,
    github: Boolean(config.githubClientId && config.githubClientSecret),
    google: Boolean(config.googleClientId && config.googleClientSecret),
  });
});

// --- Email + password ---

const credentialLimiter = rateLimit({ windowMs: 15 * 60_000, max: 30 });

// Per-email lockout on top of the per-IP limit, so guessing can't be spread across IPs.
const MAX_FAILURES = 8;
const LOCK_MS = 15 * 60_000;
const failures = new Map<string, { count: number; resetAt: number }>();

function isLocked(email: string): boolean {
  const f = failures.get(email);
  if (!f) return false;
  if (f.resetAt < Date.now()) {
    failures.delete(email);
    return false;
  }
  return f.count >= MAX_FAILURES;
}

function recordFailure(email: string) {
  const f = failures.get(email);
  if (!f || f.resetAt < Date.now()) failures.set(email, { count: 1, resetAt: Date.now() + LOCK_MS });
  else f.count++;
}

router.post('/auth/register', credentialLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });
    return;
  }
  const { email, password, displayName } = parsed.data;
  try {
    const user = await authService.registerPasswordUser(email, password, displayName);
    if (!user) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }
    res.status(201).json({ token: authService.signToken(user) });
  } catch (err) {
    console.error('Register failed:', err instanceof Error ? err.message : err);
    res.status(503).json({ error: 'Sign-up is temporarily unavailable' });
  }
});

router.post('/auth/login', credentialLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Enter your email and password' });
    return;
  }
  const { email, password } = parsed.data;
  if (isLocked(email)) {
    res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes.' });
    return;
  }
  try {
    const account = await authService.findPasswordAccount(email);
    const ok = account
      ? await authService.verifyPassword(password, account.hash)
      : (await authService.burnPasswordCheck(password), false);
    if (!ok || !account) {
      recordFailure(email);
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }
    failures.delete(email);
    res.json({ token: authService.signToken(account.user) });
  } catch (err) {
    console.error('Login failed:', err instanceof Error ? err.message : err);
    res.status(503).json({ error: 'Sign-in is temporarily unavailable' });
  }
});

// --- GitHub ---

router.get('/auth/github', (_req, res) => {
  if (!config.githubClientId || !config.githubClientSecret) {
    res.redirect(`${config.clientUrl}/auth/callback?error=github_not_configured`);
    return;
  }
  const params = new URLSearchParams({
    client_id: config.githubClientId,
    redirect_uri: `${config.serverUrl}/api/auth/github/callback`,
    scope: 'read:user user:email',
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

router.get('/auth/github/callback', async (req, res) => {
  const code = req.query.code as string | undefined;
  if (!code) {
    res.redirect(`${config.clientUrl}/auth/callback?error=missing_code`);
    return;
  }

  try {
    const accessToken = await authService.exchangeGithubCode(code);
    const profile = await authService.getGithubUser(accessToken);
    const user = await authService.findOrCreateUser({ ...profile, provider: 'github' });
    const token = authService.signToken(user);
    res.redirect(`${config.clientUrl}/auth/callback?token=${token}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'oauth_failed';
    console.error('GitHub OAuth error:', message);
    res.redirect(`${config.clientUrl}/auth/callback?error=${encodeURIComponent(message)}`);
  }
});

// --- Google ---

router.get('/auth/google', (_req, res) => {
  if (!config.googleClientId || !config.googleClientSecret) {
    res.redirect(`${config.clientUrl}/auth/callback?error=google_not_configured`);
    return;
  }
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: `${config.serverUrl}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get('/auth/google/callback', async (req, res) => {
  const code = req.query.code as string | undefined;
  if (!code) {
    res.redirect(`${config.clientUrl}/auth/callback?error=missing_code`);
    return;
  }

  try {
    const accessToken = await authService.exchangeGoogleCode(code);
    const profile = await authService.getGoogleUser(accessToken);
    const user = await authService.findOrCreateUser({ ...profile, provider: 'google' });
    const token = authService.signToken(user);
    res.redirect(`${config.clientUrl}/auth/callback?token=${token}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'oauth_failed';
    console.error('Google OAuth error:', message);
    res.redirect(`${config.clientUrl}/auth/callback?error=${encodeURIComponent(message)}`);
  }
});

// --- Guest (no OAuth required) ---

router.post('/auth/guest', express.json(), async (req, res) => {
  const displayName = String(req.body?.displayName ?? '').trim().slice(0, 40);
  if (!displayName) {
    res.status(400).json({ error: 'displayName is required' });
    return;
  }
  const user = await authService.findOrCreateUser({
    email: '',
    displayName,
    avatarUrl: '',
    provider: 'guest',
    providerId: generateId(),
  });
  res.json({ token: authService.signToken(user) });
});

// --- Me ---

router.get('/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
