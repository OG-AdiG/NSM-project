'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  COLOR_MODE_LABELS,
  ColorMode,
  REFERENCE_PHOTO,
  SUBMISSION_STATUS_LABELS,
  SubmissionStatus,
} from '@nsm/shared';
import { BookingPanel } from '@/components/booking-panel';
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
};

type Message = {
  id: string;
  body: string;
  system: boolean;
  createdAt: string;
  author: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    role: string;
    email: string;
  };
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
  finalPricePln: number | null;
  sessionCount: number | null;
  quoteNote: string | null;
  rejectionReason: string | null;
  preferredDate: string | null;
  preferredSlotStart: string | null;
  preferredSlotEnd: string | null;
  preferredTimeNote: string | null;
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
  canHardDelete: boolean;
  canArchive: boolean;
  canEditPhotos: boolean;
  canAssignArtist: boolean;
  canQuote: boolean;
  canReject: boolean;
  canMessage: boolean;
  isArchived: boolean;
};

const ACCEPT = REFERENCE_PHOTO.allowedMimeTypes.join(',');
const MAX_MB = Math.round(REFERENCE_PHOTO.maxBytes / (1024 * 1024));

const STATUS_ACTION_LABEL: Partial<Record<SubmissionStatus, string>> = {
  CANCELLED: 'Anuluj',
  ACCEPTED: 'Akceptuj wycenę',
  COMPLETED: 'Oznacz jako zrealizowane',
  NEW: 'Przywróć jako nowe',
};

