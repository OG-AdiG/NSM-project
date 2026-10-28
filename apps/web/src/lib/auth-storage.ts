'use client';

export type StoredUser = {
  id: string;
  email: string;
  role: 'CLIENT' | 'ARTIST' | 'ADMIN';
  firstName: string | null;
  lastName: string | null;
  emailVerifiedAt: string | null;
};

const ACCESS = 'nsm_access';
const REFRESH = 'nsm_refresh';
const USER = 'nsm_user';

export function saveSession(accessToken: string, refreshToken: string, user: StoredUser) {
  localStorage.setItem(ACCESS, accessToken);
  localStorage.setItem(REFRESH, refreshToken);
  localStorage.setItem(USER, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(ACCESS);
  localStorage.removeItem(REFRESH);
  localStorage.removeItem(USER);
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH);
}

export function getStoredUser(): StoredUser | null {
  const raw = localStorage.getItem(USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}
