'use client';

import Link from 'next/link';
import { FormEvent, ReactNode, useState } from 'react';

type Props = {
  title: string;
  subtitle?: string;
  submitLabel: string;
  onSubmit: () => Promise<void>;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthForm({ title, subtitle, submitLabel, onSubmit, children, footer }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await onSubmit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wystąpił błąd');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6 py-12">
      <div>
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-800">
          ← NSM Studio
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-2 text-neutral-600">{subtitle}</p> : null}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {children}
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
          {pending ? 'Proszę czekać…' : submitLabel}
        </button>
      </form>

      {footer ? <div className="text-sm text-neutral-600">{footer}</div> : null}
    </main>
  );
}

export function Field({
  label,
  id,
  type = 'text',
  value,
  onChange,
  autoComplete,
  required,
}: {
  label: string;
  id: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-neutral-800">{label}</span>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-neutral-300 bg-white px-3 py-2 outline-none ring-neutral-400 focus:ring-2"
      />
    </label>
  );
}
