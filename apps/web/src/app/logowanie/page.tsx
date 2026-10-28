'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthForm, Field } from '@/components/auth-form';
import { apiFetch } from '@/lib/api';
import { saveSession, StoredUser } from '@/lib/auth-storage';

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: StoredUser;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <AuthForm
      title="Logowanie"
      subtitle="Zaloguj się do konta NSM (FR-02)."
      submitLabel="Zaloguj"
      onSubmit={async () => {
        const data = await apiFetch<LoginResponse>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        saveSession(data.accessToken, data.refreshToken, data.user);
        router.push('/konto');
      }}
      footer={
        <div className="flex flex-col gap-1">
          <span>
            Nie masz konta?{' '}
            <Link href="/rejestracja" className="font-medium underline">
              Zarejestruj się
            </Link>
          </span>
          <Link href="/przypomnij-haslo" className="underline">
            Nie pamiętam hasła
          </Link>
        </div>
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
      <Field
        label="Hasło"
        id="password"
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        required
      />
    </AuthForm>
  );
}
