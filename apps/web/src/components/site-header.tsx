'use client';

import Link from 'next/link';
import { AccountMenu } from '@/components/account-menu';
import { useAuth } from '@/components/auth-provider';

export function SiteHeader() {
  const { ready, isAuthenticated, user } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-paper-line/80 bg-paper/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link href="/" className="font-display text-[1.35rem] tracking-tight text-ink">
          NSM
        </Link>
        <nav className="flex min-h-8 items-center gap-5" aria-busy={!ready}>
          {!ready ? (
            <div className="flex items-center gap-3" aria-hidden>
              <span className="h-3 w-16 rounded-sm bg-paper-line/80" />
              <span className="h-3 w-14 rounded-sm bg-paper-line/80" />
              <span className="h-8 w-20 rounded-soft bg-paper-line/80" />
            </div>
          ) : isAuthenticated ? (
            <>
              <Link href="/zgloszenia" className="nav-link">
                Zgłoszenia
              </Link>
              <Link href="/rezerwacje" className="nav-link">
                Rezerwacje
              </Link>
              {(user?.role === 'ARTIST' || user?.role === 'ADMIN') && (
                <Link href="/grafik" className="nav-link">
                  Grafik
                </Link>
              )}
              <AccountMenu user={user} />
            </>
          ) : (
            <>
              <Link href="/logowanie" className="nav-link">
                Logowanie
              </Link>
              <Link href="/rejestracja" className="btn-primary btn-sm">
                Rejestracja
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
