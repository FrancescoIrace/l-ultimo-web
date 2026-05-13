/**
 * Servizio meteo che utilizza l'API gratuita Open-Meteo
 * Nessuna API key richiesta
 */

// Mappa WMO Weather Codes a emoji e descrizioni
const WMO_CODE_MAP = {
  0: { emoji: '☀️', description: 'Sereno' },
  1: { emoji: '🌤️', description: 'Poco nuvoloso' },
  2: { emoji: '⛅', description: 'Parzialmente nuvoloso' },
  3: { emoji: '☁️', description: 'Nuvoloso' },
  45: { emoji: '🌫️', description: 'Nebbioso' },
  48: { emoji: '🌫️', description: 'Deposito di rime' },
  51: { emoji: '🌧️', description: 'Pioggia leggera' },
  53: { emoji: '🌧️', description: 'Pioggia moderata' },
  55: { emoji: '🌧️', description: 'Pioggia densa' },
  61: { emoji: '🌧️', description: 'Pioggia moderata' },
  63: { emoji: '🌧️', description: 'Pioggia forte' },
  65: { emoji: '⛈️', description: 'Pioggia molto forte' },
  71: { emoji: '❄️', description: 'Neve leggera' },
  73: { emoji: '❄️', description: 'Neve moderata' },
  75: { emoji: '❄️', description: 'Neve densa' },
  77: { emoji: '❄️', description: 'Chicchi di neve' },
  80: { emoji: '⛈️', description: 'Rovesci leggeri' },
  81: { emoji: '⛈️', description: 'Rovesci moderati' },
  82: { emoji: '⛈️', description: 'Rovesci forti' },
  85: { emoji: '❄️', description: 'Rovesci di neve' },
  86: { emoji: '❄️', description: 'Rovesci di neve forti' },
  95: { emoji: '⛈️', description: 'Temporale' },
  96: { emoji: '⛈️', description: 'Temporale con grandine' },
  99: { emoji: '⛈️', description: 'Temporale con grandine forte' },
};

/**
 * Ottiene i dati meteo per una posizione e data/ora specifica
 * @param {number} latitude - Latitudine
 * @param {number} longitude - Longitudine
 * @param {Date} matchDateTime - Data/ora della partita
 * @returns {Promise<Object>} { emoji, temperature, rainProbability, description }
 */
export async function getWeather(latitude, longitude, matchDateTime) {
  try {
    // Validazione input
    if (!latitude || !longitude || !matchDateTime) {
      console.warn('Parametri meteo incompleti:', { latitude, longitude, matchDateTime });
      return null;
    }

    // Converti la data in formato ISO
    const startDate = new Date(matchDateTime);
    startDate.setHours(0, 0, 0, 0); // Mezzanotte del giorno della partita

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1); // Giorno dopo

    // Formatta le date per l'API
    const start = startDate.toISOString().split('T')[0];
    const end = endDate.toISOString().split('T')[0];

    // Chiama Open-Meteo API
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.append('latitude', latitude);
    url.searchParams.append('longitude', longitude);
    url.searchParams.append('start_date', start);
    url.searchParams.append('end_date', end);
    url.searchParams.append('hourly', 'weather_code,temperature_2m,precipitation_probability');
    url.searchParams.append('timezone', 'Europe/Rome'); // Timezone italiana

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.hourly || !data.hourly.time) {
      console.warn('Risposta API incompleta:', data);
      return null;
    }

    // Estrai l'ora della partita dal datetime
    const matchHour = matchDateTime.getHours();
    const matchMinutes = matchDateTime.getMinutes();

    // Cerca il dato più vicino all'ora della partita
    const timeIndex = data.hourly.time.findIndex((timeStr) => {
      const hourDate = new Date(timeStr);
      return hourDate.getHours() === matchHour;
    });

    if (timeIndex === -1) {
      console.warn('Ora della partita non trovata nei dati meteo');
      return null;
    }

    // Estrai i dati per quell'ora
    const weatherCode = data.hourly.weather_code[timeIndex];
    const temperature = Math.round(data.hourly.temperature_2m[timeIndex]);
    const rainProbability = data.hourly.precipitation_probability[timeIndex];

    const weatherInfo = WMO_CODE_MAP[weatherCode] || {
      emoji: '❓',
      description: 'Condizione sconosciuta'
    };

    return {
      emoji: weatherInfo.emoji,
      temperature,
      rainProbability,
      description: weatherInfo.description,
      weatherCode,
      timestamp: new Date(data.hourly.time[timeIndex])
    };
  } catch (error) {
    console.error('Errore nel fetch dei dati meteo:', error);
    return null;
  }
}

/**
 * Converte il WMO code a un emoji
 * @param {number} code - WMO Weather Code
 * @returns {string} Emoji corrispondente
 */
export function getWeatherEmoji(code) {
  return WMO_CODE_MAP[code]?.emoji || '❓';
}

/**
 * Verifica se la partita è entro i prossimi 7 giorni
 * @param {Date} matchDateTime - Data della partita
 * @returns {boolean}
 */
export function isWithinSevenDays(matchDateTime) {
  const now = new Date();
  const diffMs = matchDateTime - now;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 7;
}

/**
 * Genera un messaggio di avviso in base alla probabilità di pioggia
 * @param {number} rainProbability - Probabilità di pioggia (0-100)
 * @returns {string|null} Messaggio di avviso o null se minore di 40%
 */
export function getWeatherMessage(rainProbability) {
  if (rainProbability > 40) {
    return '⚠️ Porta un ombrello!';
  }
  return null;
}
