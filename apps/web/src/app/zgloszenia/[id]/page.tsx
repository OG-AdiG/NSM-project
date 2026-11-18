'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  COLOR_MODE_LABELS,
  ColorMode,
  REFERENCE_PHOTO,
  SUBMISSION_STATUS_LABELS,
  SubmissionStatus,
} from '@nsm/shared';
import { apiFetch, ApiError } from '@/lib/api';
import { getAccessToken, getStoredUser, StoredUser } from '@/lib/auth-storage';

type Photo = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string | null;
};

type ArtistOption = {
  userId: string;
  displayName: string;
  styles: string[];
};

type SubmissionDetail = {
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
  preferredArtistId?: string | null;
  preferredArtist?: {
    id: string;
    artistProfile?: { displayName: string } | null;
    firstName: string | null;
    lastName: string | null;
  } | null;
  client?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
  photos: Photo[];
  allowedStatuses: SubmissionStatus[];
  canDelete: boolean;
  canEditPhotos: boolean;
  canAssignArtist: boolean;
};

const ACCEPT = REFERENCE_PHOTO.allowedMimeTypes.join(',');
const MAX_MB = Math.round(REFERENCE_PHOTO.maxBytes / (1024 * 1024));

const STATUS_ACTION_LABEL: Partial<Record<SubmissionStatus, string>> = {
  CANCELLED: 'Anuluj',
  REJECTED: 'Odrzuć',
  QUOTED: 'Oznacz jako wycenione',
  ACCEPTED: 'Akceptuj wycenę',
  COMPLETED: 'Oznacz jako zrealizowane',
  NEW: 'Przywróć jako nowe',
};

