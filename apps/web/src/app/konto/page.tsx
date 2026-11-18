'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Panel użytkownika jest na /zgloszenia — tu tylko przekierowanie. */
export default function AccountRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/zgloszenia');
  }, [router]);

  return (
    <main className="page-wide">
      <p className="lede">Przekierowanie do panelu…</p>
    </main>
  );
}
