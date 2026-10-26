import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

// Visual language from the Pulse mockup: one cream background, white rounded cards,
// handwritten headings, typewriter-serif body, amber accents.

// On a real phone the app is full-screen cream. On wider screens it sits in a phone
// frame on a darker backdrop so the "phone" reads as the product.
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-cream sm:flex sm:flex-col sm:items-center sm:bg-desk sm:py-8">
      <div className="mx-auto w-full max-w-[430px] sm:rounded-[3.25rem] sm:border-[11px] sm:border-black sm:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)] sm:ring-1 sm:ring-white/15">
        <div className="relative min-h-screen bg-cream sm:min-h-[860px] sm:overflow-hidden sm:rounded-[2.6rem]">
          <div className="pointer-events-none absolute left-1/2 top-0 hidden h-7 w-36 -translate-x-1/2 rounded-b-2xl bg-black sm:block" />
          <div className="px-5 pb-8 pt-6 sm:pt-10">{children}</div>
        </div>
      </div>
      <p className="mt-6 hidden text-center font-hand text-xl text-amber-pill sm:block">
        The One-Stop Shop for Student Housing Complexes.
      </p>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[1.6rem] bg-white p-4 ${className}`}>{children}</div>;
}

export function HandTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={`font-hand text-amber-ink ${className}`}>{children}</h2>;
}

export function PageHeader({ title, back = "/" }: { title: string; back?: string }) {
  return (
    <div className="mb-5">
      <Link to={back} className="font-type text-sm text-black/70 hover:text-black">
        ← Back
      </Link>
      <h1 className="mt-2 font-hand text-4xl leading-tight text-black">{title}</h1>
    </div>
  );
}

export function Avatar({ name }: { name?: string | null | undefined }) {
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 48 48" className="h-12 w-12" aria-hidden>
        <circle cx="24" cy="24" r="23" fill="black" />
        <circle cx="24" cy="24" r="19.5" fill="none" stroke="white" strokeWidth="1.6" />
        <circle cx="24" cy="18" r="6.5" fill="white" />
        <path d="M11.5 36.5c2.4-6 7-9 12.5-9s10.1 3 12.5 9" fill="white" />
      </svg>
      {name && <span className="mt-0.5 max-w-[90px] truncate font-type text-[9px] font-bold">{name}</span>}
    </div>
  );
}

export function Checkbox({ checked, onClick, label }: { checked: boolean; onClick?: () => void; label: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onClick}
      className="mt-[3px] grid h-[15px] w-[15px] shrink-0 place-items-center border border-amber-ink/70 bg-white"
    >
      {checked && (
        <svg viewBox="0 0 12 12" className="h-3 w-3 text-amber-ink" aria-hidden>
          <path d="M2 6.5 4.8 9 10 2.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}

export function AmberButton({ children, className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`rounded-full bg-amber-pill px-5 py-2.5 font-type text-sm font-bold text-black transition hover:brightness-105 disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

export function OutlineButton({ children, className = "", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className={`rounded-full border-2 border-black bg-white px-5 py-2 font-type text-sm font-bold text-black transition hover:bg-black/5 disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-3 text-center font-type text-sm text-black/55">{children}</p>;
}

export function Loading() {
  return <p className="py-6 text-center font-hand text-xl text-amber-ink">Loading…</p>;
}

export const Tagline = () => (
  <p className="mt-6 text-center font-hand text-lg text-amber-ink sm:hidden">The One-Stop Shop for Student Housing Complexes.</p>
);
