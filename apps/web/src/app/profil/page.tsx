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

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace('/logowanie');
      return;
    }
    setUser(getStoredUser());
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
    return (
      <main className="page-narrow">
        <p className="lede">Ładowanie…</p>
      </main>
    );
  }

  if (error || !user) {
    return (
      <main className="page-narrow">
        <p className="alert">{error ?? 'Brak sesji'}</p>
        <Link href="/logowanie" className="btn-text mt-4">
          Zaloguj się
        </Link>
      </main>
    );
  }

  return (
    <main className="page-narrow">
      <header className="border-b border-paper-line pb-8">
        <Link href="/zgloszenia" className="back-link">
          ← Panel
        </Link>
        <h1 className="font-display mt-3 text-4xl tracking-tight text-ink">Profil</h1>
        <p className="mt-2 text-sm text-ink-muted">Dane Twojego konta.</p>
      </header>

      <dl className="mt-8 space-y-6 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-[0.08em] text-ink-faint">Imię i nazwisko</dt>
          <dd className="mt-1.5 text-ink">
            {[user.firstName, user.lastName].filter(Boolean).join(' ') || 'Nie podano'}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.08em] text-ink-faint">E-mail</dt>
          <dd className="mt-1.5 text-ink">{user.email}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.08em] text-ink-faint">Weryfikacja</dt>
          <dd className="mt-1.5 text-ink">
            {user.emailVerifiedAt ? 'Adres potwierdzony' : 'E-mail niepotwierdzony'}
          </dd>
        </div>
      </dl>

      <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-paper-line pt-8">
        <Link href="/zgloszenia" className="btn-ghost">
          Wróć do panelu
        </Link>
        <button type="button" onClick={logout} className="btn-danger">
          Wyloguj się
        </button>
      </div>
    </main>
  );
}
