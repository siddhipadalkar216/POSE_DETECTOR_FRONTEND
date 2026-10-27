// Empty by default so development and production can proxy /api on the same origin.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

// Auth
export async function registerUser({ username, password, email, name }) {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, email, name }),
  });
  if (!res.ok) throw new Error('Register failed');
  return res.json();
}

export async function loginUser({ username, password }) {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error('Login failed');
  return res.json();
}

export async function getProfile(token) {
  const res = await fetch(`${API_BASE_URL}/api/v1/profile`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Profile fetch failed');
  return res.json();
}

export async function updateProfile(token, payload) {
  const res = await fetch(`${API_BASE_URL}/api/v1/profile`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Profile update failed');
  return res.json();
}

export async function fetchExercises() {
  const res = await fetch(`${API_BASE_URL}/api/v1/exercises`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.exercises || [];
}

export async function fetchLogs(token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API_BASE_URL}/api/v1/logs`, { headers });
  if (!res.ok) return [];
  const data = await res.json();
  return data.logs || [];
}

export async function createLog(token, payload) {
  const res = await fetch(`${API_BASE_URL}/api/v1/logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Create log failed');
  return res.json();
}

export async function getTtsStatus() {
  const res = await fetch(`${API_BASE_URL}/api/v1/tts/status`);
  if (!res.ok) return { configured: false };
  return res.json();
}

export async function synthesizeSpeech({ text, voice }) {
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${API_BASE_URL}/api/v1/tts/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ input: text, voice }),
  });
  if (!res.ok) {
    let message = 'Speech service could not generate audio.';
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch { /* Keep the generic message for non-JSON errors. */ }
    throw new Error(message);
  }
  return res.blob();
}


