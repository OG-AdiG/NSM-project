'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_SLOT_MINUTES,
  SESSION_STATUS_LABELS,
  SESSION_TYPE_LABELS,
  SESSION_TYPES,
  SessionStatus,
  SessionType,
} from '@nsm/shared';
import { apiFetch, ApiError } from '@/lib/api';
import { getAccessToken } from '@/lib/auth-storage';

type ProjectProgress = {
  plannedSessions: number;
  bookedSessions: number;
  completedSessions: number;
  remainingSessions: number;
  canBookMore: boolean;
  sessions: Array<{
    id: string;
    sessionIndex: number;
    startsAt: string;
    endsAt: string;
    status: SessionStatus;
  }>;
};

type Slot = { startsAt: string; endsAt: string };

type Props = {
  submissionId: string;
  artistId: string | null | undefined;
  status: string;
  preferredDate?: string | null;
  preferredSlotStart?: string | null;
};

function todayLocalIsoDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayRangeIso(dateStr: string) {
  const start = new Date(`${dateStr}T00:00:00`);
  const end = new Date(`${dateStr}T23:59:59.999`);
  return { from: start.toISOString(), to: end.toISOString() };
}

const DURATION_OPTIONS = [60, 90, 120, 180, 240] as const;

function toLocalDateInput(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function BookingPanel({
  submissionId,
  artistId,
  status,
  preferredDate,
  preferredSlotStart,
}: Props) {
  const [progress, setProgress] = useState<ProjectProgress | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const initialDate =
    toLocalDateInput(preferredDate) ||
    toLocalDateInput(preferredSlotStart) ||
    todayLocalIsoDate();

  const [date, setDate] = useState(initialDate);
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_SLOT_MINUTES);
  const [sessionType, setSessionType] = useState<SessionType>('SESSION');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const minDate = todayLocalIsoDate();
  const maxDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const reloadProgress = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    const p = await apiFetch<ProjectProgress>(`/sessions/project/${submissionId}`, {
      accessToken: token,
    });
    setProgress(p);
  }, [submissionId]);

  useEffect(() => {
    if (status !== 'ACCEPTED' && status !== 'COMPLETED') return;
    reloadProgress().catch((err: Error) => setError(err.message));
  }, [reloadProgress, status]);

  useEffect(() => {
    if (!artistId || status !== 'ACCEPTED') {
      setSlots([]);
      return;
    }
    setLoadingSlots(true);
    setSelectedSlot(null);
    setError(null);
    const { from, to } = dayRangeIso(date);
    apiFetch<{ slots: Slot[] }>(
      `/artists/${artistId}/slots?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&durationMinutes=${durationMinutes}`,
    )
      .then((res) => setSlots(res.slots))
      .catch((err: Error) => {
        setSlots([]);
        setError(err.message);
      })
      .finally(() => setLoadingSlots(false));
  }, [artistId, date, durationMinutes, status]);

  async function book() {
    const token = getAccessToken();
    if (!token || !artistId || !selectedSlot) return;
    const slot = slots.find((s) => s.startsAt === selectedSlot);
    if (!slot) return;

    setPending(true);
    setError(null);
    try {
      await apiFetch('/sessions', {
        method: 'POST',
        accessToken: token,
        body: JSON.stringify({
          artistId,
          submissionId,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          type: sessionType,
        }),
      });
      setSelectedSlot(null);
      await reloadProgress();
      // odśwież sloty po rezerwacji
      const { from, to } = dayRangeIso(date);
      const res = await apiFetch<{ slots: Slot[] }>(
        `/artists/${artistId}/slots?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&durationMinutes=${durationMinutes}`,
      );
      setSlots(res.slots);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Nie udało się zarezerwować');
    } finally {
      setPending(false);
    }
  }

  if (status !== 'ACCEPTED' && status !== 'COMPLETED') return null;

  return (
    <section className="border-t border-paper-line pt-8">
      <div>
        <h2 className="section-title">Rezerwacja terminu</h2>
        {progress ? (
          <p className="mt-2 text-sm text-ink-muted">
            Zaplanowano {progress.plannedSessions}, zarezerwowano {progress.bookedSessions},
            zakończono {progress.completedSessions}
            {progress.remainingSessions > 0
              ? ` · pozostało do umówienia: ${progress.remainingSessions}`
              : ''}
          </p>
        ) : (
          <p className="mt-2 text-sm text-ink-faint">Ładowanie postępu sesji…</p>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-4">

      {progress && progress.sessions.length > 0 ? (
        <ul className="flex flex-col gap-2 text-sm">
          {progress.sessions.map((s) => (
            <li key={s.id} className="border border-paper-line px-3 py-2">
              Sesja #{s.sessionIndex}: {new Date(s.startsAt).toLocaleString('pl-PL')} –{' '}
              {new Date(s.endsAt).toLocaleTimeString('pl-PL', {
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              · {SESSION_STATUS_LABELS[s.status]}
            </li>
          ))}
        </ul>
      ) : null}

      {progress?.canBookMore && artistId ? (
        <div className="panel flex flex-col gap-3">
          <p className="text-sm font-medium">
            {progress.bookedSessions === 0 ? 'Umów pierwszą sesję' : 'Umów kolejną sesję'}
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Data</span>
              <input
                type="date"
                required
                min={minDate}
                max={maxDate}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="field-input"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Czas trwania</span>
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

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Typ</span>
              <select
                value={sessionType}
                onChange={(e) => setSessionType(e.target.value as SessionType)}
                className="field-input"
              >
                {SESSION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {SESSION_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Godzina</span>
            {loadingSlots ? (
              <p className="text-sm text-ink-faint">Szukam wolnych godzin…</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-ink-muted">
                Brak wolnych terminów w tym dniu. Wybierz inną datę albo sprawdź grafik artysty.
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
                      disabled={pending}
                      onClick={() => setSelectedSlot(s.startsAt)}
                      className={`chip ${active ? 'chip-active' : ''} disabled:opacity-45`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={pending || !selectedSlot}
            onClick={() => void book()}
            className="self-start btn-primary"
          >
            {pending ? 'Rezerwuję…' : 'Zarezerwuj termin'}
          </button>
        </div>
      ) : null}

      {!artistId && status === 'ACCEPTED' ? (
        <p className="text-sm text-ink-muted">
          Aby rezerwować terminy, zgłoszenie musi mieć przypisanego artystę.
        </p>
      ) : null}

      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      </div>
    </section>
  );
}
