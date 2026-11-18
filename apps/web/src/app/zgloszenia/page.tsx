'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react';
import {
  SUBMISSION_STATUS_LABELS,
  SUBMISSION_STATUSES,
  SubmissionStatus,
} from '@nsm/shared';
import { useAuth } from '@/components/auth-provider';
import { PageHero } from '@/components/page-hero';
import { apiFetch, ApiError } from '@/lib/api';
import { getAccessToken, StoredUser } from '@/lib/auth-storage';

type SubmissionListItem = {
  id: string;
  bodyPart: string;
  style: string;
  status: SubmissionStatus;
  createdAt: string;
  estimateMinPln: number | null;
  estimateMaxPln: number | null;
  finalPricePln: number | null;
  preferredArtistId: string | null;
  canHardDelete?: boolean;
  canArchive?: boolean;
  preferredArtist?: {
    artistProfile?: { displayName: string } | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
  client?: {
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
};

type HubAction = {
  href: string;
  title: string;
  description: string;
  primary?: boolean;
};

function hubActions(role: StoredUser['role']): HubAction[] {
  if (role === 'ARTIST') {
    return [
      {
        href: '#lista',
        title: 'Moje zgłoszenia',
        description: 'Przeglądaj przypisane zapytania i odpowiadaj na wyceny.',
        primary: true,
      },
      {
        href: '/rezerwacje',
        title: 'Rezerwacje',
        description: 'Nadchodzące sesje i statusy terminów.',
      },
      {
        href: '/grafik',
        title: 'Grafik',
        description: 'Godziny pracy i nieobecności.',
      },
    ];
  }

  if (role === 'ADMIN') {
    return [
      {
        href: '/zgloszenie',
        title: 'Nowe zgłoszenie',
        description: 'Utwórz zgłoszenie testowe lub w imieniu klienta.',
        primary: true,
      },
      {
        href: '#lista',
        title: 'Wszystkie zgłoszenia',
        description: 'Kolejka studia — statusy, przypisania, archiwum.',
      },
      {
        href: '/rezerwacje',
        title: 'Rezerwacje',
        description: 'Sesje do potwierdzenia i terminy w studio.',
      },
    ];
  }

  return [
    {
      href: '/zgloszenie',
      title: 'Nowe zgłoszenie',
      description: 'Opisz motyw, dołącz referencje i wybierz termin.',
      primary: true,
    },
    {
      href: '#lista',
      title: 'Moje zgłoszenia',
      description: 'Statusy, wyceny i wiadomości od artysty.',
    },
    {
      href: '/rezerwacje',
      title: 'Rezerwacje',
      description: 'Umówione sesje i terminy do potwierdzenia.',
    },
  ];
}

function listTitle(role: StoredUser['role'] | undefined, unassigned: boolean, archived: boolean) {
  if (archived) return 'Archiwum';
  if (unassigned) return 'Bez artysty';
  if (role === 'ARTIST') return 'Przypisane zgłoszenia';
  if (role === 'ADMIN') return 'Wszystkie zgłoszenia';
  return 'Moje zgłoszenia';
}

function formatPrice(item: SubmissionListItem) {
  if (item.finalPricePln != null) return `${item.finalPricePln} zł`;
  if (item.estimateMinPln != null && item.estimateMaxPln != null) {
    return `ok. ${item.estimateMinPln}–${item.estimateMaxPln} zł`;
  }
  return null;
}

function sideLabel(item: SubmissionListItem, role: StoredUser['role'] | undefined) {
  if (role === 'ARTIST' || role === 'ADMIN') {
    return (
      [item.client?.firstName, item.client?.lastName].filter(Boolean).join(' ') ||
      item.client?.email ||
      null
    );
  }
  return (
    item.preferredArtist?.artistProfile?.displayName ||
    [item.preferredArtist?.firstName, item.preferredArtist?.lastName].filter(Boolean).join(' ') ||
    null
  );
}

export default function SubmissionsHubPage() {
  const router = useRouter();
  const { ready, isAuthenticated, user } = useAuth();
  const [items, setItems] = useState<SubmissionListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | 'ALL'>('ALL');
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [archived, setArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingBook, setPendingBook] = useState(0);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      router.replace('/logowanie');
      return;
    }
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (unassignedOnly) params.set('unassigned', '1');
    if (archived) params.set('archived', '1');
    const qs = params.toString();
    try {
      const [data, sessions] = await Promise.all([
        apiFetch<SubmissionListItem[]>(`/submissions${qs ? `?${qs}` : ''}`, {
          accessToken: token,
        }),
        apiFetch<Array<{ submission?: { id: string } | null }>>('/sessions', {
          accessToken: token,
        }).catch(() => []),
      ]);
      setItems(data);
      const booked = new Set(
        sessions.map((s) => s.submission?.id).filter((id): id is string => Boolean(id)),
      );
      setPendingBook(data.filter((s) => s.status === 'ACCEPTED' && !booked.has(s.id)).length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd ładowania');
    } finally {
      setLoading(false);
    }
  }, [archived, router, unassignedOnly]);

  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) {
      router.replace('/logowanie');
      return;
    }
    void load();
  }, [ready, isAuthenticated, load, router]);

  const filtered = useMemo(
    () => (statusFilter === 'ALL' ? items : items.filter((i) => i.status === statusFilter)),
    [items, statusFilter],
  );

  async function onRemove(id: string, mode: 'hard' | 'archive', e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const ok =
      mode === 'archive'
        ? confirm('Przenieść zgłoszenie do archiwum?')
        : confirm('Trwale usunąć zgłoszenie? Tej operacji nie cofniesz.');
    if (!ok) return;
    const token = getAccessToken();
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/submissions/${id}?mode=${mode}`, {
        method: 'DELETE',
        accessToken: token,
      });
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nie udało się wykonać operacji');
    } finally {
      setBusyId(null);
    }
  }

  const canCreate = user?.role === 'CLIENT' || user?.role === 'ADMIN';
  const isAdmin = user?.role === 'ADMIN';
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.email?.split('@')[0] ||
    '…';
  const actions = user ? hubActions(user.role) : [];
  const primary = actions.find((a) => a.primary) ?? actions[0];
  const secondary = actions.filter((a) => a !== primary);

  if (!ready || !isAuthenticated) {
    return (
      <main className="page-wide">
        <p className="lede">Ładowanie…</p>
      </main>
    );
  }

  return (
    <main>
      <PageHero
        eyebrow="Panel użytkownika"
        title={`Cześć, ${displayName}`}
        description="Zgłoszenia, wyceny i terminy — wszystko, czego potrzebujesz do projektu w studio."
        actions={
          <>
            {canCreate ? (
              <Link
                href="/zgloszenie"
                className="inline-flex items-center justify-center rounded-soft border border-white bg-white px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-white/90"
              >
                Nowe zgłoszenie
              </Link>
            ) : null}
            <Link
              href="/rezerwacje"
              className="inline-flex items-center justify-center rounded-soft border border-white/45 bg-transparent px-4 py-2.5 text-sm font-medium text-white transition hover:border-white hover:bg-white/10"
            >
              Rezerwacje
              {pendingBook > 0 ? ` (${pendingBook})` : ''}
            </Link>
          </>
        }
      />

      <div className="page-wide !pt-10">
      {pendingBook > 0 ? (
        <div className="mb-10 flex flex-wrap items-center justify-between gap-3 border border-ink bg-ink px-5 py-4 text-white">
          <div>
            <p className="text-sm font-medium">
              {pendingBook === 1
                ? 'Masz 1 zgłoszenie do umówienia'
                : `Masz ${pendingBook} zgłoszenia do umówienia`}
            </p>
            <p className="mt-1 text-sm text-white/65">Wycena zaakceptowana — wybierz termin sesji.</p>
          </div>
          <Link
            href="/rezerwacje"
            className="btn border border-white bg-white text-ink hover:bg-white/90 hover:border-white/90"
          >
            Umów termin
          </Link>
        </div>
      ) : null}

      <section>
        <h2 className="section-title">Co chcesz zrobić?</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {primary ? (
            <Link
              href={primary.href}
              className="flex flex-col gap-2 border border-ink bg-ink px-5 py-5 text-white no-underline transition hover:bg-ink-soft sm:col-span-1"
            >
              <span className="text-sm font-medium">{primary.title}</span>
              <span className="text-sm leading-relaxed text-white/65">{primary.description}</span>
            </Link>
          ) : null}
          {secondary.map((action) => (
            <Link
              key={action.title}
              href={action.href}
              className="flex flex-col gap-2 border border-paper-line bg-paper-pure px-5 py-5 no-underline transition hover:border-ink/30"
            >
              <span className="text-sm font-medium text-ink">{action.title}</span>
              <span className="text-sm leading-relaxed text-ink-muted">{action.description}</span>
            </Link>
          ))}
        </div>
      </section>

      <section id="lista" className="mt-12 scroll-mt-24">
        <div className="overflow-hidden border border-paper-line bg-paper-pure">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-paper-line px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <h2 className="font-display text-2xl tracking-tight text-ink sm:text-[1.75rem]">
                {listTitle(user?.role, unassignedOnly, archived)}
              </h2>
              <p className="mt-0.5 text-sm text-ink-muted">
                {loading ? 'Ładowanie…' : `${filtered.length} ${filtered.length === 1 ? 'zgłoszenie' : 'zgłoszeń'}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isAdmin ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setUnassignedOnly(false);
                      setArchived(false);
                    }}
                    className={`chip ${!unassignedOnly && !archived ? 'chip-active' : ''}`}
                  >
                    Aktywne
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUnassignedOnly(true);
                      setArchived(false);
                    }}
                    className={`chip ${unassignedOnly && !archived ? 'chip-active' : ''}`}
                  >
                    Bez artysty
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUnassignedOnly(false);
                      setArchived(true);
                    }}
                    className={`chip ${archived ? 'chip-active' : ''}`}
                  >
                    Archiwum
                  </button>
                </>
              ) : null}
              <label className="flex items-center gap-2 text-sm text-ink-muted">
                <span className="sr-only sm:not-sr-only sm:inline">Status</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as SubmissionStatus | 'ALL')}
                  className="field-input !w-auto min-w-[9.5rem] py-1.5"
                >
                  <option value="ALL">Wszystkie ({items.length})</option>
                  {SUBMISSION_STATUSES.map((s) => {
                    const count = items.filter((i) => i.status === s).length;
                    if (!count) return null;
                    return (
                      <option key={s} value={s}>
                        {SUBMISSION_STATUS_LABELS[s]} ({count})
                      </option>
                    );
                  })}
                </select>
              </label>
              {canCreate && !archived ? (
                <Link href="/zgloszenie" className="btn-primary btn-sm">
                  Nowe zgłoszenie
                </Link>
              ) : null}
            </div>
          </div>

          {error ? (
            <p className="alert m-5" role="alert">
              {error}
            </p>
          ) : null}

          {!loading && !error && filtered.length === 0 ? (
            <div className="px-5 py-16 text-center sm:px-6">
              <p className="font-display text-2xl text-ink">Brak zgłoszeń</p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
                {canCreate
                  ? 'Wyślij pierwsze zgłoszenie — pojawi się na tej liście.'
                  : 'W tym widoku nie ma nic do pokazania.'}
              </p>
              {canCreate && !archived ? (
                <Link href="/zgloszenie" className="btn-primary mt-6 inline-flex">
                  Nowe zgłoszenie
                </Link>
              ) : null}
            </div>
          ) : null}

          {!loading && filtered.length > 0 ? (
            <ul>
              {filtered.map((item, index) => {
                const price = formatPrice(item);
                const who = sideLabel(item, user?.role);
                const date = new Date(item.createdAt).toLocaleDateString('pl-PL', {
                  day: 'numeric',
                  month: 'short',
                });

                return (
                  <li
                    key={item.id}
                    className={index > 0 ? 'border-t border-paper-line' : undefined}
                  >
                    <Link
                      href={`/zgloszenia/${item.id}`}
                      className="group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-5 py-4 no-underline transition hover:bg-paper-soft sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] sm:px-6 sm:py-5"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-display text-xl tracking-tight text-ink transition group-hover:opacity-75">
                          {item.style}
                        </p>
                        <p className="mt-0.5 text-sm text-ink-muted">{item.bodyPart}</p>
                      </div>

                      <div className="hidden min-w-0 text-sm text-ink-muted sm:block">
                        <p>{date}{who ? ` · ${who}` : ''}</p>
                        <p className="mt-0.5 text-ink">
                          {price ?? 'Bez wyceny'}
                          {!item.preferredArtistId && isAdmin ? ' · pula' : ''}
                        </p>
                      </div>

                      <div className="col-start-2 row-start-1 flex flex-col items-end gap-2 sm:col-auto sm:row-auto sm:flex-row sm:items-center">
                        <span
                          className={`status-pill ${
                            item.status === 'ACCEPTED' || item.status === 'QUOTED'
                              ? 'status-pill-strong'
                              : ''
                          }`}
                        >
                          {SUBMISSION_STATUS_LABELS[item.status]}
                        </span>
                        {!archived && (item.canArchive || item.canHardDelete) ? (
                          <div className="hidden gap-2 lg:flex">
                            {item.canArchive ? (
                              <button
                                type="button"
                                disabled={busyId === item.id}
                                onClick={(e) => void onRemove(item.id, 'archive', e)}
                                className="btn-text text-xs"
                              >
                                Archiwum
                              </button>
                            ) : null}
                            {item.canHardDelete ? (
                              <button
                                type="button"
                                disabled={busyId === item.id}
                                onClick={(e) => void onRemove(item.id, 'hard', e)}
                                className="btn-danger text-xs"
                              >
                                Usuń
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      <span
                        aria-hidden
                        className="hidden text-ink-faint transition group-hover:text-ink sm:inline"
                      >
                        →
                      </span>

                      <p className="col-span-2 text-xs text-ink-faint sm:hidden">
                        {date}
                        {who ? ` · ${who}` : ''}
                        {price ? ` · ${price}` : ''}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </section>
      </div>
    </main>
  );
}
