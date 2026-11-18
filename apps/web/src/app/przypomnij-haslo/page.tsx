'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AuthForm, Field } from '@/components/auth-form';
import { apiFetch } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState('');

  if (done) {
    return (
      <main className="page-narrow justify-center">
        <h1 className="display !text-3xl">Sprawdź e-mail</h1>
        <p className="text-ink-muted">{message}</p>
        <Link href="/logowanie" className="btn-text">
          Powrót do logowania
        </Link>
      </main>
    );
  }

  return (
    <AuthForm
      title="Przypomnij hasło"
      subtitle="Wyślemy link do resetu hasła."
      submitLabel="Wyślij link"
      onSubmit={async () => {
        const res = await apiFetch<{ message: string }>('/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email }),
        });
        setMessage(res.message);
        setDone(true);
      }}
      footer={
        <Link href="/logowanie" className="btn-text">
          Powrót do logowania
        </Link>
      }
    >
      <Field
        label="E-mail"
        id="email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        required
      />
    </AuthForm>
  );
}
