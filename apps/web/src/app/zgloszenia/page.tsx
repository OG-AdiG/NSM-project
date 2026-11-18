'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  COLOR_MODE_LABELS,
  ColorMode,
  SUBMISSION_STATUS_LABELS,
  SUBMISSION_STATUSES,
  SubmissionStatus,
} from '@nsm/shared';
import { apiFetch, ApiError } from '@/lib/api';
import { getAccessToken, getStoredUser, StoredUser } from '@/lib/auth-storage';

type SubmissionListItem = {
  id: string;
  description: string;
  bodyPart: string;
  size: string;
  style: string;
  colorMode: ColorMode;
  status: SubmissionStatus;
  createdAt: string;
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

function titleForRole(role: StoredUser['role'] | undefined) {
  if (role === 'ARTIST') return 'Zgłoszenia przypisane do mnie';
  if (role === 'ADMIN') return 'Wszystkie zgłoszenia';
  return 'Moje zgłoszenia';
}

export default function SubmissionsListPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [items, setItems] = useState<SubmissionListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace('/logowanie');
      return;
    }
    setUser(getStoredUser());
    apiFetch<SubmissionListItem[]>('/submissions', { accessToken: token })
      .then(setItems)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [router]);

  const filtered = useMemo(
    () => (statusFilter === 'ALL' ? items : items.filter((i) => i.status === statusFilter)),
    [items, statusFilter],
  );

  async function onDelete(id: string) {
    if (!confirm('Na pewno usunąć to zgłoszenie? Tej operacji nie można cofnąć.')) return;
    const token = getAccessToken();
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/submissions/${id}`, { method: 'DELETE', accessToken: token });
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nie udało się usunąć');
    } finally {
      setBusyId(null);
    }
  }

  const canCreate = user?.role === 'CLIENT' || user?.role === 'ADMIN';
  const showClient = user?.role === 'ARTIST' || user?.role === 'ADMIN';

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/konto" className="text-sm text-neutral-500 hover:text-neutral-800">
            ← Konto
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{titleForRole(user?.role)}</h1>
          {user?.role === 'ARTIST' ? (
            <p className="mt-1 text-sm text-neutral-600">
              Widzisz wyłącznie zgłoszenia, w których jesteś preferowanym artystą.
            </p>
          ) : null}
        </div>
        {canCreate ? (
          <Link
            href="/zgloszenie"
            className="rounded bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Nowe zgłoszenie
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStatusFilter('ALL')}
          className={`rounded px-3 py-1.5 text-xs font-medium ${
            statusFilter === 'ALL' ? 'bg-neutral-900 text-white' : 'border border-neutral-300'
          }`}
        >
          Wszystkie ({items.length})
        </button>
        {SUBMISSION_STATUSES.map((s) => {
          const count = items.filter((i) => i.status === s).length;
          if (!count && statusFilter !== s) return null;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded px-3 py-1.5 text-xs font-medium ${
                statusFilter === s ? 'bg-neutral-900 text-white' : 'border border-neutral-300'
              }`}
            >
              {SUBMISSION_STATUS_LABELS[s]} ({count})
            </button>
          );
        })}
      </div>

      {loading ? <p className="text-neutral-600">Ładowanie…</p> : null}
      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && !error && filtered.length === 0 ? (
        <p className="text-neutral-600">
          {items.length === 0
            ? canCreate
              ? 'Brak zgłoszeń. '
              : 'Brak przypisanych zgłoszeń.'
            : 'Brak zgłoszeń w wybranym statusie.'}
          {items.length === 0 && canCreate ? (
            <Link href="/zgloszenie" className="underline">
              Utwórz pierwsze
            </Link>
          ) : null}
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {filtered.map((item) => {
          const artistName =
            item.preferredArtist?.artistProfile?.displayName ||
            [item.preferredArtist?.firstName, item.preferredArtist?.lastName]
              .filter(Boolean)
              .join(' ') ||
            'bez preferencji';
          const clientName =
            [item.client?.firstName, item.client?.lastName].filter(Boolean).join(' ') ||
            item.client?.email ||
            '—';
          const deletable =
            user?.role === 'ADMIN' ||
            (user?.role === 'CLIENT' &&
              (item.status === 'NEW' || item.status === 'CANCELLED' || item.status === 'REJECTED'));

          return (
            <li key={item.id} className="rounded border border-neutral-200 px-4 py-3">
              <Link href={`/zgloszenia/${item.id}`} className="block hover:opacity-90">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {item.style} · {item.bodyPart}
                  </span>
                  <span className="text-xs uppercase tracking-wide text-neutral-500">
                    {SUBMISSION_STATUS_LABELS[item.status]}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-neutral-600">{item.description}</p>
                <p className="mt-2 text-xs text-neutral-500">
                  {COLOR_MODE_LABELS[item.colorMode]} · {item.size}
                  {showClient ? ` · klient: ${clientName}` : ` · artysta: ${artistName}`}
                </p>
              </Link>
              {deletable ? (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void onDelete(item.id)}
                    className="text-xs text-red-700 underline disabled:opacity-50"
                  >
                    {busyId === item.id ? 'Usuwanie…' : 'Usuń'}
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
