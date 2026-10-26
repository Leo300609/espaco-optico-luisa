/** Ícones de traço fino e uniforme. Decorativos: sempre acompanhados de texto ou aria-label. */
type P = { className?: string };
const base = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

export const IconSearch = ({ className }: P) => (
  <svg {...base} className={className}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
export const IconBag = ({ className }: P) => (
  <svg {...base} className={className}><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>
);
export const IconUser = ({ className }: P) => (
  <svg {...base} className={className}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
);
export const IconMenu = ({ className }: P) => (
  <svg {...base} className={className}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
);
export const IconClose = ({ className }: P) => (
  <svg {...base} className={className}><path d="M6 6l12 12M18 6 6 18" /></svg>
);
export const IconWhats = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M4 20l1.3-3.9A8 8 0 1 1 8 19l-4 1Z" />
    <path d="M9 9.5c.3 2 2.5 4.3 4.6 4.6l1.2-1.1 1.7.8c-.2 1.2-1.2 1.9-2.4 1.7-3.3-.6-5.9-3.2-6.4-6.4-.2-1.2.5-2.2 1.7-2.4l.8 1.7L9 9.5Z" />
  </svg>
);
export const IconPin = ({ className }: P) => (
  <svg {...base} className={className}><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
);
export const IconPhone = ({ className }: P) => (
  <svg {...base} className={className}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" /></svg>
);
export const IconClock = ({ className }: P) => (
  <svg {...base} className={className}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
export const IconTruck = ({ className }: P) => (
  <svg {...base} className={className}><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></svg>
);
export const IconStore = ({ className }: P) => (
  <svg {...base} className={className}><path d="M4 10v10h16V10M3 10l2-6h14l2 6H3Z" /><path d="M10 20v-5h4v5" /></svg>
);
export const IconPix = ({ className }: P) => (
  <svg {...base} className={className}><path d="m12 3 4 4-4 4-4-4 4-4ZM3 12l4-4 4 4-4 4-4-4ZM13 12l4-4 4 4-4 4-4-4ZM12 13l4 4-4 4-4-4 4-4Z" /></svg>
);
export const IconCard = ({ className }: P) => (
  <svg {...base} className={className}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h3" /></svg>
);
export const IconCheck = ({ className }: P) => (
  <svg {...base} className={className}><path d="m5 12 4.5 4.5L19 7" /></svg>
);
export const IconAlert = ({ className }: P) => (
  <svg {...base} className={className}><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17h.01" /></svg>
);
export const IconInfo = ({ className }: P) => (
  <svg {...base} className={className}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
);
export const IconShield = ({ className }: P) => (
  <svg {...base} className={className}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></svg>
);
export const IconGlasses = ({ className }: P) => (
  <svg {...base} className={className}><circle cx="7" cy="14" r="3.5" /><circle cx="17" cy="14" r="3.5" /><path d="M10.5 14h3M3.5 14 5 7h2M20.5 14 19 7h-2" /></svg>
);
