'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { WEEKDAY_LABELS } from '@nsm/shared';
import { apiFetch, ApiError } from '@/lib/api';
import { getAccessToken, getStoredUser } from '@/lib/auth-storage';

type Slot = { id?: string; weekday: number; startMin: number; endMin: number };
type Absence = { id: string; startsAt: string; endsAt: string; reason: string | null };

function minToTime(m: number) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function timeToMin(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export default function SchedulePage() {
  const router = useRouter();
  const [artistId, setArtistId] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [access, setAccess] = useState<'loading' | 'allowed' | 'denied'>('loading');

  const [absStart, setAbsStart] = useState('');
  const [absEnd, setAbsEnd] = useState('');
  const [absReason, setAbsReason] = useState('');

  const load = useCallback(async (id: string) => {
    const token = getAccessToken();
    if (!token) return;
    const [weekly, abs] = await Promise.all([
      apiFetch<Slot[]>(`/artists/${id}/availability`),
      apiFetch<Absence[]>(`/artists/${id}/absences`, { accessToken: token }),
    ]);
    setSlots(
      weekly.length
        ? weekly
        : [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMin: 600, endMin: 1080 })),
    );
    setAbsences(abs);
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    const user = getStoredUser();
    if (!token || !user) {
      setAccess('denied');
      router.replace('/logowanie');
      return;
    }
    if (user.role !== 'ARTIST' && user.role !== 'ADMIN') {
      setAccess('denied');
      router.replace('/zgloszenia');
      return;
    }

    setAccess('allowed');

    if (user.role === 'ADMIN') {
      apiFetch<{ userId: string }[]>('/artists')
        .then((list) => {
          const first = list[0]?.userId;
          if (!first) {
            setError('Brak aktywnych artystów');
            return;
          }
          setArtistId(first);
          return load(first);
        })
        .catch((err: Error) => setError(err.message));
      return;
    }

    setArtistId(user.id);
    load(user.id).catch((err: Error) => setError(err.message));
  }, [load, router]);

  function updateSlot(weekday: number, field: 'startMin' | 'endMin', value: string) {
    const mins = timeToMin(value);
    setSlots((prev) => {
      const exists = prev.find((s) => s.weekday === weekday);
      if (!exists) {
        return [...prev, { weekday, startMin: field === 'startMin' ? mins : 600, endMin: field === 'endMin' ? mins : 1080 }];
      }
      return prev.map((s) => (s.weekday === weekday ? { ...s, [field]: mins } : s));
    });
  }

  function toggleDay(weekday: number, enabled: boolean) {
    if (enabled) {
      setSlots((prev) =>
        prev.some((s) => s.weekday === weekday)
          ? prev
          : [...prev, { weekday, startMin: 600, endMin: 1080 }],
      );
    } else {
      setSlots((prev) => prev.filter((s) => s.weekday !== weekday));
    }
  }

  async function saveWeekly(e: FormEvent) {
    e.preventDefault();
    if (!artistId) return;
    const token = getAccessToken();
    if (!token) return;
    setPending(true);
    setError(null);
    try {
      const saved = await apiFetch<Slot[]>(`/artists/${artistId}/availability`, {
        method: 'PUT',
        accessToken: token,
        body: JSON.stringify({
          slots: slots.map(({ weekday, startMin, endMin }) => ({ weekday, startMin, endMin })),
        }),
      });
      setSlots(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nie udało się zapisać grafiku');
    } finally {
      setPending(false);
    }
  }

  async function addAbsence(e: FormEvent) {
    e.preventDefault();
    if (!artistId) return;
    const token = getAccessToken();
    if (!token) return;
    setPending(true);
    setError(null);
    try {
      await apiFetch(`/artists/${artistId}/absences`, {
        method: 'POST',
        accessToken: token,
        body: JSON.stringify({
          startsAt: new Date(absStart).toISOString(),
          endsAt: new Date(absEnd).toISOString(),
          reason: absReason || undefined,
        }),
      });
      setAbsStart('');
      setAbsEnd('');
      setAbsReason('');
      await load(artistId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nie udało się dodać nieobecności');
    } finally {
      setPending(false);
    }
  }

  async function removeAbsence(id: string) {
    if (!artistId) return;
    const token = getAccessToken();
    if (!token) return;
    try {
      await apiFetch(`/artists/${artistId}/absences/${id}`, {
        method: 'DELETE',
        accessToken: token,
      });
      await load(artistId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nie udało się usunąć');
    }
  }

  if (access !== 'allowed') {
    return (
      <main className="page-wide">
        <p className="lede">{access === 'loading' ? 'Ładowanie…' : 'Brak dostępu do grafiku.'}</p>
        {access === 'denied' ? (
          <Link href="/zgloszenia" className="btn-text mt-4">
            Wróć do panelu
          </Link>
        ) : null}
      </main>
    );
  }

  return (
    <main className="page-wide">
      <div>
        <Link href="/zgloszenia" className="back-link">
          ← Panel
        </Link>
        <h1 className="font-display mt-3 text-4xl tracking-tight text-ink">Grafik</h1>
        <p className="mt-2 text-sm text-ink-muted">Godziny pracy i nieobecności.</p>
      </div>

      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}

      <form onSubmit={saveWeekly} className="mt-8 flex flex-col gap-3">
        <h2 className="text-lg font-medium">Tydzień roboczy</h2>
        {[1, 2, 3, 4, 5, 6, 7].map((wd) => {
          const slot = slots.find((s) => s.weekday === wd);
          const on = Boolean(slot);
          return (
            <div key={wd} className="flex flex-wrap items-center gap-3 text-sm">
              <label className="flex w-36 items-center gap-2">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) => toggleDay(wd, e.target.checked)}
                />
                {WEEKDAY_LABELS[wd]}
              </label>
              {on ? (
                <>
                  <input
                    type="time"
                    value={minToTime(slot!.startMin)}
                    onChange={(e) => updateSlot(wd, 'startMin', e.target.value)}
                    className="field-input !w-auto py-1.5"
                  />
                  <span className="text-ink-faint">–</span>
                  <input
                    type="time"
                    value={minToTime(slot!.endMin)}
                    onChange={(e) => updateSlot(wd, 'endMin', e.target.value)}
                    className="field-input !w-auto py-1.5"
                  />
                </>
              ) : (
                <span className="text-ink-faint">wolne</span>
              )}
            </div>
          );
        })}
        <button
          type="submit"
          disabled={pending}
          className="mt-2 self-start btn-primary"
        >
          Zapisz grafik
        </button>
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Nieobecności</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {absences.length === 0 ? (
            <li className="text-ink-muted">Brak zaplanowanych nieobecności.</li>
          ) : (
            absences.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 border border-paper-line px-3 py-2">
                <span>
                  {new Date(a.startsAt).toLocaleString('pl-PL')} –{' '}
                  {new Date(a.endsAt).toLocaleString('pl-PL')}
                  {a.reason ? ` · ${a.reason}` : ''}
                </span>
                <button type="button" className="btn-danger" onClick={() => void removeAbsence(a.id)}>
                  Usuń
                </button>
              </li>
            ))
          )}
        </ul>
        <form onSubmit={addAbsence} className="flex flex-col gap-2 text-sm">
          <label className="flex flex-col gap-1">
            Od
            <input
              type="datetime-local"
              required
              value={absStart}
              onChange={(e) => setAbsStart(e.target.value)}
              className="field-input"
            />
          </label>
          <label className="flex flex-col gap-1">
            Do
            <input
              type="datetime-local"
              required
              value={absEnd}
              onChange={(e) => setAbsEnd(e.target.value)}
              className="field-input"
            />
          </label>
          <label className="flex flex-col gap-1">
            Powód (opcjonalnie)
            <input
              value={absReason}
              onChange={(e) => setAbsReason(e.target.value)}
              className="field-input"
            />
          </label>
          <button type="submit" disabled={pending} className="btn-ghost self-start">
            Dodaj nieobecność
          </button>
        </form>
      </section>
    </main>
  );
}
