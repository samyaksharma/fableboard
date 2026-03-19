import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import type { User, JwtPayload, AuthProvider } from '@fableboard/shared';
import { generateId, nowISO } from '@fableboard/shared';

// In-memory user store
const users = new Map<string, User>();
const providerIndex = new Map<string, string>(); // "github:12345" → userId

export function findOrCreateUser(profile: {
  email: string;
  displayName: string;
  avatarUrl: string;
  provider: AuthProvider;
  providerId: string;
}): User {
  const key = `${profile.provider}:${profile.providerId}`;
  const existingId = providerIndex.get(key);

  if (existingId) {
    const user = users.get(existingId)!;
    // Update mutable fields
    user.displayName = profile.displayName;
    user.avatarUrl = profile.avatarUrl;
    user.email = profile.email;
    return user;
  }

  const user: User = {
    id: generateId(),
    email: profile.email,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    provider: profile.provider,
    providerId: profile.providerId,
    createdAt: nowISO(),
  };

  users.set(user.id, user);
  providerIndex.set(key, user.id);
  return user;
}

export function findUserById(userId: string): User | null {
  return users.get(userId) ?? null;
}

export function signToken(user: User): string {
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    provider: user.provider,
  };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
}

// --- GitHub OAuth ---

export async function exchangeGithubCode(code: string): Promise<string> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: config.githubClientId,
      client_secret: config.githubClientSecret,
      code,
    }),
  });

  const data = (await res.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!data.access_token) {
    const msg = data.error_description || data.error || 'Failed to exchange GitHub code';
    console.error('GitHub token exchange failed:', data);
    throw new Error(msg);
  }
  return data.access_token;
}

export async function getGithubUser(accessToken: string) {
  const [userRes, emailsRes] = await Promise.all([
    fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'Fableboard' },
    }),
    fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'Fableboard' },
    }),
  ]);

  const user = (await userRes.json()) as {
    id: number;
    login: string;
    name: string | null;
    avatar_url: string;
  };

  const emails = (await emailsRes.json()) as Array<{
    email: string;
    primary: boolean;
    verified: boolean;
  }>;

  const primaryEmail =
    emails.find((e) => e.primary && e.verified)?.email ??
    emails.find((e) => e.verified)?.email ??
    emails[0]?.email ??
    '';

  return {
    providerId: String(user.id),
    displayName: user.name || user.login,
    email: primaryEmail,
    avatarUrl: user.avatar_url,
  };
}

// --- Google OAuth ---

export async function exchangeGoogleCode(code: string): Promise<string> {
  const redirectUri = `${config.serverUrl}/api/auth/google/callback`;
  console.log('Google token exchange redirect_uri:', redirectUri);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const data = (await res.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!data.access_token) {
    const msg = data.error_description || data.error || 'Failed to exchange Google code';
    console.error('Google token exchange failed:', data);
    throw new Error(msg);
  }
  return data.access_token;
}

export async function getGoogleUser(accessToken: string) {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const user = (await res.json()) as {
    id: string;
    email: string;
    name: string;
    picture: string;
  };

  return {
    providerId: user.id,
    displayName: user.name,
    email: user.email,
    avatarUrl: user.picture || '',
  };
}
