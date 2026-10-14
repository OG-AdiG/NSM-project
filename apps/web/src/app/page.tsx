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
      <ul className="list-disc space-y-1 pl-5 text-neutral-700">
        <li>Zgłoszenia projektów i wycena orientacyjna</li>
        <li>Rezerwacje, zadatki, dokumenty</li>
        <li>Panel artysty i administratora</li>
      </ul>
    </main>
  );
}
