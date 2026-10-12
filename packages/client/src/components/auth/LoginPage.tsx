import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { API_BASE, OAUTH_ENABLED } from '@/services/config';

type Mode = 'signin' | 'register';
interface Providers {
  github: boolean;
  google: boolean;
}

async function postJson(path: string, body: unknown): Promise<{ token: string }> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
  return data;
}

const inputClass =
  'w-full px-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400';

export function LoginPage() {
  const setToken = useAuthStore((s) => s.setToken);
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [guestName, setGuestName] = useState('');
  const [showGuest, setShowGuest] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [providers, setProviders] = useState<Providers>({ github: false, google: false });

  useEffect(() => {
    if (!OAUTH_ENABLED) return;
    fetch(`${API_BASE}/auth/providers`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => p && setProviders({ github: !!p.github, google: !!p.google }))
      .catch(() => {});
  }, []);

  const submit = async (path: string, body: unknown) => {
    setBusy(true);
    setError('');
    try {
      const { token } = await postJson(path, body);
      if (!setToken(token)) throw new Error('Received an invalid sign-in token');
    } catch (err: any) {
      setError(err.message || 'Could not sign in');
    } finally {
      setBusy(false);
    }
  };

  const handleAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'register') {
      submit(`${API_BASE}/auth/register`, { email, password, displayName });
    } else {
      submit(`${API_BASE}/auth/login`, { email, password });
    }
  };

  const handleGuest = (e: React.FormEvent) => {
    e.preventDefault();
    if (guestName.trim()) submit(`${API_BASE}/auth/guest`, { displayName: guestName.trim() });
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError('');
  };

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="min-h-full flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-5 sm:p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-800 text-center mb-1">Fableboard</h1>
        <p className="text-sm text-gray-500 text-center mb-5">Sketch it. Sync it. Ship it.</p>

        <div className="grid grid-cols-2 mb-4 rounded-lg bg-gray-100 p-1 text-sm font-medium">
          {(['signin', 'register'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`py-1.5 rounded-md transition-colors ${
                mode === m ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {m === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        {error && (
          <div role="alert" className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded mb-3">
            {error}
          </div>
        )}

        <form onSubmit={handleAccount} className="space-y-3">
          {mode === 'register' && (
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name"
              autoComplete="nickname"
              maxLength={40}
              required
              className={inputClass}
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            required
            className={inputClass}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'register' ? 'Password (8+ characters)' : 'Password'}
            autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            minLength={mode === 'register' ? 8 : undefined}
            maxLength={128}
            required
            className={inputClass}
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {busy ? 'Please wait...' : mode === 'register' ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-4 text-xs text-gray-400">
          <span className="flex-1 h-px bg-gray-200" />
          or
          <span className="flex-1 h-px bg-gray-200" />
        </div>

        {OAUTH_ENABLED && (providers.github || providers.google) && (
          <div className="space-y-2 mb-3">
            {providers.github && (
              <a
                href={`${API_BASE}/auth/github`}
                className="w-full py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center justify-center"
              >
                Continue with GitHub
              </a>
            )}
            {providers.google && (
              <a
                href={`${API_BASE}/auth/google`}
                className="w-full py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center justify-center"
              >
                Continue with Google
              </a>
            )}
          </div>
        )}

        {showGuest ? (
          <form onSubmit={handleGuest} className="space-y-2">
            <input
              autoFocus
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Your display name"
              maxLength={40}
              className={inputClass}
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Continue as guest
            </button>
            <p className="text-xs text-gray-400 text-center">
              Guests can't get back into a board they own after clearing this browser.
            </p>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowGuest(true)}
            className="w-full py-2.5 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Continue as guest
          </button>
        )}
      </div>
      </div>
    </div>
  );
}
