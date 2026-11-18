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
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (visible ? 'text' : 'password') : type;

  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-neutral-800">{label}</span>
      <span className="relative block">
        <input
          id={id}
          name={id}
          type={inputType}
          value={value}
          required={required}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded border border-neutral-300 bg-white px-3 py-2 outline-none ring-neutral-400 focus:ring-2 ${
            isPassword ? 'pr-11' : ''
          }`}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-neutral-500 hover:text-neutral-800"
            aria-label={visible ? 'Ukryj hasło' : 'Pokaż hasło'}
            title={visible ? 'Ukryj hasło' : 'Pokaż hasło'}
          >
            {visible ? <IconEyeOff /> : <IconEye />}
          </button>
        ) : null}
      </span>
    </label>
  );
}

function IconEye() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.25 12s3.75-6.75 9.75-6.75S21.75 12 21.75 12s-3.75 6.75-9.75 6.75S2.25 12 2.25 12Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.75" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconEyeOff() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3.5 3.5 20.5 20.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M9.88 5.09A10.4 10.4 0 0 1 12 4.75c6 0 9.75 7.25 9.75 7.25a16.7 16.7 0 0 1-3.2 3.78M6.61 6.61C3.9 8.47 2.25 12 2.25 12S6 18.75 12 18.75c1.4 0 2.7-.33 3.86-.9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.1 10.1a2.75 2.75 0 0 0 3.8 3.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
