// Line-art tile icons drawn to match the mockup (black strokes, no fill).
const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

export const BoxesIcon = (p: { className?: string }) => (
  <svg viewBox="0 0 64 64" className={p.className} aria-hidden {...base}>
    {/* top box */}
    <path d="M30 6 44 12 44 26 30 20Z M30 6 18 11 18 25 30 20 M18 11 32 17 44 12 M32 17 32 31" />
    {/* left box */}
    <path d="M6 28 18 23 30 28 30 42 18 47 6 42Z M6 28 18 33 30 28 M18 33 18 47" />
    {/* right box */}
    <path d="M30 40 44 34 58 40 58 54 44 60 30 54Z M30 40 44 46 58 40 M44 46 44 60" />
    <path d="M32 17 44 22 M10 30 22 25 M36 37 50 43" opacity=".55" />
  </svg>
);

export const HandCoinIcon = (p: { className?: string }) => (
  <svg viewBox="0 0 64 64" className={p.className} aria-hidden {...base}>
    <circle cx="34" cy="20" r="14" />
    <path d="M38 13.5c-1-1.5-2.6-2.2-4.4-2.2-2.6 0-4.4 1.4-4.4 3.4 0 4.8 9.4 2.4 9.4 7.4 0 2.1-2 3.6-4.8 3.6-2.1 0-3.8-.9-4.8-2.4 M34 8.5v3 M34 25.7v3" strokeWidth="1.8" />
    <path d="M4 44c4-3 9-4.5 14-4l11 1.2c2.3.3 3.8 2.4 3 4.4-.6 1.5-2.2 2.4-3.8 2.2L18 46.8" />
    <path d="M32.2 45.6 47 38.5c2.2-1 4.8 0 5.6 2.2.7 1.8-.1 3.8-1.8 4.8L33 56c-3 1.7-6.5 2.2-9.8 1.4L4 53" />
  </svg>
);

export const BookPenIcon = (p: { className?: string }) => (
  <svg viewBox="0 0 64 64" className={p.className} aria-hidden {...base}>
    <path d="M4 18c9-3 18-2.4 27 3v33c-9-5.4-18-6-27-3Z M31 21c8-5.4 17-6 27-3v33c-10-3-19-2.4-27 3" />
    <path d="M9 24c6-1.6 12-1 18 1.8 M9 30c6-1.6 12-1 18 1.8 M9 36c6-1.6 12-1 18 1.8 M9 42c6-1.6 12-1 18 1.8" opacity=".7" />
    <path d="M36 25c5-2.4 11-3 16-1.6 M36 31c5-2.4 11-3 16-1.6 M36 37c3-1.4 6-2.2 9-2.3" opacity=".7" />
    <path d="M57 26 62 31 45 48 39 50 41 44Z M54 29 59 34" strokeWidth="1.8" />
  </svg>
);

export const QuestionIcon = (p: { className?: string }) => (
  <svg viewBox="0 0 64 64" className={p.className} aria-hidden {...base} strokeWidth={3}>
    <circle cx="32" cy="32" r="27" />
    <path d="M23.5 24.5c0-5 3.9-8.5 8.7-8.5s8.6 3.2 8.6 7.8c0 6.7-8.6 7.3-8.6 13.7" />
    <circle cx="32.2" cy="45.5" r="1.6" fill="currentColor" />
  </svg>
);
