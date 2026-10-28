import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">NSM Project</p>
      <h1 className="text-4xl font-semibold tracking-tight">
        System obsługi klientów i usług studia tatuażu
      </h1>
      <p className="text-lg text-neutral-600">
        Aplikacja webowa (moduł klienta + panel administratora). Backend:{' '}
        <code className="rounded bg-neutral-200 px-1.5 py-0.5 text-sm">/api/health</code>
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/rejestracja"
          className="rounded bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Rejestracja
        </Link>
        <Link
          href="/logowanie"
          className="rounded border border-neutral-300 px-4 py-2.5 text-sm font-medium hover:bg-neutral-100"
        >
          Logowanie
        </Link>
        <Link href="/konto" className="rounded px-4 py-2.5 text-sm font-medium underline">
          Moje konto
        </Link>
      </div>
      <ul className="list-disc space-y-1 pl-5 text-neutral-700">
        <li>Auth: rejestracja, weryfikacja e-mail, JWT, role (FR-01–FR-04)</li>
        <li>Następne: zgłoszenia, wycena, rezerwacje…</li>
      </ul>
    </main>
  );
}
