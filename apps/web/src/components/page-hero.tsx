import Image from 'next/image';
import Link from 'next/link';
import { ReactNode } from 'react';

type Props = {
  eyebrow: string;
  title: string;
  description: string;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
};

export function PageHero({
  eyebrow,
  title,
  description,
  backHref,
  backLabel = '← Wróć',
  actions,
}: Props) {
  return (
    <section className="page-hero relative isolate overflow-hidden text-white">
      <Image
        src="/hero-studio.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-[center_30%] page-hero-image"
      />
      <div className="page-hero-veil absolute inset-0" aria-hidden />

      <div className="relative mx-auto flex min-h-[min(52vh,28rem)] max-w-5xl flex-col justify-end px-5 pb-10 pt-16 sm:min-h-[22rem] sm:px-8 sm:pb-12">
        {backHref ? (
          <Link
            href={backHref}
            className="hero-enter mb-5 self-start text-sm font-medium text-white/75 no-underline transition hover:text-white"
          >
            {backLabel}
          </Link>
        ) : null}
        <p className="hero-enter text-[11px] font-medium uppercase tracking-[0.14em] text-white/70">
          {eyebrow}
        </p>
        <h1 className="font-display hero-enter mt-3 text-[clamp(2.75rem,8vw,4.75rem)] leading-[0.92] tracking-tight text-white">
          {title}
        </h1>
        <p className="hero-enter mt-4 max-w-lg text-base leading-relaxed text-white/85 sm:text-[1.05rem]">
          {description}
        </p>
        {actions ? <div className="hero-enter mt-7 flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </section>
  );
}
