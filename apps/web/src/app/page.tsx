import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">NSM Project</p>
      <h1 className="text-4xl font-semibold tracking-tight">
        System obsługi klientów i usług studia tatuażu
      </h1>
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
        <Link href="/zgloszenie" className="rounded px-4 py-2.5 text-sm font-medium underline">
          Nowe zgłoszenie
        </Link>
      </div>
    </main>
  );
}