export default function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [item, setItem] = useState<SubmissionDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [artists, setArtists] = useState<ArtistOption[]>([]);
  const [assignId, setAssignId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(false);

  const [quotePrice, setQuotePrice] = useState('');
  const [quoteSessions, setQuoteSessions] = useState('1');
  const [quoteNote, setQuoteNote] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [messageBody, setMessageBody] = useState('');

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      router.replace('/logowanie');
      return;
    }
    const [data, msgs] = await Promise.all([
      apiFetch<SubmissionDetail>(`/submissions/${id}`, { accessToken: token }),
      apiFetch<Message[]>(`/submissions/${id}/messages`, { accessToken: token }).catch(() => []),
    ]);
    setItem(data);
    setMessages(msgs);
    setAssignId(data.preferredArtist?.id ?? data.preferredArtistId ?? '');
    if (data.finalPricePln != null) setQuotePrice(String(data.finalPricePln));
    else if (data.estimateMaxPln != null) setQuotePrice(String(data.estimateMaxPln));
    if (data.sessionCount != null) setQuoteSessions(String(data.sessionCount));
    if (data.quoteNote) setQuoteNote(data.quoteNote);
  }, [id, router]);

  useEffect(() => {
    setUser(getStoredUser());
    load().catch((err: Error) => setError(err.message));
  }, [load]);

  // Odświeżanie wątku bez przeładowania strony (MVP: polling zamiast WebSocket)
  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function refreshMessages() {
      if (typeof document !== 'undefined' && document.hidden) return;
      const token = getAccessToken();
      if (!token) return;
      try {
        const msgs = await apiFetch<Message[]>(`/submissions/${id}/messages`, {
          accessToken: token,
        });
        if (!cancelled) {
          setMessages((prev) => {
            if (
              prev.length === msgs.length &&
              prev.every((m, i) => m.id === msgs[i]?.id && m.body === msgs[i]?.body)
            ) {
              return prev;
            }
            return msgs;
          });
        }
      } catch {
        // chwilowe błędy pollingu ignorujemy
      }
    }

    const timer = window.setInterval(() => {
      void refreshMessages();
    }, 2000);

    const onVisibility = () => {
      if (!document.hidden) void refreshMessages();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [id]);

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
      await load();
      if (next === 'ACCEPTED') {
        router.push('/rezerwacje');
      }
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Nie udało się zmienić statusu');
    } finally {
      setPending(false);
    }
  }

  async function onQuote(e: FormEvent) {
    e.preventDefault();
    if (!item) return;
    const token = getAccessToken();
    if (!token) return;
    const finalPricePln = Number(quotePrice);
    if (!Number.isFinite(finalPricePln) || finalPricePln < 50) {
      setActionError('Podaj poprawną cenę (min. 50 zł)');
      return;
    }
    setPending(true);
    setActionError(null);
    try {
      const updated = await apiFetch<SubmissionDetail>(`/submissions/${item.id}/quote`, {
        method: 'POST',
        accessToken: token,
        body: JSON.stringify({
          finalPricePln,
          sessionCount: Number(quoteSessions) || 1,
          quoteNote: quoteNote.trim() || undefined,
          estimateMinPln: item.estimateMinPln ?? undefined,
          estimateMaxPln: item.estimateMaxPln ?? undefined,
        }),
      });
      setItem(updated);
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Nie udało się wystawić wyceny');
    } finally {
      setPending(false);
    }
  }

  async function onReject(e: FormEvent) {
    e.preventDefault();
    if (!item) return;
    const token = getAccessToken();
    if (!token) return;
    if (rejectReason.trim().length < 5) {
      setActionError('Podaj powód odrzucenia (min. 5 znaków)');
      return;
    }
    setPending(true);
    setActionError(null);
    try {
      const updated = await apiFetch<SubmissionDetail>(`/submissions/${item.id}/reject`, {
        method: 'POST',
        accessToken: token,
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      setItem(updated);
      setRejectReason('');
      await load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Nie udało się odrzucić');
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

  async function onRestore() {
    if (!item) return;
    const token = getAccessToken();
    if (!token) return;
    setPending(true);
    setActionError(null);
    try {
      const updated = await apiFetch<SubmissionDetail>(`/submissions/${item.id}/restore`, {
        method: 'POST',
        accessToken: token,
      });
      setItem(updated);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Nie udało się przywrócić');
    } finally {
      setPending(false);
    }
  }

  async function onRemove(mode: 'hard' | 'archive') {
    if (!item) return;
    const ok =
      mode === 'archive'
        ? confirm('Przenieść zgłoszenie do archiwum? Później admin może je przywrócić.')
        : confirm('Trwale usunąć zgłoszenie wraz ze zdjęciami? Tej operacji nie cofniesz.');
    if (!ok) return;
    const token = getAccessToken();
    if (!token) return;
    setPending(true);
    setActionError(null);
    try {
      await apiFetch(`/submissions/${item.id}?mode=${mode}`, {
        method: 'DELETE',
        accessToken: token,
      });
      router.push('/zgloszenia');
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Nie udało się wykonać operacji');
      setPending(false);
    }
  }

  async function onSendMessage(e: FormEvent) {
    e.preventDefault();
    if (!item || !messageBody.trim()) return;
    const token = getAccessToken();
    if (!token) return;
    setPending(true);
    setActionError(null);
    try {
      const msg = await apiFetch<Message>(`/submissions/${item.id}/messages`, {
        method: 'POST',
        accessToken: token,
        body: JSON.stringify({ body: messageBody.trim() }),
      });
      setMessages((prev) => [...prev, msg]);
      setMessageBody('');
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Nie udało się wysłać wiadomości');
    } finally {
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
      <main className="page-wide">
        <p className="alert">{error}</p>
        <Link href="/zgloszenia" className="btn-text mt-4">
          Wróć do listy
        </Link>
      </main>
    );
  }

  if (!item) {
    return (
      <main className="page-wide">
        <p className="lede">Ładowanie…</p>
      </main>
    );
  }

  const artistName =
    item.preferredArtist?.artistProfile?.displayName ||
    [item.preferredArtist?.firstName, item.preferredArtist?.lastName].filter(Boolean).join(' ') ||
    'Bez preferencji';
  const clientName =
    [item.client?.firstName, item.client?.lastName].filter(Boolean).join(' ') ||
    item.client?.email ||
    '—';
  const showClient = user?.role === 'ARTIST' || user?.role === 'ADMIN';
  const created = new Date(item.createdAt).toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const preferredDate = item.preferredDate
    ? new Date(item.preferredDate).toLocaleDateString('pl-PL')
    : null;
  const preferredSlot = item.preferredSlotStart
    ? `${new Date(item.preferredSlotStart).toLocaleTimeString('pl-PL', {
        hour: '2-digit',
        minute: '2-digit',
      })}${
        item.preferredSlotEnd
          ? `–${new Date(item.preferredSlotEnd).toLocaleTimeString('pl-PL', {
              hour: '2-digit',
              minute: '2-digit',
            })}`
          : ''
      }`
    : null;

  return (
    <main className="page-wide space-y-10">
      <header className="border-b border-paper-line pb-8">
        <Link href="/zgloszenia" className="back-link">
          ← Lista zgłoszeń
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-4xl tracking-tight text-ink sm:text-5xl">
                {item.style}
              </h1>
              <span
                className={`status-pill ${
                  item.status === 'ACCEPTED' || item.status === 'QUOTED' ? 'status-pill-strong' : ''
                }`}
              >
                {SUBMISSION_STATUS_LABELS[item.status]}
              </span>
              {item.isArchived ? <span className="status-pill">Archiwum</span> : null}
            </div>
            <p className="mt-2 text-lg text-ink-muted">{item.bodyPart}</p>
            <p className="mt-2 text-sm text-ink-faint">Utworzono {created}</p>
          </div>
          {!item.isArchived && item.allowedStatuses.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {item.allowedStatuses.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={pending}
                  onClick={() => void onStatus(s)}
                  className="btn-ghost"
                >
                  {STATUS_ACTION_LABEL[s] ?? SUBMISSION_STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </header>

      <section>
        <h2 className="section-title">Szczegóły</h2>
        <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
          {item.description}
        </p>
        <dl className="mt-8 grid gap-6 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-[0.08em] text-ink-faint">Rozmiar</dt>
            <dd className="mt-1.5 text-sm text-ink">{item.size}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.08em] text-ink-faint">Kolor</dt>
            <dd className="mt-1.5 text-sm text-ink">{COLOR_MODE_LABELS[item.colorMode]}</dd>
          </div>
          {showClient && item.client ? (
            <div>
              <dt className="text-xs uppercase tracking-[0.08em] text-ink-faint">Klient</dt>
              <dd className="mt-1.5 text-sm text-ink">
                {clientName}
                <span className="mt-0.5 block text-ink-faint">{item.client.email}</span>
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs uppercase tracking-[0.08em] text-ink-faint">Artysta</dt>
            <dd className="mt-1.5 text-sm text-ink">{artistName}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.08em] text-ink-faint">Preferowany termin</dt>
            <dd className="mt-1.5 text-sm text-ink">
              {preferredDate || preferredSlot
                ? [preferredDate, preferredSlot].filter(Boolean).join(' · ')
                : '—'}
              {item.preferredTimeNote ? (
                <span className="mt-1 block text-ink-muted">{item.preferredTimeNote}</span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.08em] text-ink-faint">Widełki</dt>
            <dd className="mt-1.5 text-sm text-ink">
              {item.estimateMinPln != null && item.estimateMaxPln != null
                ? `${item.estimateMinPln}–${item.estimateMaxPln} zł`
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.08em] text-ink-faint">Wycena</dt>
            <dd className="mt-1.5 text-sm text-ink">
              {item.finalPricePln != null ? `${item.finalPricePln} zł` : 'Brak wyceny'}
              {item.sessionCount != null ? ` · ${item.sessionCount} sesji` : ''}
            </dd>
          </div>
        </dl>
        {item.quoteNote ? (
          <div className="mt-6 border-l-2 border-ink/20 pl-4">
            <p className="text-xs uppercase tracking-[0.08em] text-ink-faint">Notatka do wyceny</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-ink-muted">{item.quoteNote}</p>
          </div>
        ) : null}
        {item.rejectionReason ? (
          <div className="mt-6 border-l-2 border-ink/40 pl-4">
            <p className="text-xs uppercase tracking-[0.08em] text-ink-faint">Powód odrzucenia</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{item.rejectionReason}</p>
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="section-title">
          Zdjęcia referencyjne
          <span className="ml-2 font-sans text-ink-faint">
            {item.photos.length}/{REFERENCE_PHOTO.maxFiles}
          </span>
        </h2>
        {item.photos.length > 0 ? (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {item.photos.map((p) => (
              <li key={p.id} className="flex flex-col gap-2">
                {p.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.url}
                    alt={p.fileName}
                    className="aspect-square w-full bg-paper-soft object-cover"
                  />
                ) : (
                  <div className="flex aspect-square items-center justify-center bg-paper-soft text-xs text-ink-faint">
                    Brak podglądu
                  </div>
                )}
                {item.canEditPhotos ? (
                  <button
                    type="button"
                    onClick={() => void onRemovePhoto(p.id)}
                    className="btn-danger text-xs"
                  >
                    Usuń
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-ink-muted">Brak zdjęć.</p>
        )}
        {item.canEditPhotos && item.photos.length < REFERENCE_PHOTO.maxFiles ? (
          <div className="mt-4">
            <input
              type="file"
              accept={ACCEPT}
              multiple
              disabled={uploading}
              onChange={(e) => {
                void onUpload(e.target.files);
                e.target.value = '';
              }}
              className="file-input"
            />
            <p className="mt-2 text-xs text-ink-faint">Do {MAX_MB} MB na plik.</p>
          </div>
        ) : null}
      </section>

      <BookingPanel
        submissionId={item.id}
        artistId={item.preferredArtist?.id ?? item.preferredArtistId}
        status={item.status}
        preferredDate={item.preferredDate}
        preferredSlotStart={item.preferredSlotStart}
      />

      {item.canQuote ? (
        <section className="border-t border-paper-line pt-8">
          <h2 className="section-title">Wycena</h2>
          <form onSubmit={onQuote} className="mt-4 flex max-w-md flex-col gap-3">
            <label className="field">
              <span className="field-label">Cena ostateczna (zł)</span>
              <input
                type="number"
                min={50}
                required
                value={quotePrice}
                onChange={(e) => setQuotePrice(e.target.value)}
                className="field-input"
              />
            </label>
            <label className="field">
              <span className="field-label">Liczba sesji</span>
              <input
                type="number"
                min={1}
                max={20}
                value={quoteSessions}
                onChange={(e) => setQuoteSessions(e.target.value)}
                className="field-input"
              />
            </label>
            <label className="field">
              <span className="field-label">Notatka dla klienta</span>
              <textarea
                rows={3}
                value={quoteNote}
                onChange={(e) => setQuoteNote(e.target.value)}
                className="field-input"
              />
            </label>
            <button type="submit" disabled={pending} className="btn-primary self-start">
              Wyślij wycenę
            </button>
          </form>
        </section>
      ) : null}

      {item.canReject ? (
        <section className="border-t border-paper-line pt-8">
          <h2 className="section-title">Odrzucenie</h2>
          <form onSubmit={onReject} className="mt-4 flex max-w-md flex-col gap-3">
            <label className="field">
              <span className="field-label">Powód (trafi do wątku i e-maila)</span>
              <textarea
                required
                minLength={5}
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="field-input"
              />
            </label>
            <button type="submit" disabled={pending} className="btn-ghost self-start">
              Odrzuć zgłoszenie
            </button>
          </form>
        </section>
      ) : null}

      {item.canAssignArtist ? (
        <section className="border-t border-paper-line pt-8">
          <h2 className="section-title">Przypisz artystę</h2>
          <div className="mt-4 flex max-w-lg flex-wrap gap-2">
            <select
              value={assignId}
              onChange={(e) => setAssignId(e.target.value)}
              className="field-input min-w-[12rem] flex-1"
            >
              <option value="">Bez przypisania (pula)</option>
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
              className="btn-primary"
            >
              Zapisz
            </button>
          </div>
        </section>
      ) : null}

      <section className="border-t border-paper-line pt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="section-title">Wiadomości</h2>
          <p className="text-xs text-ink-faint">Odświeża się automatycznie</p>
        </div>
        <ul className="mt-4 flex flex-col gap-3">
          {messages.length === 0 ? (
            <li className="text-sm text-ink-muted">Brak wiadomości.</li>
          ) : (
            messages.map((m) => {
              const name =
                [m.author.firstName, m.author.lastName].filter(Boolean).join(' ') || m.author.email;
              return (
                <li
                  key={m.id}
                  className={`px-4 py-3 text-sm ${
                    m.system
                      ? 'border border-paper-line bg-paper-soft'
                      : 'border border-paper-line bg-paper-pure'
                  }`}
                >
                  <p className="text-xs text-ink-faint">
                    {m.system ? 'System' : name} · {new Date(m.createdAt).toLocaleString('pl-PL')}
                  </p>
                  <p className="mt-1.5 whitespace-pre-wrap leading-relaxed">{m.body}</p>
                </li>
              );
            })
          )}
        </ul>
        {item.canMessage ? (
          <form onSubmit={onSendMessage} className="mt-4 flex flex-col gap-2">
            <textarea
              rows={3}
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              placeholder="Napisz wiadomość…"
              className="field-input"
            />
            <button
              type="submit"
              disabled={pending || !messageBody.trim()}
              className="btn-primary self-start"
            >
              Wyślij
            </button>
          </form>
        ) : null}
      </section>

      {(item.isArchived && user?.role === 'ADMIN') ||
      (!item.isArchived && (item.canArchive || item.canHardDelete)) ? (
        <section className="border-t border-paper-line pt-8">
          <h2 className="section-title">Administracja</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {item.isArchived && user?.role === 'ADMIN' ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => void onRestore()}
                className="btn-ghost"
              >
                Przywróć z archiwum
              </button>
            ) : null}
            {!item.isArchived && item.canArchive ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => void onRemove('archive')}
                className="btn-danger"
              >
                Przenieś do archiwum
              </button>
            ) : null}
            {!item.isArchived && item.canHardDelete ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => void onRemove('hard')}
                className="btn-danger"
              >
                Usuń na zawsze
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {actionError ? (
        <p className="alert" role="alert">
          {actionError}
        </p>
      ) : null}
    </main>
  );
}
