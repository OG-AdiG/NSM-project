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

export const AUTH_EVENT = 'nsm-auth';

function canUseStorage() {
  return typeof window !== 'undefined';
}

function notifyAuthChange() {
  if (!canUseStorage()) return;
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function saveSession(accessToken: string, refreshToken: string, user: StoredUser) {
  if (!canUseStorage()) return;
  localStorage.setItem(ACCESS, accessToken);
  localStorage.setItem(REFRESH, refreshToken);
  localStorage.setItem(USER, JSON.stringify(user));
  notifyAuthChange();
}

export function clearSession() {
  if (!canUseStorage()) return;
  localStorage.removeItem(ACCESS);
  localStorage.removeItem(REFRESH);
  localStorage.removeItem(USER);
  notifyAuthChange();
}

export function getAccessToken() {
  if (!canUseStorage()) return null;
  return localStorage.getItem(ACCESS);
}

export function getRefreshToken() {
  if (!canUseStorage()) return null;
  return localStorage.getItem(REFRESH);
}

export function getStoredUser(): StoredUser | null {
  if (!canUseStorage()) return null;
  const raw = localStorage.getItem(USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

export function readSession() {
  return {
    accessToken: getAccessToken(),
    refreshToken: getRefreshToken(),
    user: getStoredUser(),
  };
}
