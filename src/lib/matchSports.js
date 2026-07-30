// Tassonomia degli sport delle PARTITE (distinta da quella del profilo in
// profileFieldOptions): ogni sport ha un numero di giocatori predefinito.
// Per Corsa/Palestra/Personalizzato il numero è libero (lo imposta l'utente).
// Estratta qui per essere condivisa tra creazione partita e template ricorrenti.
export const MATCH_SPORTS = [
    { value: 'Calcetto', players: 10 },
    { value: 'Calcio a 7', players: 14 },
    { value: 'Calcio a 11', players: 22 },
    { value: 'Padel', players: 4 },
    { value: 'Basket (allenamento)', players: 2 },
    { value: 'Basket (3vs3)', players: 6 },
    { value: 'Basket (5vs5)', players: 10 },
    { value: 'Tennis singolo', players: 2 },
    { value: 'Tennis doppio', players: 4 },
    { value: 'Volley', players: 12 },
    { value: 'Corsa', players: null },
    { value: 'Palestra', players: null },
    { value: 'Personalizzato', players: null },
];

// Numero di giocatori predefinito per uno sport; null = libero (l'utente sceglie).
export function defaultPlayersForSport(sport) {
    const s = MATCH_SPORTS.find((x) => x.value === sport);
    return s ? s.players : null;
}

// true se lo sport ha un numero di giocatori fisso (campo max_players non editabile).
export function isFixedPlayersSport(sport) {
    return defaultPlayersForSport(sport) !== null;
}

export const WEEKDAYS = [
    { value: 1, label: 'Lunedì' },
    { value: 2, label: 'Martedì' },
    { value: 3, label: 'Mercoledì' },
    { value: 4, label: 'Giovedì' },
    { value: 5, label: 'Venerdì' },
    { value: 6, label: 'Sabato' },
    { value: 0, label: 'Domenica' },
];
