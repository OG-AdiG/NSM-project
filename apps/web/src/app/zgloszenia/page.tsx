'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  estimateMinPln: number | null;
  estimateMaxPln: number | null;
  finalPricePln: number | null;
  preferredArtistId: string | null;
  isArchived?: boolean;
  canDelete?: boolean;
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

function titleForRole(role: StoredUser['role'] | undefined, unassigned: boolean, archived: boolean) {
  if (archived) return 'Archiwum zgłoszeń';
  if (unassigned) return 'Pula bez artysty';
  if (role === 'ARTIST') return 'Zgłoszenia przypisane do mnie';
  if (role === 'ADMIN') return 'Wszystkie zgłoszenia';
  return 'Moje zgłoszenia';
}

export default function SubmissionsListPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [items, setItems] = useState<SubmissionListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | 'ALL'>('ALL');
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [archived, setArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
      const data = await apiFetch<SubmissionListItem[]>(
        `/submissions${qs ? `?${qs}` : ''}`,
        { accessToken: token },
      );
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd ładowania');
    } finally {
      setLoading(false);
    }
  }, [archived, router, unassignedOnly]);

  useEffect(() => {
    setUser(getStoredUser());
    void load();
  }, [load]);

  const filtered = useMemo(
    () => (statusFilter === 'ALL' ? items : items.filter((i) => i.status === statusFilter)),
    [items, statusFilter],
  );

  async function onDelete(id: string) {
    if (!confirm('Usunąć lub przenieść do archiwum to zgłoszenie?')) return;
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
  const isAdmin = user?.role === 'ADMIN';

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/konto" className="text-sm text-neutral-500 hover:text-neutral-800">
            ← Konto
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            {titleForRole(user?.role, unassignedOnly, archived)}
          </h1>
          {user?.role === 'ARTIST' ? (
            <p className="mt-1 text-sm text-neutral-600">
              Widzisz wyłącznie zgłoszenia przypisane do Ciebie.
            </p>
          ) : null}
        </div>
        {canCreate && !archived ? (
          <Link
            href="/zgloszenie"
            className="rounded bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Nowe zgłoszenie
          </Link>
        ) : null}
      </div>

      {isAdmin ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setUnassignedOnly(false);
              setArchived(false);
            }}
            className={`rounded px-3 py-1.5 text-xs font-medium ${
              !unassignedOnly && !archived ? 'bg-neutral-900 text-white' : 'border border-neutral-300'
            }`}
          >
            Wszystkie aktywne
          </button>
          <button
            type="button"
            onClick={() => {
              setUnassignedOnly(true);
              setArchived(false);
            }}
            className={`rounded px-3 py-1.5 text-xs font-medium ${
              unassignedOnly && !archived ? 'bg-neutral-900 text-white' : 'border border-neutral-300'
            }`}
          >
            Bez artysty
          </button>
          <button
            type="button"
            onClick={() => {
              setUnassignedOnly(false);
              setArchived(true);
            }}
            className={`rounded px-3 py-1.5 text-xs font-medium ${
              archived ? 'bg-neutral-900 text-white' : 'border border-neutral-300'
            }`}
          >
            Archiwum
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStatusFilter('ALL')}
          className={`rounded px-3 py-1.5 text-xs font-medium ${
            statusFilter === 'ALL' ? 'bg-neutral-900 text-white' : 'border border-neutral-300'
          }`}
        >
          Status: wszystkie ({items.length})
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
        <p className="text-neutral-600">Brak zgłoszeń w tym widoku.</p>
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
          const price =
            item.finalPricePln != null
              ? `${item.finalPricePln} zł`
              : item.estimateMinPln != null && item.estimateMaxPln != null
                ? `ok. ${item.estimateMinPln}–${item.estimateMaxPln} zł`
                : null;

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
                  {price ? ` · ${price}` : ''}
                  {!item.preferredArtistId && isAdmin ? ' · pula' : ''}
                </p>
              </Link>
              {item.canDelete && !archived ? (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => void onDelete(item.id)}
                    className="text-xs text-red-700 underline disabled:opacity-50"
                  >
                    {busyId === item.id ? '…' : 'Usuń / archiwizuj'}
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
