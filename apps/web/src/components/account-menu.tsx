'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { clearSession, getRefreshToken, StoredUser } from '@/lib/auth-storage';

type Props = {
  user: StoredUser | null;
};

export function AccountMenu({ user }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.email?.split('@')[0] ||
    'Konto';

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function logout() {
    setOpen(false);
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
      router.refresh();
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="nav-link inline-flex items-center gap-1.5 text-ink"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <span>Konto</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          aria-hidden
          className={`transition duration-150 ${open ? 'rotate-180' : ''}`}
        >
          <path
            d="M2.5 4.25 6 7.75l3.5-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-[calc(100%+0.55rem)] z-50 w-56 overflow-hidden border border-paper-line bg-paper-pure py-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.08)]"
        >
          <div className="border-b border-paper-line px-3.5 pb-2.5 pt-1.5">
            <p className="truncate text-sm font-medium text-ink">{displayName}</p>
            <p className="mt-0.5 truncate text-xs text-ink-faint">{user?.email}</p>
          </div>

          <Link
            href="/profil"
            role="menuitem"
            className="block px-3.5 py-2.5 text-sm text-ink no-underline transition hover:bg-paper-soft"
            onClick={() => setOpen(false)}
          >
            Profil
          </Link>
          <Link
            href="/ustawienia"
            role="menuitem"
            className="block px-3.5 py-2.5 text-sm text-ink no-underline transition hover:bg-paper-soft"
            onClick={() => setOpen(false)}
          >
            Ustawienia
          </Link>
          <Link
            href="/zgloszenia"
            role="menuitem"
            className="block px-3.5 py-2.5 text-sm text-ink no-underline transition hover:bg-paper-soft"
            onClick={() => setOpen(false)}
          >
            Panel
          </Link>
          <Link
            href="/rezerwacje"
            role="menuitem"
            className="block px-3.5 py-2.5 text-sm text-ink no-underline transition hover:bg-paper-soft"
            onClick={() => setOpen(false)}
          >
            Rezerwacje
          </Link>
          {(user?.role === 'ARTIST' || user?.role === 'ADMIN') && (
            <Link
              href="/grafik"
              role="menuitem"
              className="block px-3.5 py-2.5 text-sm text-ink no-underline transition hover:bg-paper-soft"
              onClick={() => setOpen(false)}
            >
              Grafik
            </Link>
          )}

          <div className="mt-1 border-t border-paper-line pt-1">
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3.5 py-2.5 text-left text-sm text-ink-muted transition hover:bg-paper-soft hover:text-ink"
              onClick={() => void logout()}
            >
              Wyloguj
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
