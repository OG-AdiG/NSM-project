'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AuthForm, Field } from '@/components/auth-form';
import { apiFetch } from '@/lib/api';

function ResetInner() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState('');

  if (!token) {
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <p className="text-red-700">Brak tokenu resetu w odnośniku.</p>
        <Link href="/przypomnij-haslo" className="mt-4 inline-block underline">
          Poproś o nowy link
        </Link>
      </main>
    );
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6">
        <h1 className="text-3xl font-semibold">Hasło zmienione</h1>
        <p className="text-neutral-600">{message}</p>
        <Link href="/logowanie" className="underline">
          Zaloguj się
        </Link>
      </main>
    );
  }

  return (
    <AuthForm
      title="Nowe hasło"
      subtitle="Ustaw nowe hasło do konta."
      submitLabel="Zapisz hasło"
      onSubmit={async () => {
        const res = await apiFetch<{ message: string }>('/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ token, password }),
        });
        setMessage(res.message);
        setDone(true);
      }}
    >
      <Field
        label="Nowe hasło (min. 8 znaków, litera i cyfra)"
        id="password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        required
      />
    </AuthForm>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="p-16 text-center">Ładowanie…</main>}>
      <ResetInner />
    </Suspense>
  );
}
