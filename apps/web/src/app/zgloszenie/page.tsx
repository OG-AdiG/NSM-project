'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import {
  BODY_PART_OPTIONS,
  COLOR_MODE_LABELS,
  COLOR_MODES,
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

const ACCEPT = REFERENCE_PHOTO.allowedMimeTypes.join(',');
const MAX_MB = Math.round(REFERENCE_PHOTO.maxBytes / (1024 * 1024));

export default function NewSubmissionPage() {
  const router = useRouter();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [description, setDescription] = useState('');
  const [bodyPart, setBodyPart] = useState('');
  const [size, setSize] = useState('');
  const [style, setStyle] = useState('');
  const [colorMode, setColorMode] = useState<(typeof COLOR_MODES)[number]>('BLACK_GREY');
  const [preferredArtistId, setPreferredArtistId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
          ...(preferredArtistId ? { preferredArtistId } : {}),
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
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-6 py-12">
      <div>
        <Link href="/zgloszenia" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← Moje zgłoszenia
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Nowe zgłoszenie</h1>
        <p className="mt-2 text-neutral-600">
          Opisz pomysł na tatuaż i dołącz zdjęcia referencyjne (opcjonalnie).
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
            className="rounded border border-neutral-300 px-3 py-2 outline-none ring-neutral-400 focus:ring-2"
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
            className="rounded border border-neutral-300 px-3 py-2 outline-none ring-neutral-400 focus:ring-2"
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
            className="rounded border border-neutral-300 px-3 py-2 outline-none ring-neutral-400 focus:ring-2"
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
            className="rounded border border-neutral-300 px-3 py-2 outline-none ring-neutral-400 focus:ring-2"
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
            className="rounded border border-neutral-300 bg-white px-3 py-2 outline-none ring-neutral-400 focus:ring-2"
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
            className="text-sm file:mr-3 file:rounded file:border-0 file:bg-neutral-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
          />
          {files.length > 0 ? (
            <ul className="space-y-1 text-neutral-700">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    {f.name} ({Math.round(f.size / 1024)} KB)
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="shrink-0 text-neutral-500 underline hover:text-neutral-900"
                  >
                    Usuń
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {error ? (
          <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
        >
          {pending ? 'Wysyłanie…' : 'Wyślij zgłoszenie'}
        </button>
      </form>
    </main>
  );
}
