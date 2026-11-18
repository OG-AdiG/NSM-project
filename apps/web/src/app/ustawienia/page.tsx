'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getAccessToken, getStoredUser, StoredUser } from '@/lib/auth-storage';

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/logowanie');
      return;
    }
    setUser(getStoredUser());
  }, [router]);

  return (
    <main className="page-narrow">
      <header className="border-b border-paper-line pb-8">
        <Link href="/zgloszenia" className="back-link">
          ← Panel
        </Link>
        <h1 className="font-display mt-3 text-4xl tracking-tight text-ink">Ustawienia</h1>
        <p className="mt-2 text-sm text-ink-muted">Preferencje konta i powiadomień.</p>
      </header>

      <section className="mt-8 space-y-6">
        <div className="border border-paper-line bg-paper-pure px-5 py-5">
          <h2 className="text-sm font-medium text-ink">Konto</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Imię, e-mail i weryfikacja adresu znajdziesz w profilu.
          </p>
          <Link href="/profil" className="btn-ghost btn-sm mt-4 inline-flex">
            Przejdź do profilu
          </Link>
        </div>

        <div className="border border-paper-line bg-paper-pure px-5 py-5">
          <h2 className="text-sm font-medium text-ink">Powiadomienia e-mail</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Na adres {user?.email ?? 'powiązany z kontem'} wysyłamy potwierdzenia wycen, wiadomości
            i przypomnienia o terminach. Szczegółowe przełączniki pojawią się w kolejnej wersji.
          </p>
        </div>

        <div className="border border-paper-line bg-paper-pure px-5 py-5">
          <h2 className="text-sm font-medium text-ink">Hasło</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">
            Możesz zresetować hasło przez formularz przypomnienia — wyślemy link na e-mail.
          </p>
          <Link href="/przypomnij-haslo" className="btn-ghost btn-sm mt-4 inline-flex">
            Reset hasła
          </Link>
        </div>
      </section>
    </main>
  );
}
