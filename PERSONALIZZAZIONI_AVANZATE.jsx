// Personalizzazioni Avanzate - HomeFilters Refactoring
// Copia i file sottostanti nella tua app per personalizzazioni custom

// ============================================
// SNIPPET 1: Slider Custom Styling
// ============================================
// Aggiungi questo nel tuo file CSS globale (src/App.css o src/index.css)

/*
// Custom Slider Appearance
input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 8px;
  background: #e2e8f0;
  border-radius: 5px;
  outline: none;
}

// Thumb del slider (il cerchio che trascini)
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4);
}

input[type="range"]::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2563eb, #1d4ed8);
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4);
}

// Track del slider (la linea di fondo)
input[type="range"]::-webkit-slider-runnable-track {
  background: linear-gradient(90deg, #3b82f6, #2563eb);
  height: 8px;
  border-radius: 5px;
}

input[type="range"]::-moz-range-track {
  background: #e2e8f0;
  height: 8px;
  border-radius: 5px;
  border: none;
}
*/

// ============================================
// SNIPPET 2: Debounce Hook Riutilizzabile
// ============================================
// File: src/hooks/useDebounce.js

export function useDebounce(value, delay = 500) {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

// Uso:
// const debouncedSearch = useDebounce(searchValue, 500);
// useEffect(() => {
//   if (debouncedSearch) {
//     // Fai la query
//   }
// }, [debouncedSearch]);

// ============================================
// SNIPPET 3: Salva Preferenze Filtri in localStorage
// ============================================
// Aggiungi questo in HomeFilters.jsx all'interno del componente

/*
// Carica preferenze all'init
useEffect(() => {
  const saved = localStorage.getItem('filterPreferences');
  if (saved) {
    const prefs = JSON.parse(saved);
    onRadiusChange(prefs.radiusKm || 20);
    // Ripristina altri filtri se necessario
  }
}, []);

// Salva preferenze quando cambiano
useEffect(() => {
  const prefs = {
    radiusKm,
    searchQuery,
    showNearby,
  };
  localStorage.setItem('filterPreferences', JSON.stringify(prefs));
}, [radiusKm, searchQuery, showNearby]);
*/

// ============================================
// SNIPPET 4: Animazione Smooth per Dropdown
// ============================================
// Aggiungi questo in src/App.css per animazioni Tailwind custom

/*
@keyframes slideInDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideOutUp {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-10px);
  }
}

// Nel tailwind.config.js, aggiungi:
module.exports = {
  theme: {
    extend: {
      animation: {
        slideInDown: 'slideInDown 200ms ease-out',
        slideOutUp: 'slideOutUp 200ms ease-in',
      },
      keyframes: {
        slideInDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideOutUp: {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-10px)' },
        },
      },
    },
  },
}
*/

// ============================================
// SNIPPET 5: Badge Contatore Partite Trovate
// ============================================
// Aggiungi questo nel componente HomeFilters.jsx, dopo il bottone filtri

/*
{showNearby && nearbyMatchesCount !== undefined && (
  <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
    {nearbyMatchesCount}
  </div>
)}
*/

// ============================================
// SNIPPET 6: Integrazione con Google Analytics
// ============================================
// Traccia i filtri che gli utenti usano più frequentemente

/*
import { useAnalytics } from '@react-ga/hooks'; // Oppure gtag

export default function HomeFilters({ ... }) {
  const analytics = useAnalytics();

  const trackFilterChange = (filterName, value) => {
    analytics.event({
      category: 'Filters',
      action: 'Filter Changed',
      label: filterName,
      value: value,
    });
  };

  const handleRadiusChange = (newRadius) => {
    trackFilterChange('radius', newRadius);
    onRadiusChange(newRadius);
  };

  // Applica lo stesso pattern agli altri filtri
}
*/

// ============================================
// SNIPPET 7: Validazione Raggio (Min/Max Dinamici)
// ============================================
// Se vuoi limitare dinamicamente il raggio basato su posizione

/*
const getMaxRadiusForLocation = (lat, lng) => {
  // Logica per limitare raggio basato su location
  // Es. in montagna (> 1000m altitudine) → max 50km
  // In città → max 100km
  
  if (lat > 40.7 && lat < 40.9) {
    // Milano area
    return 50;
  }
  return 100;
};

const handleRadiusChange = (newRadius) => {
  const max = getMaxRadiusForLocation(position.lat, position.lng);
  const limitedRadius = Math.min(newRadius, max);
  onRadiusChange(limitedRadius);
};
*/

// ============================================
// SNIPPET 8: Dark Mode Support
// ============================================
// Se la tua app supporta dark mode, aggiungi in HomeFilters.jsx

/*
<div className={`rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 ...`}>
  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
    Raggio di ricerca
  </p>
  {/* Resto del codice */}
