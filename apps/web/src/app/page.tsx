import Image from 'next/image';
import { HomeHeroCtas } from '@/components/home-hero-ctas';

export default function HomePage() {
  return (
    <main>
      <section className="relative isolate min-h-[calc(100vh-3.5rem)] overflow-hidden">
        <Image
          src="/hero-studio.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_35%] hero-image"
        />
        <div className="hero-veil absolute inset-0" aria-hidden />
        <div className="relative mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-5xl flex-col justify-end px-5 pb-14 pt-20 sm:px-8 sm:pb-20">
          <p className="hero-enter text-[11px] font-medium uppercase tracking-[0.14em] text-white/70">
            Studio tatuażu
          </p>
          <h1 className="font-display hero-enter mt-3 text-[clamp(3.5rem,12vw,7.5rem)] leading-[0.9] tracking-tight text-white">
            NSM
          </h1>
          <p className="hero-enter mt-5 max-w-md text-base leading-relaxed text-white/85 sm:text-lg">
            Zgłoszenia, wyceny i terminy — spokojnie, w jednym miejscu.
          </p>
          <HomeHeroCtas />
        </div>
      </section>

      <section className="border-t border-paper-line bg-paper">
        <div className="mx-auto grid max-w-5xl gap-10 px-5 py-16 sm:grid-cols-3 sm:gap-8 sm:px-8 sm:py-20">
          <div>
            <p className="font-display text-2xl text-ink">01</p>
            <h2 className="mt-3 text-sm font-medium text-ink">Zgłoszenie</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Opisz motyw, dołącz referencje i wybierz preferowany termin.
            </p>
          </div>
          <div>
            <p className="font-display text-2xl text-ink">02</p>
            <h2 className="mt-3 text-sm font-medium text-ink">Wycena</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Artysta ocenia projekt i proponuje cenę oraz czas sesji.
            </p>
          </div>
          <div>
            <p className="font-display text-2xl text-ink">03</p>
            <h2 className="mt-3 text-sm font-medium text-ink">Termin</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              Po akceptacji rezerwujesz slot w grafiku studia.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
