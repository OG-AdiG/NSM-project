'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  SESSION_STATUS_LABELS,
  SESSION_TYPE_LABELS,
  SessionStatus,
  SessionType,
} from '@nsm/shared';
import { PageHero } from '@/components/page-hero';
import { apiFetch, ApiError } from '@/lib/api';
import { getAccessToken, getStoredUser } from '@/lib/auth-storage';

type SessionRow = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
  type: SessionType;
  sessionIndex: number;
  artist?: {
    artistProfile?: { displayName: string } | null;
    firstName: string | null;
    lastName: string | null;
  };
  client?: { firstName: string | null; lastName: string | null; email: string };
  submission?: { id: string; style: string; bodyPart: string } | null;
};

type PendingSubmission = {
  id: string;
  style: string;
  bodyPart: string;
  status: string;
  finalPricePln: number | null;
};

export default function ReservationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<SessionRow[]>([]);
  const [pendingSubs, setPendingSubs] = useState<PendingSubmission[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      router.replace('/logowanie');
      return;
    }
    const user = getStoredUser();
    setLoading(true);
    try {
      const data = await apiFetch<SessionRow[]>('/sessions', { accessToken: token });
      setItems(data);

      if (user?.role === 'CLIENT' || user?.role === 'ADMIN') {
        const subs = await apiFetch<PendingSubmission[]>('/submissions', { accessToken: token });
        const bookedIds = new Set(
          data.map((s) => s.submission?.id).filter((id): id is string => Boolean(id)),
        );
        setPendingSubs(subs.filter((s) => s.status === 'ACCEPTED' && !bookedIds.has(s.id)));
      } else {
        setPendingSubs([]);
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    setRole(getStoredUser()?.role ?? null);
    load().catch((err: Error) => setError(err.message));
  }, [load]);

  async function act(id: string, action: 'cancel' | 'confirm' | 'complete') {
    const token = getAccessToken();
    if (!token) return;
    setBusy(id);
    setError(null);
    try {
      await apiFetch(`/sessions/${id}/${action}`, {
        method: 'PATCH',
        accessToken: token,
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Operacja nieudana');
    } finally {
      setBusy(null);
    }
  }

  const empty = !loading && items.length === 0 && pendingSubs.length === 0;

  return (
    <main>
      <PageHero
        eyebrow="Terminy"
        title="Rezerwacje"
        description="Umów sesję po zaakceptowanej wycenie albo sprawdź już zaplanowane wizyty w studio."
        backHref="/zgloszenia"
        backLabel="← Panel zgłoszeń"
        actions={
          <>
            {pendingSubs.length > 0 ? (
              <a
                href="#do-umowienia"
                className="inline-flex items-center justify-center rounded-soft border border-white bg-white px-4 py-2.5 text-sm font-medium text-ink no-underline transition hover:bg-white/90"
              >
                Do umówienia ({pendingSubs.length})
              </a>
            ) : null}
            <Link
              href="/zgloszenia"
              className="inline-flex items-center justify-center rounded-soft border border-white/45 bg-transparent px-4 py-2.5 text-sm font-medium text-white transition hover:border-white hover:bg-white/10"
            >
              Moje zgłoszenia
            </Link>
          </>
        }
      />

      <div className="page-wide !pt-10">
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? <p className="lede">Ładowanie…</p> : null}

      {empty ? (
        <div className="py-16 text-center">
          <p className="font-display text-2xl text-ink">Brak rezerwacji</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
            Gdy zaakceptujesz wycenę, tu pojawi się termin do umówienia albo potwierdzona sesja.
          </p>
          <Link href="/zgloszenia" className="btn-primary mt-6 inline-flex">
            Przejdź do zgłoszeń
          </Link>
        </div>
      ) : null}

      {!loading && pendingSubs.length > 0 ? (
        <section id="do-umowienia" className="scroll-mt-24">
          <h2 className="section-title">Do umówienia</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Wycena zaakceptowana — wybierz termin w zgłoszeniu.
          </p>
          <ul className="mt-5">
            {pendingSubs.map((s) => (
              <li key={s.id} className="border-b border-paper-line first:border-t">
                <div className="flex flex-wrap items-center justify-between gap-3 py-5">
                  <div>
                    <p className="font-display text-xl text-ink">
                      {s.style}
                      <span className="text-ink-faint"> · </span>
                      {s.bodyPart}
                    </p>
                    <p className="mt-1 text-xs text-ink-faint">
                      Do umówienia
                      {s.finalPricePln != null ? ` · ${s.finalPricePln} zł` : ''}
                    </p>
                  </div>
                  <Link href={`/zgloszenia/${s.id}`} className="btn-primary btn-sm">
                    Umów termin
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!loading && items.length > 0 ? (
        <section className={pendingSubs.length > 0 ? 'mt-12' : 'mt-10'}>
          <h2 className="section-title">Zaplanowane sesje</h2>
          <ul className="mt-5">
            {items.map((s) => {
              const artist =
                s.artist?.artistProfile?.displayName ||
                [s.artist?.firstName, s.artist?.lastName].filter(Boolean).join(' ') ||
                '—';
              const client =
                [s.client?.firstName, s.client?.lastName].filter(Boolean).join(' ') ||
                s.client?.email ||
                '—';
              return (
                <li key={s.id} className="border-b border-paper-line first:border-t">
                  <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display text-xl text-ink">
                          {SESSION_TYPE_LABELS[s.type]} #{s.sessionIndex}
                        </p>
                        <span className="status-pill">{SESSION_STATUS_LABELS[s.status]}</span>
                      </div>
                      <p className="mt-2 text-sm text-ink">
                        {new Date(s.startsAt).toLocaleString('pl-PL')} –{' '}
                        {new Date(s.endsAt).toLocaleTimeString('pl-PL', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <p className="mt-1 text-xs text-ink-faint">
                        {role === 'CLIENT' ? `Artysta: ${artist}` : `Klient: ${client}`}
                        {s.submission ? ` · ${s.submission.style} / ${s.submission.bodyPart}` : ''}
                      </p>
                      {s.submission ? (
                        <Link
                          href={`/zgloszenia/${s.submission.id}`}
                          className="link mt-2 inline-block text-xs"
                        >
                          Zgłoszenie
                        </Link>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {s.status !== 'CANCELLED' && s.status !== 'COMPLETED' ? (
                        <button
                          type="button"
                          disabled={busy === s.id}
                          onClick={() => void act(s.id, 'cancel')}
                          className="btn-danger text-xs"
                        >
                          Anuluj
                        </button>
                      ) : null}
                      {(role === 'ARTIST' || role === 'ADMIN') &&
                      s.status === 'AWAITING_DEPOSIT' ? (
                        <button
                          type="button"
                          disabled={busy === s.id}
                          onClick={() => void act(s.id, 'confirm')}
                          className="btn-text text-xs"
                        >
                          Potwierdź
                        </button>
                      ) : null}
                      {(role === 'ARTIST' || role === 'ADMIN') && s.status === 'CONFIRMED' ? (
                        <button
                          type="button"
                          disabled={busy === s.id}
                          onClick={() => void act(s.id, 'complete')}
                          className="btn-text text-xs"
                        >
                          Zakończ
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      </div>
    </main>
  );
}
