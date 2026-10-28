'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

function VerifyInner() {
  const params = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Brak tokenu weryfikacyjnego w odnośniku.');
      return;
    }
    apiFetch<{ message: string }>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
      .then((r) => {
        setStatus('ok');
        setMessage(r.message);
      })
      .catch((err: Error) => {
        setStatus('error');
        setMessage(err.message);
      });
  }, [token]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6">
      <h1 className="text-3xl font-semibold">Weryfikacja e-mail</h1>
      {status === 'loading' ? <p className="text-neutral-600">Potwierdzanie…</p> : null}
      {status === 'ok' ? <p className="text-green-800">{message}</p> : null}
      {status === 'error' ? <p className="text-red-700">{message}</p> : null}
      <Link href="/logowanie" className="text-sm font-medium underline">
        Przejdź do logowania
      </Link>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<main className="p-16 text-center">Ładowanie…</main>}>
      <VerifyInner />
    </Suspense>
  );
}
