'use client';

import Link from 'next/link';
import { useAuth } from '@/components/auth-provider';

export function HomeHeroCtas() {
  const { ready, isAuthenticated } = useAuth();

  if (!ready) {
    return (
      <div className="hero-enter mt-8 flex flex-wrap gap-3" aria-hidden>
        <span className="h-10 w-36 rounded-soft bg-white/20" />
        <span className="h-10 w-28 rounded-soft bg-white/10" />
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="hero-enter mt-8 flex flex-wrap gap-3">
        <Link
          href="/zgloszenie"
          className="inline-flex items-center justify-center rounded-soft border border-white bg-white px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-white/90"
        >
          Nowe zgłoszenie
        </Link>
        <Link
          href="/zgloszenia"
          className="inline-flex items-center justify-center rounded-soft border border-white/45 bg-transparent px-4 py-2.5 text-sm font-medium text-white transition hover:border-white hover:bg-white/10"
        >
          Mój panel
        </Link>
      </div>
    );
  }

  return (
    <div className="hero-enter mt-8 flex flex-wrap gap-3">
      <Link
        href="/zgloszenie"
        className="inline-flex items-center justify-center rounded-soft border border-white bg-white px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-white/90"
      >
        Nowe zgłoszenie
      </Link>
      <Link
        href="/logowanie"
        className="inline-flex items-center justify-center rounded-soft border border-white/45 bg-transparent px-4 py-2.5 text-sm font-medium text-white transition hover:border-white hover:bg-white/10"
      >
        Zaloguj się
      </Link>
    </div>
  );
}
