# Integrazione API Meteo - Documentazione

## Descrizione
Integrazione con l'API gratuita **Open-Meteo** per mostrare le condizioni meteo alle card delle partite.

## Caratteristiche
✅ **API Gratuita** - Nessuna API key richiesta
✅ **Meteo in Tempo Reale** - Previsioni accurate per l'ora della partita
✅ **Emoji Compatte** - Icone intuitive (☀️, ☁️, 🌧️, ⛈️, ❄️)
✅ **Supporto Responsive** - Mostra temperature e probabilità di pioggia
✅ **Indicatore Refresh** - Icona 🔄 che indica i dati sono in tempo reale
✅ **Tooltip Descrittivi** - Al hover, mostra la descrizione meteo completa
✅ **Smart Fetching** - Carica meteo solo per partite entro 7 giorni

## Componenti

### 1. **weatherService.js** (`src/lib/weatherService.js`)
Servizio utility che gestisce le richieste API Open-Meteo.

**Funzioni principali:**
- `getWeather(latitude, longitude, matchDateTime)` - Ottiene i dati meteo per posizione e ora
- `getWeatherEmoji(code)` - Converte WMO code a emoji
- `isWithinSevenDays(matchDateTime)` - Verifica se la partita è entro 7 giorni

**Output:**
```javascript
{
  emoji: '🌧️',           // Emoji meteo
  temperature: 18,       // Temperatura in °C
  rainProbability: 60,   // Probabilità pioggia (0-100)
  description: 'Pioggia moderata',
  weatherCode: 61,       // WMO code
  timestamp: Date        // Data/ora previsione
}
```

### 2. **MatchCard.jsx** - Integrazione
Componente Card aggiornato con sezione meteo compatta.

**Modifiche:**
- Import di `getWeather` e `isWithinSevenDays`
- Import di `RefreshCw` icon da lucide-react
- Nuovo `useEffect` per il fetch del meteo
- UI compatta con emoji, temperatura e probabilità pioggia
- Tooltip al hover con descrizione completa
- Loading state durante il fetch

**Visualizzazione:**
```
📅 13 mag 2026, 17:30    🌧️ 18°C 💧60% 🔄
                         ↑ Tooltip al hover: "Pioggia moderata"
```

## Codici WMO Supportati

| Codice | Emoji | Significato |
|--------|-------|-------------|
| 0      | ☀️    | Sereno |
| 1-2    | 🌤️   | Poco nuvoloso |
| 3      | ☁️    | Nuvoloso |
| 45-48  | 🌫️   | Nebbioso |
| 51-67  | 🌧️   | Pioggia varia |
| 71-86  | ❄️    | Neve |
| 80-82  | ⛈️   | Rovesci |
| 95-99  | ⛈️   | Temporali |

## Funzionamento

### Flow di Caricamento
1. MatchCard monta il componente
2. `useEffect` controlla se:
   - Match ha `location_lat` e `location_lng` ✓
   - Data è entro i prossimi 7 giorni ✓
3. Se sì, chiama `getWeather()`
4. Mostra:
   - **Loading**: Spinner con "Caricamento meteo..."
   - **Successo**: Emoji + Temp + Pioggia + Icona refresh
   - **Fallback**: Nulla (non disraide la card)

### Caching
Ogni volta che la card si monta/aggiorna, rifetcha i dati meteo. Per ottimizzare:
```javascript
// (Opzionale) Aggiungere caching client-side
const cacheKey = `weather_${lat}_${lng}_${hour}`;
```

## Personalizzazione

### Cambiare Timezone
Nel file `weatherService.js`, modifica:
```javascript
url.searchParams.append('timezone', 'Europe/Rome'); // → 'Europe/London'
```

### Aggiungere Più Dati Meteo
Nel fetch aggiungi parametri:
```javascript
url.searchParams.append('hourly', 'wind_speed_10m,cloud_cover');
```

### Cambiare Emoji
In `WMO_CODE_MAP`, personalizza le emoji:
```javascript
51: { emoji: '🌧️', description: 'Pioggia leggera' }
```

## Limitazioni & Considerazioni

⚠️ **Limitazioni Open-Meteo API:**
- Rate limit: 10.000 richieste/giorno (più che sufficiente)
- Previsioni disponibili fino a 16 giorni
- Accuratezza ±1-2°C per Italia

⚠️ **Note Implementazione:**
- Se `match.location_lat/lng` sono null, il meteo non si carica (normal)
- Se la partita è oltre 7 giorni, meteo non si carica (by design)
- Nessun errore di compilazione se API fallisce (graceful fallback)

## Testing

### Test Locale
1. Accedi a una partita creata entro 7 giorni
2. Controlla che appaia la card con meteo
3. Hover sulla sezione meteo → Visualizza tooltip
4. Attendi ~1-2 secondi loading iniziale

### Debug Console
```javascript
// Accedi ai dati meteo in console
console.log(weatherData);
```

## Prossimi Miglioramenti Possibili

- [ ] Cache client-side con TTL (time-to-live)
- [ ] Animazione smooth tra loading e dati
- [ ] Storico previsioni per la settimana
- [ ] Avviso meteo per precipitazioni > 80%
- [ ] Widget meteo expandibile
- [ ] Alerts sulle notifiche (es. "Pioggia in arrivo!")

## Riferimenti

- **API Docs**: https://open-meteo.com/en/docs
- **WMO Codes**: https://www.noaa.gov/jetstream/ll/codes-upper-air
- **Tailwind CSS**: https://tailwindcss.com/
- **Lucide React Icons**: https://lucide.dev/

