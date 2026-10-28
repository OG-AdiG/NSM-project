'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  StoredUser,
} from '@/lib/auth-storage';

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    const cached = getStoredUser();
    if (!token) {
      router.replace('/logowanie');
      return;
    }
    setUser(cached);
    apiFetch<StoredUser>('/auth/me', { accessToken: token })
      .then(setUser)
      .catch(() => setError('Sesja wygasła. Zaloguj się ponownie.'))
      .finally(() => setLoading(false));
  }, [router]);

  async function logout() {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) {
        await apiFetch('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
      }
    } finally {
      clearSession();
      router.push('/');
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-lg px-6 py-16 text-neutral-600">Ładowanie…</main>;
  }

  if (error || !user) {
    return (
      <main className="mx-auto max-w-lg px-6 py-16">
        <p className="text-red-700">{error ?? 'Brak sesji'}</p>
        <Link href="/logowanie" className="mt-4 inline-block underline">
          Zaloguj się
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-6 py-16">
      <div>
        <Link href="/" className="text-sm text-neutral-500">
          ← Strona główna
        </Link>
        <h1 className="mt-2 text-3xl font-semibold">Twoje konto</h1>
      </div>
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-neutral-500">E-mail</dt>
          <dd className="font-medium">{user.email}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Rola</dt>
          <dd className="font-medium">{user.role}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Imię i nazwisko</dt>
          <dd className="font-medium">
            {[user.firstName, user.lastName].filter(Boolean).join(' ') || '—'}
          </dd>
        </div>
      </dl>
      <button
        type="button"
        onClick={logout}
        className="w-fit rounded border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100"
      >
        Wyloguj
      </button>
    </main>
  );
}
