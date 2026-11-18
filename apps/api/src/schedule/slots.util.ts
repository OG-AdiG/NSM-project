export type Interval = { start: Date; end: Date };

export function minutesToDate(day: Date, minutes: number): Date {
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minutes);
  return d;
}

export function isoWeekday(date: Date): number {
  const js = date.getDay(); // 0=nd
  return js === 0 ? 7 : js;
}

/** Wycina zajęte odcinki z wolnych okien */
export function subtractIntervals(free: Interval[], busy: Interval[]): Interval[] {
  let result = [...free];
  for (const b of busy) {
    const next: Interval[] = [];
    for (const f of result) {
      if (b.end <= f.start || b.start >= f.end) {
        next.push(f);
        continue;
      }
      if (b.start > f.start) {
        next.push({ start: f.start, end: b.start });
      }
      if (b.end < f.end) {
        next.push({ start: b.end, end: f.end });
      }
    }
    result = next;
  }
  return result.filter((i) => i.end.getTime() - i.start.getTime() > 0);
}

export function sliceSlots(windows: Interval[], durationMs: number, stepMs: number): Interval[] {
  const slots: Interval[] = [];
  for (const w of windows) {
    let cursor = w.start.getTime();
    const end = w.end.getTime();
    while (cursor + durationMs <= end) {
      slots.push({
        start: new Date(cursor),
        end: new Date(cursor + durationMs),
      });
      cursor += stepMs;
    }
  }
  return slots;
}
