import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

export function AuthCallback() {
  const [error, setError] = useState<string | null>(null);
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const errorParam = params.get('error');

    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      return;
    }

    if (!token) {
      setError('No token received');
      return;
    }

    // Decode and store
    try {
      const base64 = token.split('.')[1];
      const payload = JSON.parse(atob(base64));
      setAuth(token, {
        userId: payload.userId,
        email: payload.email,
        displayName: payload.displayName,
        avatarUrl: payload.avatarUrl,
        provider: payload.provider,
      });
      // Redirect to home
      window.location.replace('/');
    } catch {
      setError('Invalid token');
    }
  }, [setAuth]);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white rounded-xl shadow-lg p-8 w-96 text-center">
          <h1 className="text-xl font-bold text-gray-800 mb-2">Authentication Error</h1>
          <p className="text-sm text-red-600 mb-4">{error}</p>
          <a
            href="/"
            className="inline-block px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600"
          >
            Back to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-xl shadow-lg p-8 w-96 text-center">
        <p className="text-sm text-gray-500">Signing in...</p>
      </div>
    </div>
  );
}
