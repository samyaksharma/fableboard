import jwt from 'jsonwebtoken';
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { config } from '../config/env.js';
import { convexEnabled, convexQuery, convexMutation, convexWrite } from '../config/convex.js';
import type { User, JwtPayload, AuthProvider } from '@fableboard/shared';
import { generateId, nowISO } from '@fableboard/shared';

// In-memory user store
const users = new Map<string, User>();
const providerIndex = new Map<string, string>(); // "github:12345" → userId

export async function findOrCreateUser(profile: {
  email: string;
  displayName: string;
  avatarUrl: string;
  provider: AuthProvider;
  providerId: string;
}): Promise<User> {
  const key = `${profile.provider}:${profile.providerId}`;
  let existingId = providerIndex.get(key);

  // After a restart, recover the stable userId of returning OAuth users from Convex.
  if (!existingId && profile.provider !== 'guest' && convexEnabled) {
    try {
      const row = await convexQuery('getUserByProvider', {
        provider: profile.provider,
        providerId: profile.providerId,
      });
      if (row) {
        users.set(row.userId, {
          id: row.userId,
          email: row.email,
          displayName: row.displayName,
          avatarUrl: row.avatarUrl,
          provider: row.provider,
          providerId: row.providerId,
          createdAt: row.createdAt,
        });
        providerIndex.set(key, row.userId);
        existingId = row.userId;
      }
    } catch (err) {
      console.error('Convex getUserByProvider failed:', err instanceof Error ? err.message : err);
    }
  }

  if (existingId) {
    const user = users.get(existingId)!;
    // Update mutable fields
    user.displayName = profile.displayName;
    user.avatarUrl = profile.avatarUrl;
    user.email = profile.email;
    persistUser(user);
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
  persistUser(user);
  return user;
}

// Guests are ephemeral (their id lives in the JWT), so only OAuth users are stored.
function persistUser(user: User) {
  if (!convexEnabled || user.provider === 'guest') return;
  convexWrite('upsertUser', {
    userId: user.id,
    provider: user.provider,
    providerId: user.providerId,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  });
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

// --- Email + password accounts ---

// scrypt (memory-hard, built into Node). Stored as scrypt$N$r$p$salt$hash.
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, keylen: 64, maxmem: 128 * 1024 * 1024 };

function scryptAsync(password: string, salt: Buffer, p: typeof SCRYPT): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      p.keylen,
      { N: p.N, r: p.r, p: p.p, maxmem: p.maxmem },
      (err, key) => (err ? reject(err) : resolve(key)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, N, r, p, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const params = { N: Number(N), r: Number(r), p: Number(p), keylen: expected.length, maxmem: SCRYPT.maxmem };
  const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'), params);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Verifying against this when an email is unknown keeps "no such account" and
// "wrong password" indistinguishable by response time.
let dummyHash: Promise<string> | null = null;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword('not-a-real-password');
  await verifyPassword(password, await dummyHash);
}

const passwordHashes = new Map<string, string>(); // userId -> hash

function rowToUser(row: any): User {
  return {
    id: row.userId,
    email: row.email,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    provider: row.provider,
    providerId: row.providerId,
    createdAt: row.createdAt,
  };
}

/** Throws if Convex is configured but unreachable (callers answer 503, never "no such user"). */
export async function findPasswordAccount(email: string): Promise<{ user: User; hash: string } | null> {
  const key = `password:${email}`;
  let id = providerIndex.get(key);
  if (!id && convexEnabled) {
    const row = await convexQuery('getUserByProvider', { provider: 'password', providerId: email });
    if (row?.passwordHash) {
      users.set(row.userId, rowToUser(row));
      providerIndex.set(key, row.userId);
      passwordHashes.set(row.userId, row.passwordHash);
      id = row.userId;
    }
  }
  if (!id) return null;
  const user = users.get(id);
  const hash = passwordHashes.get(id);
  return user && hash ? { user, hash } : null;
}

/** Create an account. Returns null if the email is already registered. */
export async function registerPasswordUser(
  email: string,
  password: string,
  displayName: string,
): Promise<User | null> {
  if (await findPasswordAccount(email)) return null;
  const hash = await hashPassword(password);
  const user: User = {
    id: generateId(),
    email,
    displayName,
    avatarUrl: '',
    provider: 'password',
    providerId: email,
    createdAt: nowISO(),
  };

  if (convexEnabled) {
    // The mutation is the arbiter if two sign-ups race (or another server instance exists).
    const res = await convexMutation<{ created: boolean }>('registerPasswordUser', {
      userId: user.id,
      email,
      displayName,
      passwordHash: hash,
      createdAt: user.createdAt,
    });
    if (!res.created) return null;
  } else if (providerIndex.has(`password:${email}`)) {
    return null; // no await since the hash: this check and the set below are atomic
  }

  users.set(user.id, user);
  providerIndex.set(`password:${email}`, user.id);
  passwordHashes.set(user.id, hash);
  return user;
}
