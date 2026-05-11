import { useEffect, useRef, useState } from 'react';
import { Filter, X } from 'lucide-react';

const RADIUS_PRESETS = [5, 10, 20, 50, 100];

export default function HomeFilters({
  searchQuery,
  onSearchChange,
  radiusKm,
  onRadiusChange,
  showOngoingMatches,
  onShowOngoingChange,
  showTodayMatches,
  onShowTodayChange,
  showNearby,
  onShowNearbyChange,
  locationAllowed,
  locationError,
  usingManualPosition,
  nearbyMatchesCount,
}) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(searchQuery);
  const searchTimeoutRef = useRef(null);

  // Debounce search (500ms)
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      onSearchChange(searchValue);
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchValue, onSearchChange]);

  const handleRadiusChange = (newRadius) => {
    onRadiusChange(newRadius);
  };

  const handleToggleOngoing = () => {
    onShowOngoingChange(!showOngoingMatches);
    if (!showOngoingMatches) {
      onShowTodayChange(false);
    }
  };

  const handleToggleToday = () => {
    onShowTodayChange(!showTodayMatches);
    if (!showTodayMatches) {
      onShowOngoingChange(false);
    }
  };

  const handleShowNearby = () => {
    onShowNearbyChange(true);
  };

  const handleShowAll = () => {
    onShowNearbyChange(false);
  };

  return (
    <div className="mb-4">
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
        Partite
      </h2>

      {/* Search Bar + Filter Button */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Cerca per titolo partita"
          className="flex-1 p-3 rounded-2xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
        <button
          onClick={() => setIsFilterOpen(!isFilterOpen)}
          className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
            isFilterOpen
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
          title="Filtri avanzati"
        >
          {isFilterOpen ? <X size={24} /> : <Filter size={24} />}
        </button>
      </div>

      {/* Nearby vs All Buttons */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          onClick={handleShowNearby}
          className={`rounded-2xl py-3 px-2 text-sm font-bold transition-all ${
            showNearby
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Per distanza
        </button>
        <button
          onClick={handleShowAll}
          className={`rounded-2xl py-3 px-2 text-sm font-bold transition-all ${
            !showNearby
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Tutte
        </button>
      </div>

      {/* Collapsible Filters */}
      {isFilterOpen && (
        <div className="rounded-2xl bg-white border border-slate-200 p-4 mb-3 space-y-4 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Toggle: Only Ongoing Matches */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-700">Solo partite in corso</p>
              <p className="text-xs text-slate-500 mt-0.5">±1 ora dall'orario</p>
            </div>
            <button
              onClick={handleToggleOngoing}
              className={`relative w-12 h-7 rounded-full transition-colors ${
                showOngoingMatches ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            >
              <div
                className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${
                  showOngoingMatches ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="border-t border-slate-200" />

          {/* Toggle: Today Concluded Matches */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-700">Partite concluse oggi</p>
              <p className="text-xs text-slate-500 mt-0.5">Iniziate da più di 1 ora</p>
            </div>
            <button
              onClick={handleToggleToday}
              className={`relative w-12 h-7 rounded-full transition-colors ${
                showTodayMatches ? 'bg-orange-500' : 'bg-slate-300'
              }`}
            >
              <div
                className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${
                  showTodayMatches ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {showNearby && (
            <>
              <div className="border-t border-slate-200" />

              {/* Radius Slider with Presets */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-slate-700">Raggio di ricerca</p>
                  <span className="text-sm font-bold text-blue-600">{radiusKm} km</span>
                </div>

                {/* Preset Buttons */}
                <div className="grid grid-cols-5 gap-2 mb-3">
                  {RADIUS_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => handleRadiusChange(preset)}
                      className={`py-2 px-1 rounded-lg text-xs font-bold transition-all ${
                        radiusKm === preset
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                {/* Slider Fallback */}
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={radiusKm}
                  onChange={(e) => handleRadiusChange(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />

                {/* Info Text */}
                <div className="mt-3 text-xs text-slate-500">
                  {locationAllowed ? (
                    <p>
                      {usingManualPosition && (
                        <span className="block mb-1">
                          📍 Usando posizione manuale
                        </span>
                      )}
                      <span className="text-slate-600">
                        Mostro solo le partite entro <strong>{radiusKm} km</strong> da te
                        {nearbyMatchesCount !== undefined && (
                          <span> ({nearbyMatchesCount} trovate)</span>
                        )}
                      </span>
                    </p>
                  ) : (
                    <p className="text-yellow-700">
                      ⚠️ {locationError || 'Sto cercando la tua posizione...'}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Info Message when filters are available */}
      {!isFilterOpen && (showOngoingMatches || showTodayMatches) && (
        <div className="text-xs text-blue-600 font-medium">
          {showOngoingMatches && '⏱️ Mostrando solo partite in corso'}
          {showTodayMatches && '📅 Mostrando solo partite concluse oggi'}
        </div>
      )}
    </div>
  );
}
