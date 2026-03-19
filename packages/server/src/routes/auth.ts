import { Router } from 'express';
import { config } from '../config/env.js';
import * as authService from '../services/authService.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

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
    const user = authService.findOrCreateUser({ ...profile, provider: 'github' });
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
    const user = authService.findOrCreateUser({ ...profile, provider: 'google' });
    const token = authService.signToken(user);
    res.redirect(`${config.clientUrl}/auth/callback?token=${token}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'oauth_failed';
    console.error('Google OAuth error:', message);
    res.redirect(`${config.clientUrl}/auth/callback?error=${encodeURIComponent(message)}`);
  }
});

// --- Me ---

router.get('/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
