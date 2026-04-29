import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, X, Search } from 'lucide-react';

// Icona personalizzata
const createSVGIcon = () => {
  return L.icon({
    iconUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 40"><path d="M16 0C10.5 0 6 4.5 6 10c0 8 10 22 10 22s10-14 10-22c0-5.5-4.5-10-10-10z" fill="%232563eb"/><circle cx="16" cy="10" r="4" fill="white"/></svg>',
    iconSize: [32, 40],
    iconAnchor: [16, 40],
  });
};

function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      onLocationSelect({ lat, lng });
    },
  });
  return null;
}

function MapFlyTo({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, 16);
  }, [center, map]);
  return null;
}

// Sostituisci o aggiorna questo componente dentro LocationPicker.jsx
function MapResizeFix({ selectedPos }) {
  const map = useMap();

  useEffect(() => {
    // Eseguiamo il ricalcolo più volte a brevi intervalli per "inseguire" 
    // eventuali animazioni CSS del contenitore
    const timer = setInterval(() => {
      map.invalidateSize();
    }, 100);

    // Fermiamo il timer dopo 1 secondo (tempo sufficiente per il caricamento)
    const timeout = setTimeout(() => {
      clearInterval(timer);
      map.invalidateSize();
    }, 1000);

    return () => {
      clearInterval(timer);
      clearTimeout(timeout);
    };
  }, [map, selectedPos]); // Si riattiva se cambia la posizione o la mappa

  return null;
}

export default function LocationPicker({ value, onChange }) {
  const [searchQuery, setSearchQuery] = useState('');
  // Inizializziamo gli stati dai valori passati (props)
  const [selectedPos, setSelectedPos] = useState(
    value?.location_lat && value?.location_lng ? [value.location_lat, value.location_lng] : null
  );
  const [locationName, setLocationName] = useState(value?.location || '');

  // Sincronizzazione se il valore cambia dall'esterno (es. selezione centro)
  useEffect(() => {
    if (value?.location_lat && value?.location_lng) {
      setSelectedPos([value.location_lat, value.location_lng]);
      setLocationName(value.location || '');
    }
  }, [value]);

  const handleSearch = async () => {
    if (!searchQuery) return;
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&addressdetails=1&countrycodes=it&limit=1`
      );
      const data = await response.json();

      if (data.length > 0) {
        const res = data[0];
        // Costruiamo un indirizzo leggibile col civico
        const street = res.address.road || '';
        const houseNumber = res.address.house_number || '';
        const city = res.address.city || res.address.town || '';
        const displayName = `${street} ${houseNumber}${houseNumber ? ',' : ''} ${city}`.trim() || res.display_name;

        updateLocation(parseFloat(res.lat), parseFloat(res.lon), displayName);
      }
    } catch (err) {
      console.error("Errore ricerca:", err);
    }
  };

  const handleLocationSelect = async ({ lat, lng }) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`
      );
      const data = await response.json();

      const street = data.address.road || '';
      const houseNumber = data.address.house_number || '';
      const city = data.address.city || data.address.town || '';
      const displayName = `${street} ${houseNumber}${houseNumber ? ',' : ''} ${city}`.trim() || data.display_name;

      updateLocation(lat, lng, displayName);
    } catch (err) {
      updateLocation(lat, lng, `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    }
  };

  const updateLocation = (lat, lng, name) => {
    setSelectedPos([lat, lng]);
    setLocationName(name);
    onChange({
      location: name,
      location_lat: lat,
      location_lng: lng
    });
  };

  const handleClear = () => {
    setSelectedPos(null);
    setLocationName('');
    setSearchQuery('');
    onChange({ location: '', location_lat: null, location_lng: null });
  };

  return (
    <div className="space-y-3">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Cerca via e civico..."
            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
          />
        </div>
        <button
          type="button"
          onClick={handleSearch}
          className="bg-blue-600 text-white px-5 rounded-xl font-bold active:scale-95 transition-all"
        >
          CERCA
        </button>
      </div>

      {/* Contenitore Mappa - Rimosso padding e aggiunto overflow-hidden */}
      <div className="h-64 w-full rounded-2xl overflow-hidden border border-slate-200 shadow-inner relative bg-[#f1f5f9]">
        <MapContainer
          center={selectedPos || [40.817, 14.333]}
          zoom={selectedPos ? 16 : 13}
          style={{ height: '100%', width: '100%' }}
          whenReady={(mapInstance) => {
            // Forza il ricalcolo appena la mappa è "pronta" nel DOM
            setTimeout(() => mapInstance.target.invalidateSize(), 100);
          }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            keepBuffer={12} // Aumentiamo il buffer per caricare più tasselli attorno alla vista
          />

          <MapResizeFix selectedPos={selectedPos} />

          <MapClickHandler onLocationSelect={handleLocationSelect} />

          {selectedPos && (
            <>
              <Marker position={selectedPos} icon={createSVGIcon()} />
              <MapFlyTo center={selectedPos} />
            </>
          )}
        </MapContainer>
      </div>

      {/* Result Box */}
      {locationName && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-1">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <MapPin size={20} />
          </div>
          <div className="flex-1">
            <p className="font-bold text-slate-800 leading-tight">{locationName}</p>
            <p className="text-[10px] text-blue-500 font-black uppercase mt-1 tracking-tighter">Posizione impostata correttamente</p>
          </div>
          <button onClick={handleClear} className="text-slate-400 hover:text-red-500 transition-colors">
            <X size={20} />
          </button>
        </div>
      )}
    </div>
  );
}