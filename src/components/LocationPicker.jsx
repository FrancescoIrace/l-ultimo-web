import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, X } from 'lucide-react';

// Crea un'icona SVG per il marker
const createSVGIcon = () => {
  return L.icon({
    iconUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 40"><circle cx="16" cy="16" r="14" fill="%23dc2626" stroke="white" stroke-width="2"/><circle cx="16" cy="16" r="8" fill="white"/></svg>',
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -40],
  });
};

// Componente per gestire i click sulla mappa
function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      onLocationSelect({ lat, lng });
    },
  });
  return null;
}

// Componente per fare pan/zoom verso il marker
function MapFlyTo({ center }) {
  const map = useMap();
  
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.flyTo(center, 16, { duration: 1 });
    }
  }, [center, map]);
  
  return null;
}

export default function LocationPicker({ value, onChange }) {
  const [mapCenter, setMapCenter] = useState([40.8199,  14.3413]); // Portici di default
  const [selectedPos, setSelectedPos] = useState(null);
  const [locationName, setLocationName] = useState(value?.location || '');
  const [searchInput, setSearchInput] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sportsCenters, setSportsCenters] = useState([]);
  const [searchResults, setSearchResults] = useState([]);

  // Coordinate bounding box della Campania
  const CAMPANIA_VIEWBOX = '13.95,41.05,14.75,40.2'; // left,top,right,bottom

  // Carica i centri sportivi locali
  useEffect(() => {
    const loadSportsCenters = async () => {
      try {
        const response = await fetch('/sportsCenters.json');
        const data = await response.json();
        setSportsCenters(data.centers || []);
      } catch (error) {
        console.error('Errore caricamento centri sportivi:', error);
      }
    };
    loadSportsCenters();
  }, []);

  // Inicializza la posizione se esiste (solo alla montatura o quando cambiano le coordinate)
  useEffect(() => {
    if (value?.location_lat && value?.location_lng) {
      setSelectedPos([value.location_lat, value.location_lng]);
      setMapCenter([value.location_lat, value.location_lng]);
    }
  }, [value?.location_lat, value?.location_lng]);

  // Funzione per ottenere nome luogo da coordinate (reverse geocoding)
  const getLocationName = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&viewbox=${CAMPANIA_VIEWBOX}&bounded=1`,
        {
          headers: {
            'User-Agent': 'L-Ultimo-App (sports-matching)'
          }
        }
      );
      const data = await response.json();
      
      // Costruisci il nome con numero civico se disponibile
      const addr = data.address || {};
      const street = addr.road || addr.street || '';
      const houseNumber = addr.house_number || '';
      const city = addr.city || addr.town || addr.village || '';
      
      let locationName = '';
      if (street) {
        locationName = houseNumber ? `${street}, ${houseNumber}` : street;
        if (city) locationName += `, ${city}`;
      } else {
        locationName = data.address?.name || data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      }
      
      return locationName;
    } catch (error) {
      console.error('Errore reverse geocoding:', error);
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  };

  // Quando si clicca sulla mappa
  const handleMapClick = async (position) => {
    setSelectedPos([position.lat, position.lng]);
    setMapCenter([position.lat, position.lng]);
    
    const name = await getLocationName(position.lat, position.lng);
    setLocationName(name);
    
    onChange({
      location: name,
      location_lat: position.lat,
      location_lng: position.lng,
    });
  };

  const handleClear = () => {
    setSelectedPos(null);
    setLocationName('');
    setSearchInput('');
    setSearchResults([]);
    onChange({
      location: '',
      location_lat: null,
      location_lng: null,
    });
  };

  // Seleziona un centro sportivo dalla lista locale
  const selectLocalCenter = (center) => {
    setSelectedPos([center.lat, center.lng]);
    setMapCenter([center.lat, center.lng]);
    setLocationName(center.name);
    setSearchResults([]);
    setSearchInput('');
    
    onChange({
      location: center.name,
      location_lat: center.lat,
      location_lng: center.lng,
    });
  };

  // Funzione per cercare nei centri sportivi locali
  const searchLocalCenters = (query) => {
    const lowerQuery = query.toLowerCase();
    return sportsCenters.filter(center =>
      center.name.toLowerCase().includes(lowerQuery) ||
      center.address.toLowerCase().includes(lowerQuery)
    ).slice(0, 5); // Restituisci max 5 risultati
  };

  // Gestore per la ricerca senza form
  const performSearch = async () => {
    if (!searchInput.trim()) return;

    setLoading(true);
    try {
      // PRIMO: Cerca nei centri sportivi locali
      const localResults = searchLocalCenters(searchInput);
      
      if (localResults.length > 0) {
        // Mostra la lista dei risultati locali trovati
        setSearchResults(localResults);
      } else {
        // FALLBACK: Se nulla trovato localmente, cerca su Nominatim
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchInput)}&limit=5&addressdetails=1&viewbox=${CAMPANIA_VIEWBOX}&bounded=1`,
          {
            headers: {
              'User-Agent': 'L-Ultimo-App (sports-matching)'
            }
          }
        );
        
        if (!response.ok) {
          throw new Error(`Errore API: ${response.status}`);
        }
        
        const results = await response.json();
        
        if (results.length > 0) {
          const first = results[0];
          const lat = parseFloat(first.lat);
          const lng = parseFloat(first.lon);
          
          // Costruisci il nome con numero civico se disponibile
          const addr = first.address || {};
          const street = addr.road || addr.street || '';
          const houseNumber = addr.house_number || '';
          const city = addr.city || addr.town || addr.village || '';
          const amenity = addr.amenity || ''; // Per strutture come "Centro sportivo"
          
          let locationName = '';
          if (amenity) {
            // Se è una struttura (centro sportivo, palestra, ecc)
            locationName = amenity;
            if (street) locationName += `, ${street}`;
            if (houseNumber) locationName += ` ${houseNumber}`;
            if (city) locationName += `, ${city}`;
          } else if (street) {
            // Se è un indirizzo stradale
            locationName = houseNumber ? `${street}, ${houseNumber}` : street;
            if (city) locationName += `, ${city}`;
          } else {
            // Fallback
            locationName = first.display_name || searchInput;
          }
          
          setSelectedPos([lat, lng]);
          setMapCenter([lat, lng]);
          setLocationName(locationName);
          
          onChange({
            location: locationName,
            location_lat: lat,
            location_lng: lng,
          });
          
          setSearchInput('');
        } else {
          alert('Posizione non trovata. Prova a cliccare sulla mappa o cercare diversamente.');
        }
      }
    } catch (error) {
      console.error('Errore ricerca:', error);
      alert('Errore nella ricerca. Prova di nuovo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
        Dove (Clicca sulla mappa o cerca)
      </label>

      {/* Search input */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Es: Via Roma 10, Napoli o Centro sportivo Napoli"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && performSearch()}
          className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
        <button
          type="button"
          onClick={performSearch}
          disabled={loading}
          className="px-4 py-3 bg-blue-600 text-white rounded-xl font-bold text-xs uppercase hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Ricerca...' : 'Cerca'}
        </button>
      </div>

      {/* Risultati ricerca locale */}
      {searchResults.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
          <p className="text-xs font-bold text-yellow-800 mb-2">Centri trovati:</p>
          <div className="space-y-2">
            {searchResults.map((center, idx) => (
              <button
                key={idx}
                onClick={() => selectLocalCenter(center)}
                className="w-full text-left p-2 bg-white hover:bg-yellow-100 border border-yellow-200 rounded-lg transition-colors text-sm"
              >
                <p className="font-bold text-slate-800">{center.name}</p>
                <p className="text-xs text-slate-600">{center.address}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mappa */}
      <div className="border border-slate-200 rounded-xl overflow-hidden h-64">
        <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <MapClickHandler onLocationSelect={handleMapClick} />
          <MapFlyTo center={selectedPos} />
          {selectedPos && (
            <Marker position={selectedPos} icon={createSVGIcon()}>
              <Popup>{locationName}</Popup>
            </Marker>
          )}
        </MapContainer>
      </div>

      {/* Info posizione selezionata */}
      {selectedPos && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm">
          <div className="flex items-start gap-2">
            <MapPin size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold text-slate-800">{locationName}</p>
              <p className="text-xs text-slate-600">
                {selectedPos[0].toFixed(4)}°, {selectedPos[1].toFixed(4)}°
              </p>
            </div>
            <button
              onClick={handleClear}
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Avviso quando non selezionata */}
      {!selectedPos && (
        <p className="text-xs text-slate-500 italic">
          Clicca sulla mappa o cerca un indirizzo (es: Via Roma 10, Milano) o una struttura sportiva (es: Centro sportivo Milano)
        </p>
      )}
    </div>
  );
}
