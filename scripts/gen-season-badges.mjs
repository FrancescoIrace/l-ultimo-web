// Generatore dei 4 badge di fine stagione (1°/2°/3°/partecipante), con il
// numero di stagione inciso nel nastro, così ogni stagione ha badge distinti.
// Uso:  node scripts/gen-season-badges.mjs <numeroStagione>
// Es.:  node scripts/gen-season-badges.mjs 2   → public/badges/badge-{1,2,3,p}-s2.svg
//
// I badge sono SVG puliti disegnati a mano (niente trace): nitidi a ogni
// dimensione e leggeri. Il display nell'app li mappa da quiz_season_results.rank
// (1/2/3 → 1/2/3, rank nullo → p) + quiz_seasons.season_number.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const season = parseInt(process.argv[2], 10);
if (!Number.isInteger(season) || season < 1) {
    console.error('Passa il numero di stagione (>=1). Es: node scripts/gen-season-badges.mjs 2');
    process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, '..', 'public', 'badges');
mkdirSync(OUT, { recursive: true });

function star(cx, cy, ro, ri) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? ro : ri;
        const a = (-90 + i * 36) * Math.PI / 180;
        pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
    }
    return `<polygon points="${pts.join(' ')}"/>`;
}

function badge({ seg, base, dark, ring, text, ribbon, ribbonText, center }) {
    const label = `STAGIONE ${season}`;
    const isBig = String(center).length > 2;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150" fill="none">
  <defs>
    <radialGradient id="g" cx="50%" cy="38%" r="65%">
      <stop offset="0%" stop-color="${base}"/>
      <stop offset="100%" stop-color="${dark}"/>
    </radialGradient>
  </defs>
  <path d="M60 96 L92 108 L86 141 L60 129 L34 141 L28 108 Z" fill="${dark}"/>
  <path d="M60 96 L92 108 L88 124 L60 114 L32 124 L28 108 Z" fill="${ribbon}"/>
  <text x="60" y="119.5" text-anchor="middle" font-family="'Arial Black','Segoe UI',sans-serif" font-weight="900" font-size="7.2" letter-spacing="0.3" fill="${ribbonText}">${label}</text>
  <circle cx="60" cy="58" r="46" fill="url(#g)"/>
  <circle cx="60" cy="58" r="46" fill="none" stroke="${dark}" stroke-width="3"/>
  <circle cx="60" cy="58" r="37" fill="none" stroke="${ring}" stroke-width="2.5"/>
  <path d="M28 40 A46 46 0 0 1 78 20" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="4" stroke-linecap="round"/>
  <g fill="${ribbonText}">${star(60, 34, 8, 3.4)}</g>
  <text x="60" y="${isBig ? 76 : 78}" text-anchor="middle" font-family="'Arial Black','Segoe UI',sans-serif" font-weight="900" font-size="${isBig ? 30 : 40}" fill="${text}">${center}</text>
</svg>`;
    const file = `badge-${seg}-s${season}.svg`;
    writeFileSync(join(OUT, file), svg, 'utf8');
    console.log('scritto', file);
}

badge({ seg: '1', base: '#FBD758', dark: '#C99400', ring: '#F1C232', text: '#6B4E00', ribbon: '#C99400', ribbonText: '#FFF6D6', center: '1°' });
badge({ seg: '2', base: '#E1E7F0', dark: '#8E9BB0', ring: '#C4CDDB', text: '#3E4A5C', ribbon: '#8E9BB0', ribbonText: '#FFFFFF', center: '2°' });
badge({ seg: '3', base: '#E4A163', dark: '#A9662C', ring: '#D08B46', text: '#5A340F', ribbon: '#A9662C', ribbonText: '#FFF1E4', center: '3°' });
badge({ seg: 'p', base: '#A8BBEC', dark: '#5B7FE0', ring: '#8AA3E2', text: '#26386F', ribbon: '#5B7FE0', ribbonText: '#EAF0FF', center: '★' });

console.log(`Stagione ${season}: 4 badge generati in public/badges/`);