export default function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [item, setItem] = useState<SubmissionDetail | null>(null);
  const [artists, setArtists] = useState<ArtistOption[]>([]);
  const [assignId, setAssignId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      router.replace('/logowanie');
      return;
    }
    const data = await apiFetch<SubmissionDetail>(`/submissions/${id}`, { accessToken: token });
    setItem(data);
    setAssignId(data.preferredArtist?.id ?? data.preferredArtistId ?? '');
  }, [id, router]);

  useEffect(() => {
    setUser(getStoredUser());
    load().catch((err: Error) => setError(err.message));
  }, [load]);

  useEffect(() => {
    if (user?.role !== 'ADMIN') return;
    apiFetch<ArtistOption[]>('/artists')
      .then(setArtists)
      .catch(() => setArtists([]));
  }, [user?.role]);

  async function onStatus(next: SubmissionStatus) {
    if (!item) return;
    const token = getAccessToken();
    if (!token) return;
    setPending(true);
    setActionError(null);
    try {
      const updated = await apiFetch<SubmissionDetail>(`/submissions/${item.id}/status`, {
        method: 'PATCH',
        accessToken: token,
        body: JSON.stringify({ status: next }),
      });
      setItem(updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Nie udało się zmienić statusu');
    } finally {
      setPending(false);
    }
  }

  async function onAssign() {
    if (!item) return;
    const token = getAccessToken();
    if (!token) return;
    setPending(true);
    setActionError(null);
    try {
      const updated = await apiFetch<SubmissionDetail>(`/submissions/${item.id}/assign`, {
        method: 'PATCH',
        accessToken: token,
        body: JSON.stringify({ preferredArtistId: assignId || null }),
      });
      setItem(updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Nie udało się przypisać artysty');
    } finally {
      setPending(false);
    }
  }

  async function onDelete() {
    if (!item) return;
    if (!confirm('Na pewno usunąć to zgłoszenie?')) return;
    const token = getAccessToken();
    if (!token) return;
    setPending(true);
    setActionError(null);
    try {
      await apiFetch(`/submissions/${item.id}`, { method: 'DELETE', accessToken: token });
      router.push('/zgloszenia');
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Nie udało się usunąć');
      setPending(false);
    }
  }

  async function onUpload(list: FileList | null) {
    if (!list?.length || !item) return;
    setActionError(null);
    const token = getAccessToken();
    if (!token) {
      router.replace('/logowanie');
      return;
    }

    const remaining = REFERENCE_PHOTO.maxFiles - item.photos.length;
    if (remaining <= 0) {
      setActionError(`Można dodać maksymalnie ${REFERENCE_PHOTO.maxFiles} zdjęć`);
      return;
    }

    setUploading(true);
    try {
      let uploaded = 0;
      for (const file of Array.from(list)) {
        if (uploaded >= remaining) break;
        if (!(REFERENCE_PHOTO.allowedMimeTypes as readonly string[]).includes(file.type)) {
          setActionError('Dozwolone typy: JPEG, PNG, WebP');
          continue;
        }
        if (file.size > REFERENCE_PHOTO.maxBytes) {
          setActionError(`Plik „${file.name}” przekracza ${MAX_MB} MB`);
          continue;
        }
        const form = new FormData();
        form.append('file', file);
        await apiFetch(`/submissions/${item.id}/photos`, {
          method: 'POST',
          accessToken: token,
          body: form,
        });
        uploaded += 1;
      }
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Nie udało się dodać zdjęcia');
    } finally {
      setUploading(false);
    }
  }

  async function onRemovePhoto(photoId: string) {
    if (!item) return;
    setActionError(null);
    const token = getAccessToken();
    if (!token) return;
    try {
      await apiFetch(`/submissions/${item.id}/photos/${photoId}`, {
        method: 'DELETE',
        accessToken: token,
      });
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Nie udało się usunąć zdjęcia');
    }
  }

  if (error) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <p className="text-red-700">{error}</p>
        <Link href="/zgloszenia" className="mt-4 inline-block underline">
          Wróć do listy
        </Link>
      </main>
    );
  }

  if (!item) {
    return <main className="mx-auto max-w-xl px-6 py-16 text-neutral-600">Ładowanie…</main>;
  }

  const artistName =
    item.preferredArtist?.artistProfile?.displayName ||
    [item.preferredArtist?.firstName, item.preferredArtist?.lastName].filter(Boolean).join(' ') ||
    'bez preferencji';
  const clientName =
    [item.client?.firstName, item.client?.lastName].filter(Boolean).join(' ') ||
    item.client?.email ||
    '—';
  const showClient = user?.role === 'ARTIST' || user?.role === 'ADMIN';

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-6 py-12">
      <div>
        <Link href="/zgloszenia" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Lista zgłoszeń
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Zgłoszenie</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Status: <strong>{SUBMISSION_STATUS_LABELS[item.status]}</strong>
        </p>
      </div>

      <dl className="space-y-4 text-sm">
        {showClient && item.client ? (
          <div>
            <dt className="text-neutral-500">Klient</dt>
            <dd className="font-medium">
              {clientName}
              <span className="ml-2 font-normal text-neutral-500">{item.client.email}</span>
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-neutral-500">Opis</dt>
          <dd className="mt-1 whitespace-pre-wrap">{item.description}</dd>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-neutral-500">Miejsce</dt>
            <dd className="font-medium">{item.bodyPart}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Rozmiar</dt>
            <dd className="font-medium">{item.size}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Styl</dt>
            <dd className="font-medium">{item.style}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Kolor</dt>
            <dd className="font-medium">{COLOR_MODE_LABELS[item.colorMode]}</dd>
          </div>
        </div>
        <div>
          <dt className="text-neutral-500">Preferowany artysta</dt>
          <dd className="font-medium">{artistName}</dd>
        </div>
      </dl>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Akcje</h2>
        {item.allowedStatuses.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {item.allowedStatuses.map((s) => (
              <button
                key={s}
                type="button"
                disabled={pending}
                onClick={() => void onStatus(s)}
                className="rounded border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100 disabled:opacity-50"
              >
                {STATUS_ACTION_LABEL[s] ?? SUBMISSION_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-600">Brak dostępnych zmian statusu dla Twojej roli.</p>
        )}

        {item.canAssignArtist ? (
          <div className="flex flex-col gap-2 text-sm">
            <label className="font-medium" htmlFor="assign-artist">
              Przypisz artystę
            </label>
            <div className="flex flex-wrap gap-2">
              <select
                id="assign-artist"
                value={assignId}
                onChange={(e) => setAssignId(e.target.value)}
                className="min-w-[12rem] flex-1 rounded border border-neutral-300 bg-white px-3 py-2"
              >
                <option value="">Bez przypisania</option>
                {artists.map((a) => (
                  <option key={a.userId} value={a.userId}>
                    {a.displayName}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={pending}
                onClick={() => void onAssign()}
                className="rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Zapisz
              </button>
            </div>
          </div>
        ) : null}

        {item.canDelete ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => void onDelete()}
            className="self-start text-sm text-red-700 underline disabled:opacity-50"
          >
            Usuń zgłoszenie
          </button>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">
          Zdjęcia referencyjne ({item.photos.length}/{REFERENCE_PHOTO.maxFiles})
        </h2>

        {item.photos.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {item.photos.map((p) => (
              <li key={p.id} className="flex flex-col gap-1.5">
                {p.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.url}
                    alt={p.fileName}
                    className="aspect-square w-full bg-neutral-100 object-cover"
                  />
                ) : (
                  <div className="flex aspect-square items-center justify-center bg-neutral-100 text-xs text-neutral-500">
                    Brak podglądu
                  </div>
                )}
                <div className="flex items-start justify-between gap-2 text-xs text-neutral-600">
                  <span className="truncate" title={p.fileName}>
                    {p.fileName}
                  </span>
                  {item.canEditPhotos ? (
                    <button
                      type="button"
                      onClick={() => void onRemovePhoto(p.id)}
                      className="shrink-0 underline hover:text-neutral-900"
                    >
                      Usuń
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-600">Brak zdjęć.</p>
        )}

        {item.canEditPhotos && item.photos.length < REFERENCE_PHOTO.maxFiles ? (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Dodaj zdjęcia (JPEG/PNG/WebP, max {MAX_MB} MB)</span>
            <input
              type="file"
              accept={ACCEPT}
              multiple
              disabled={uploading}
              onChange={(e) => {
                void onUpload(e.target.files);
                e.target.value = '';
              }}
              className="text-sm file:mr-3 file:rounded file:border-0 file:bg-neutral-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white disabled:opacity-60"
            />
          </label>
        ) : null}

        {!item.canEditPhotos ? (
          <p className="text-xs text-neutral-500">
            Zdjęcia można zmieniać tylko gdy status to „Nowe”.
          </p>
        ) : null}

        {uploading ? <p className="text-sm text-neutral-500">Wysyłanie…</p> : null}
      </section>

      {actionError ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {actionError}
        </p>
      ) : null}
    </main>
  );
}
