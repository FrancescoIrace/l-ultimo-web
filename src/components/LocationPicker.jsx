import { useState, useEffect, useRef } from 'react';
import { MapPin, X, Search } from 'lucide-react';

export default function LocationPicker({ value, onChange }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPos, setSelectedPos] = useState(
    value?.location_lat && value?.location_lng ? [value.location_lat, value.location_lng] : null
  );
  const [locationName, setLocationName] = useState(value?.location || '');
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);

  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.VITE_GOOGLE_API_KEY || "";

  useEffect(() => {
    if (value?.location_lat && value?.location_lng) {
      setSelectedPos([value.location_lat, value.location_lng]);
      setLocationName(value.location || '');
      // setSearchQuery(value.location || '');
    }
  }, [value]);

  useEffect(() => {
    if (!apiKey) {
      console.error("Manca la chiave API di Google Maps (VITE_GOOGLE_MAPS_API_KEY) nel file .env");
      return;
    }

    const loadGoogleMapsScript = () => {
      if (window.google?.maps?.places) {
        initAutocomplete();
        return;
      }
      
      const existingScript = document.getElementById('google-maps-script');
      if (existingScript) {
        existingScript.addEventListener('load', initAutocomplete);
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-maps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);

      script.addEventListener('load', initAutocomplete);
    };

    const initAutocomplete = () => {
      if (!inputRef.current) return;
      
      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ['establishment', 'geocode'],
        componentRestrictions: { country: 'it' },
      });

      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current.getPlace();
        
        if (place.geometry && place.geometry.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const name = place.formatted_address || place.name;
          
          updateLocation(lat, lng, name);
          setSearchQuery(name);
        }
      });
    };

    loadGoogleMapsScript();

    return () => {
      if (autocompleteRef.current && window.google) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [apiKey]);

  const updateLocation = (lat, lng, name) => {
    setSelectedPos([lat, lng]);
    setLocationName(name);
    onChangeRef.current({
      location: name,
      location_lat: lat,
      location_lng: lng
    });
  };

  const handleClear = () => {
    setSelectedPos(null);
    setLocationName('');
    setSearchQuery('');
    onChangeRef.current({ location: '', location_lat: null, location_lng: null });
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      {/* Search Bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 text-slate-400" size={18} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Cerca via, civico o un centro sportivo..."
            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            // Evita l'invio del form di CreateMatch alla pressione di Enter
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
              }
            }}
          />
        </div>
      </div>

      {/* Contenitore Mappa - Google Maps Embed API (Statica/Embed) */}
      <div className="h-64 w-full rounded-2xl overflow-hidden border border-slate-200 shadow-inner relative bg-[#f1f5f9]">
        {selectedPos ? (
          <iframe
            title="Mappa Luogo"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${selectedPos[0]},${selectedPos[1]}`}
          ></iframe>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-4 text-center">
            <MapPin size={48} className="mb-2 opacity-30" />
            <p className="text-sm font-semibold">Cerca un luogo o centro per visualizzarlo sulla mappa</p>
          </div>
        )}
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
          <button type="button" onClick={handleClear} className="text-slate-400 hover:text-red-500 transition-colors">
            <X size={20} />
          </button>
        </div>
      )}
    </div>
  );
}

