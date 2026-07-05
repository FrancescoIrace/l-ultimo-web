// Ruoli disponibili per famiglia di sport. Solo gli sport di squadra con
// posizioni riconoscibili hanno un catalogo: Padel/Tennis/Corsa/Palestra/
// Personalizzato non hanno "ruoli" nel senso tradizionale, quindi non compaiono.
export const SPORT_ROLES = {
  Calcio: ['Portiere', 'Difensore', 'Centrocampista', 'Attaccante'],
  Basket: ['Playmaker', 'Guardia', 'Ala', 'Centro'],
  Volley: ['Palleggiatore', 'Schiacciatore', 'Centrale', 'Libero', 'Opposto'],
};

// Mappa il valore esatto di matches.sport (es. "Calcio a 7") alla famiglia
// di sport con cui è definito il catalogo ruoli (es. "Calcio").
const SPORT_TO_FAMILY = {
  'Calcetto': 'Calcio',
  'Calcio a 7': 'Calcio',
  'Calcio a 11': 'Calcio',
  'Basket (allenamento)': 'Basket',
  'Basket (3vs3)': 'Basket',
  'Basket (5vs5)': 'Basket',
  'Volley': 'Volley',
};

export function getSportFamily(sport) {
  return SPORT_TO_FAMILY[sport] || null;
}

export function getRolesForSport(sport) {
  const family = getSportFamily(sport);
  return family ? SPORT_ROLES[family] : [];
}
