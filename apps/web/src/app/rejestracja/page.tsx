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
      <main className="page-narrow justify-center">
        <h1 className="display !text-3xl">Sprawdź skrzynkę e-mail</h1>
        <p className="lede">
          Konto zostało utworzone. Wysłaliśmy link potwierdzający na adres{' '}
          <strong className="text-ink">{email}</strong>. Po weryfikacji możesz się zalogować.
        </p>
        <Link href="/logowanie" className="btn-primary self-start">
          Przejdź do logowania
        </Link>
      </main>
    );
  }

  return (
    <AuthForm
      title="Rejestracja"
      subtitle="Załóż konto klienta."
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
          <Link href="/logowanie" className="btn-text">
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
