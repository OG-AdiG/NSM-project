'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthForm, Field } from '@/components/auth-form';
import { apiFetch } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6">
        <h1 className="text-3xl font-semibold">Sprawdź skrzynkę e-mail</h1>
        <p className="text-neutral-600">
          Konto zostało utworzone. Wysłaliśmy link potwierdzający na adres{' '}
          <strong>{email}</strong>. Po weryfikacji możesz się zalogować.
        </p>
        <Link href="/logowanie" className="text-sm font-medium underline">
          Przejdź do logowania
        </Link>
      </main>
    );
  }

  return (
    <AuthForm
      title="Rejestracja"
      subtitle="Załóż konto klienta (FR-01)."
      submitLabel="Utwórz konto"
      onSubmit={async () => {
        await apiFetch('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ email, password, firstName, lastName }),
        });
        setDone(true);
        router.prefetch('/logowanie');
      }}
      footer={
        <>
          Masz już konto?{' '}
          <Link href="/logowanie" className="font-medium underline">
            Zaloguj się
          </Link>
        </>
      }
    >
      <Field label="Imię" id="firstName" value={firstName} onChange={setFirstName} autoComplete="given-name" />
      <Field label="Nazwisko" id="lastName" value={lastName} onChange={setLastName} autoComplete="family-name" />
      <Field
        label="E-mail"
        id="email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        required
      />
      <Field
        label="Hasło (min. 8 znaków, litera i cyfra)"
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
