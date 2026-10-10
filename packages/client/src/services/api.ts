const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('fableboard_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string>) },
  });

  if (res.status === 401) {
    localStorage.removeItem('fableboard_token');
    window.location.reload();
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export function createSession(title: string, ownerName: string) {
  return request<{
    session: { id: string; title: string; ownerId: string };
    participant: { id: string; displayName: string; color: string; role: string };
  }>('/sessions', {
    method: 'POST',
    body: JSON.stringify({ title, ownerName }),
  });
}

export function getSession(sessionId: string) {
  return request<{
    session: { id: string; title: string; ownerId: string };
    participants: Array<{ id: string; displayName: string; color: string; role: string }>;
  }>(`/sessions/${sessionId}`);
}

export function joinSession(sessionId: string, displayName: string) {
  return request<{
    participant: { id: string; displayName: string; color: string; role: string };
  }>(`/sessions/${sessionId}/join`, {
    method: 'POST',
    body: JSON.stringify({ displayName }),
  });
}

export function exportSessionJSON(sessionId: string) {
  return request<unknown>(`/sessions/${sessionId}/export/json`);
}

export function updateParticipantRole(
  sessionId: string,
  participantId: string,
  role: string,
) {
  return request<void>(`/sessions/${sessionId}/participants/${participantId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export async function deleteSession(sessionId: string) {
  const token = localStorage.getItem('fableboard_token');
  const res = await fetch(`${BASE}/sessions/${sessionId}`, {
    method: 'DELETE',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
}
