// Badge immagine di fine stagione. Mappa il rank di quiz_season_results
// (1/2/3 = podio, nullo = partecipante) + il season_number della stagione al
// file SVG corrispondente in public/badges/. I badge sono per-stagione (hanno
// "STAGIONE N" inciso), generati con scripts/gen-season-badges.mjs.
const RANK_LABEL = { 1: 'Vincitore', 2: 'Secondo posto', 3: 'Terzo posto' };

export default function SeasonBadge({ rank, seasonNumber, seasonName, size = 56, showName = true }) {
    // Senza numero stagione non sappiamo quale set usare: non mostriamo nulla
    // (evita immagini rotte). Con la migrazione season_number è sempre
    // valorizzato. Attenzione: la Pre-Stagione è la 0, quindi niente !seasonNumber.
    if (seasonNumber == null) return null;

    const seg = rank === 1 || rank === 2 || rank === 3 ? rank : 'p';
    const src = `/badges/badge-${seg}-s${seasonNumber}.svg`;
    const label = RANK_LABEL[rank] || 'Partecipante';
    const title = seasonName ? `${label} · ${seasonName}` : label;

    // Solo medaglia (per liste compatte, es. Albo d'Oro).
    if (!showName) {
        return <img src={src} alt={title} title={title} style={{ width: size, height: size }} className="object-contain flex-shrink-0" />;
    }

    return (
        <div className="flex flex-col items-center gap-1 w-16" title={title}>
            <img src={src} alt={title} style={{ width: size, height: size }} className="object-contain" />
            {seasonName && (
                <span className="text-[9px] font-bold text-slate-500 text-center leading-tight line-clamp-2">{seasonName}</span>
            )}
        </div>
    );
}
