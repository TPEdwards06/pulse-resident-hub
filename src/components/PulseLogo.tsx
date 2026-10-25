export function PulseLogo({ className = "", size = "lg" }: { className?: string; size?: "lg" | "md" }) {
  const text = size === "lg" ? "text-[2.6rem]" : "text-3xl";
  const line = size === "lg" ? "h-12 w-[4.5rem]" : "h-9 w-14";
  return (
    <div className={`flex items-end ${className}`}>
      <span className={`font-hand ${text} leading-none text-black`}>Pulse</span>
      <svg viewBox="0 0 72 48" className={`${line} -ml-0.5 text-black`} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M0 33 H22 L26 27 L31 46 L37 2 L43 38 L47 31 H72" />
      </svg>
    </div>
  );
}