</div>
*/

// ============================================
// SNIPPET 9: Filtri Storici (Cronologia Ricerche)
// ============================================
// Salva le ultime 5 ricerche

/*
const [searchHistory, setSearchHistory] = useState([]);

const handleSearchChange = (query) => {
  onSearchChange(query);
  
  if (query.trim()) {
    setSearchHistory(prev => {
      const updated = [query, ...prev.filter(q => q !== query)];
      return updated.slice(0, 5); // Mantieni solo ultimi 5
    });
    
    // Salva in localStorage
    localStorage.setItem('searchHistory', JSON.stringify(updated));
  }
};

// Nel dropdown, aggiungi una sezione di cronologia:
{searchHistory.length > 0 && (
  <div className="border-t border-slate-200 pt-3">
    <p className="text-xs text-slate-500 font-semibold mb-2">Recenti</p>
    <div className="space-y-2">
      {searchHistory.map((query) => (
        <button
          key={query}
          onClick={() => handleSearchChange(query)}
          className="block w-full text-left text-sm text-blue-600 hover:text-blue-700 py-1"
        >
          🕐 {query}
        </button>
      ))}
    </div>
  </div>
)}
*/

// ============================================
// SNIPPET 10: Tooltips per Preset Raggio
// ============================================
// Aggiungi descrizioni ai preset buttons

/*
const RADIUS_DESCRIPTIONS = {
  5: 'Solo nel quartiere',
  10: 'Zona limitata',
  20: 'Centro città (default)',
  50: 'Intera città',
  100: 'Area metropolitana',
};

{RADIUS_PRESETS.map((preset) => (
  <button
    key={preset}
    onClick={() => handleRadiusChange(preset)}
    title={RADIUS_DESCRIPTIONS[preset]}
    className={`...`}
  >
    {preset}
  </button>
))}
*/

// ============================================
// SNIPPET 11: Feature Flag per Filtri Avanzati
// ============================================
// Abilita/disabilita filtri avanzati con feature flag

/*
const FEATURE_FLAGS = {
  advancedFilters: true,
  searchDebounce: 500,
  radiusPresets: [5, 10, 20, 50, 100],
};

export default function HomeFilters(props) {
  const isAdvancedFilterEnabled = FEATURE_FLAGS.advancedFilters;
  const debounceMs = FEATURE_FLAGS.searchDebounce;
  const presets = FEATURE_FLAGS.radiusPresets;

  if (!isAdvancedFilterEnabled) {
    // Mostra versione semplificata
    return <SimpleFilters {...props} />;
  }

  // Mostra versione completa
  return <AdvancedFilters {...props} />;
}
*/

// ============================================
// SNIPPET 12: Esporta Preferenze Filtri (Debug)
// ============================================
// Aggiunto un bottone "Debug" per esportare stato filtri

/*
const exportFilterState = () => {
  const state = {
    searchQuery,
    radiusKm,
    showNearby,
    showOngoingMatches,
    showTodayMatches,
    locationAllowed,
    timestamp: new Date().toISOString(),
  };
  console.log('Stato Filtri:', state);
  alert(JSON.stringify(state, null, 2));
};

// Aggiungi un bottone nascosto (dev only):
{process.env.NODE_ENV === 'development' && (
  <button
    onClick={exportFilterState}
    className="text-xs text-slate-400 hover:text-slate-600"
  >
    🐛 Debug
  </button>
)}
*/

// ============================================

/*
NOTE: Tutti gli snippet sopra sono OPTIONAL e design patterns comuni.
Scegli solo quelli che ti servono e adattali al tuo progetto.

Main files modified:
- src/components/HomeFilters.jsx (CREATED)
- src/pages/Home.jsx (UPDATED)

Documentation:
- REFACTORING_FILTRI.md (completa)
- QUICK_START_FILTRI.md (veloce)
- EXAMPLE_HOMEFILTERS_USAGE.jsx (esempi)
*/
