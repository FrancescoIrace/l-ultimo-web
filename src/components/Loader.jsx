import { Loader as LoaderIcon } from 'lucide-react';

/**
 * Loader unificato dell'app. Un'unica icona (lucide Loader) e un'unica
 * velocità (Tailwind `animate-spin`, 0.75s).
 *
 * variant:
 *  - "page"    → blocco grande centrato con label (default "attendi...").
 *                Per usarlo come gate pagina: `if (loading) return <Loader variant="page" />`
 *  - "section" → spinner medio centrato, label opzionale (es. "Caricamento meteo...")
 *  - "inline"  → spinner piccolo, pensato per stare dentro un bottone
 *
 * Props:
 *  - label   → testo sotto lo spinner. Ometti per il default della variante,
 *              passa `label={null}` per nasconderlo del tutto.
 *  - size    → override della dimensione icona (px)
 *  - color   → "blue" (default) | "white" (per bottoni colorati)
 */
const DEFAULT_SIZE = { page: 56, section: 40, inline: 18 };

export default function Loader({ variant = 'section', label, size, color = 'blue', className = '' }) {
  const iconColor = color === 'white' ? 'text-white' : 'text-blue-600';
  const iconSize = size ?? DEFAULT_SIZE[variant] ?? 40;

  if (variant === 'inline') {
    return <LoaderIcon size={iconSize} className={`animate-spin ${iconColor} ${className}`} />;
  }

  // label === null → nascosto; undefined → default per variante; stringa → custom
  const text = label === null ? null : (label ?? (variant === 'page' ? 'attendi...' : null));
  const textColor = color === 'white' ? 'text-white' : 'text-slate-500';

  return (
    <div className={`flex flex-col items-center justify-center gap-3 text-center ${variant === 'page' ? 'p-10' : 'p-6'} ${className}`}>
      <LoaderIcon size={iconSize} strokeWidth={1.75} className={`animate-spin ${iconColor}`} />
      {text && <span className={`text-sm font-black uppercase ${textColor}`}>{text}</span>}
    </div>
  );
}
