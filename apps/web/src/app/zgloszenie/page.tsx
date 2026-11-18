'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  BODY_PART_OPTIONS,
  COLOR_MODE_LABELS,
  COLOR_MODES,
  DEFAULT_SLOT_MINUTES,
  estimateTattooPrice,
  REFERENCE_PHOTO,
  SIZE_OPTIONS,
  STYLE_OPTIONS,
} from '@nsm/shared';
import { apiFetch, ApiError } from '@/lib/api';
import { getAccessToken } from '@/lib/auth-storage';

type Artist = {
  id: string;
  userId: string;
  displayName: string;
  styles: string[];
  bio: string | null;
};

type Slot = { startsAt: string; endsAt: string };

const ACCEPT = REFERENCE_PHOTO.allowedMimeTypes.join(',');
const MAX_MB = Math.round(REFERENCE_PHOTO.maxBytes / (1024 * 1024));
const DURATION_OPTIONS = [60, 90, 120, 180, 240] as const;

function todayLocalIsoDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayRangeIso(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(`${dateStr}T23:59:59.999`);
  return { from: start.toISOString(), to: end.toISOString() };
}

export default function NewSubmissionPage() {
  const router = useRouter();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [description, setDescription] = useState('');
  const [bodyPart, setBodyPart] = useState('');
  const [size, setSize] = useState('');
  const [style, setStyle] = useState('');
  const [colorMode, setColorMode] = useState<(typeof COLOR_MODES)[number]>('BLACK_GREY');
  const [preferredArtistId, setPreferredArtistId] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_SLOT_MINUTES);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [timeNote, setTimeNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const minDate = todayLocalIsoDate();
  const maxDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 90);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const estimate = useMemo(() => {
    if (!bodyPart.trim() || !size.trim() || !style.trim()) return null;
    return estimateTattooPrice({ bodyPart, size, style, colorMode });
  }, [bodyPart, size, style, colorMode]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace('/logowanie');
      return;
    }
    apiFetch<Artist[]>('/artists')
      .then(setArtists)
      .catch(() => setArtists([]));
  }, [router]);

  useEffect(() => {
    setSelectedSlot(null);
    setSlots([]);
    if (!preferredArtistId || !preferredDate) return;

    setLoadingSlots(true);
    const { from, to } = dayRangeIso(preferredDate);
    apiFetch<{ slots: Slot[] }>(
      `/artists/${preferredArtistId}/slots?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&durationMinutes=${durationMinutes}`,
    )
      .then((res) => setSlots(res.slots))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [preferredArtistId, preferredDate, durationMinutes]);

  function onFilesChange(list: FileList | null) {
    if (!list) return;
    setError(null);
    const next = [...files];
    for (const file of Array.from(list)) {
      if (next.length >= REFERENCE_PHOTO.maxFiles) {
        setError(`Można dodać maksymalnie ${REFERENCE_PHOTO.maxFiles} zdjęć`);
        break;
      }
      if (!(REFERENCE_PHOTO.allowedMimeTypes as readonly string[]).includes(file.type)) {
        setError('Dozwolone typy: JPEG, PNG, WebP');
        continue;
      }
      if (file.size > REFERENCE_PHOTO.maxBytes) {
        setError(`Plik „${file.name}” przekracza ${MAX_MB} MB`);
        continue;
      }
      next.push(file);
    }
    setFiles(next);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const token = getAccessToken();
    if (!token) {
      router.replace('/logowanie');
      return;
    }
    if (!preferredDate) {
      setError('Wybierz preferowaną datę wizyty');
      return;
    }

    const slot = selectedSlot ? slots.find((s) => s.startsAt === selectedSlot) : null;

    setPending(true);
    try {
      const created = await apiFetch<{ id: string }>('/submissions', {
        method: 'POST',
        accessToken: token,
        body: JSON.stringify({
          description,
          bodyPart,
          size,
          style,
          colorMode,
          preferredDate,
          ...(preferredArtistId ? { preferredArtistId } : {}),
          ...(slot
            ? { preferredSlotStart: slot.startsAt, preferredSlotEnd: slot.endsAt }
            : {}),
          ...(timeNote.trim() ? { preferredTimeNote: timeNote.trim() } : {}),
        }),
      });

      for (const file of files) {
        const form = new FormData();
        form.append('file', file);
        await apiFetch(`/submissions/${created.id}/photos`, {
          method: 'POST',
          accessToken: token,
          body: form,
        });
      }

      router.push(`/zgloszenia/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nie udało się wysłać zgłoszenia');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="page">
      <div>
        <Link href="/zgloszenia" className="text-sm back-link">
          ← Moje zgłoszenia
        </Link>
        <p className="eyebrow mt-6">Formularz</p>
        <h1 className="display mt-2 !text-3xl">Nowe zgłoszenie</h1>
        <p className="lede mt-2">
          Opisz pomysł, wybierz preferowaną datę i ewentualnie godzinę.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Opis projektu</span>
          <textarea
            required
            minLength={10}
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Opisz motyw, nastrój, elementy, których chcesz uniknąć…"
            className="field-input "
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Miejsce na ciele</span>
          <input
            required
            list="body-parts"
            value={bodyPart}
            onChange={(e) => setBodyPart(e.target.value)}
            placeholder="np. przedramię"
            className="field-input "
          />
          <datalist id="body-parts">
            {BODY_PART_OPTIONS.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Rozmiar</span>
          <input
            required
            list="sizes"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            placeholder="np. średni (5–15 cm)"
            className="field-input "
          />
          <datalist id="sizes">
            {SIZE_OPTIONS.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Styl</span>
          <input
            required
            list="styles"
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            placeholder="np. fineline"
            className="field-input "
          />
          <datalist id="styles">
            {STYLE_OPTIONS.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </label>

        <fieldset className="flex flex-col gap-2 text-sm">
          <legend className="font-medium">Kolor</legend>
          <div className="flex flex-wrap gap-4">
            {COLOR_MODES.map((mode) => (
              <label key={mode} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="colorMode"
                  value={mode}
                  checked={colorMode === mode}
                  onChange={() => setColorMode(mode)}
                />
                {COLOR_MODE_LABELS[mode]}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Preferowany artysta (opcjonalnie)</span>
          <select
            value={preferredArtistId}
            onChange={(e) => setPreferredArtistId(e.target.value)}
            className="field-input "
          >
            <option value="">Bez preferencji</option>
            {artists.map((a) => (
              <option key={a.userId} value={a.userId}>
                {a.displayName}
                {a.styles.length ? ` — ${a.styles.join(', ')}` : ''}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="panel flex flex-col gap-3">
          <legend className="px-1 text-sm font-medium">Preferowany termin</legend>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Data</span>
            <input
              type="date"
              required
              min={minDate}
              max={maxDate}
              value={preferredDate}
              onChange={(e) => setPreferredDate(e.target.value)}
              className="field-input "
            />
          </label>

          {preferredArtistId ? (
            <>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Czas trwania sesji</span>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="field-input"
                >
                  {DURATION_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m} min
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-col gap-2 text-sm">
                <span className="font-medium">Godzina (z grafiku artysty)</span>
                {!preferredDate ? (
                  <p className="text-ink-muted">Najpierw wybierz datę.</p>
                ) : loadingSlots ? (
                  <p className="text-ink-faint">Ładowanie wolnych godzin…</p>
                ) : slots.length === 0 ? (
                  <p className="text-ink-muted">
                    Brak wolnych slotów tego dnia. Wybierz inną datę albo dopisz uwagi poniżej.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {slots.map((s) => {
                      const label = new Date(s.startsAt).toLocaleTimeString('pl-PL', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const active = selectedSlot === s.startsAt;
                      return (
                        <button
                          key={s.startsAt}
                          type="button"
                          onClick={() => setSelectedSlot(s.startsAt)}
                          className={`chip ${active ? 'chip-active' : ''}`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-ink-faint">
                  To preferencja — ostateczną rezerwację zrobisz po akceptacji wyceny.
                </p>
              </div>
            </>
          ) : null}

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Uwagi do terminu (opcjonalnie)</span>
            <input
              value={timeNote}
              onChange={(e) => setTimeNote(e.target.value)}
              placeholder="np. najlepiej po 16:00, unikam poniedziałków"
              className="field-input "
            />
          </label>
        </fieldset>

        {estimate ? (
          <div className="rounded border border-paper-line bg-paper-soft px-4 py-3 text-sm">
            <p className="font-medium">Szacunkowe widełki</p>
            <p className="mt-1 text-lg font-semibold">
              {estimate.minPln}–{estimate.maxPln} zł
            </p>
            <p className="mt-1 text-ink-muted">
              Orientacyjnie ok. {estimate.suggestedSessions}{' '}
              {estimate.suggestedSessions === 1 ? 'sesja' : 'sesje'}. Ostateczną wycenę poda artysta.
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 text-sm">
          <span className="font-medium">
            Zdjęcia referencyjne (opcjonalnie, max {REFERENCE_PHOTO.maxFiles}, do {MAX_MB} MB)
          </span>
          <input
            type="file"
            accept={ACCEPT}
            multiple
            onChange={(e) => {
              onFilesChange(e.target.files);
              e.target.value = '';
            }}
            className="file-input"
          />
          {files.length > 0 ? (
            <ul className="space-y-1 text-ink-soft">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    {f.name} ({Math.round(f.size / 1024)} KB)
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="btn-danger shrink-0 text-xs"
                  >
                    Usuń
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {error ? (
          <p className="alert" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="btn-primary"
        >
          {pending ? 'Wysyłanie…' : 'Wyślij zgłoszenie'}
        </button>
      </form>
    </main>
  );
}
