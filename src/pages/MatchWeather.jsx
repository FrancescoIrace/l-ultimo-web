import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getWeather, isWithinSevenDays } from '../lib/weatherService';
import { ChevronRight, Loader, Calendar, MapPin, Droplets, Wind, Eye } from 'lucide-react';

export default function MatchWeather() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch match data
        const { data: matchData, error: matchError } = await supabase
          .from('matches')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (matchError || !matchData) {
          setError('Partita non trovata');
          setLoading(false);
          return;
        }

        setMatch(matchData);

        // Fetch weather data
        if (matchData.location_lat && matchData.location_lng && matchData.datetime) {
          const matchDate = new Date(matchData.datetime.replace(' ', 'T'));
          
          if (isWithinSevenDays(matchDate)) {
            const weather = await getWeather(
              matchData.location_lat,
              matchData.location_lng,
              matchDate
            );
            setWeatherData(weather);
          } else {
            setError('Meteo disponibile solo per partite entro 7 giorni');
          }
        } else {
          setError('Dati di ubicazione non disponibili');
        }
      } catch (err) {
        console.error('Errore nel caricamento:', err);
        setError('Errore nel caricamento dei dati meteo');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-md mx-auto p-4 flex flex-col items-center justify-center min-h-screen">
        <Loader size={48} strokeWidth={1.5} className="loader-spin text-blue-500 mb-4" />
        <p className="text-slate-600 font-semibold">Caricamento meteo...</p>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="max-w-md mx-auto p-4">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-1.5 text-xs font-bold uppercase text-slate-400 hover:text-slate-600 transition"
        >
          <ChevronRight size={14} className="rotate-180" />
          Indietro
        </button>
        <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-center">
          <p className="text-red-600 font-bold mb-2">⚠️ Errore</p>
          <p className="text-red-500 text-sm">{error || 'Dati non disponibili'}</p>
        </div>
      </div>
    );
  }

  const matchDate = new Date(match.datetime.replace(' ', 'T'));

  return (
    <div className="max-w-md mx-auto p-4">
      {/* Back Button */}
      <button
        onClick={() => navigate(`/match/${id}`)}
        className="mb-6 flex items-center gap-1.5 text-xs font-bold uppercase text-slate-400 hover:text-slate-600 transition"
      >
        <ChevronRight size={14} className="rotate-180" />
        Torna alla Partita
      </button>

      {/* Match Info */}
      <div className="mb-6">
        <h2 className="text-2xl font-black uppercase mb-2 break-words">{match.title || match.sport}</h2>
        <div className="space-y-2 text-slate-600 text-sm">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-blue-500" />
            <span>{matchDate.toLocaleString('it-IT', { year: 'numeric', month: 'long', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-green-500" />
            <span>{match.location}</span>
          </div>
        </div>
      </div>

      {/* Main Weather Box */}
      {weatherData && (
        <div className="mb-6 p-6 rounded-2xl bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-50 border border-blue-300 shadow-lg">
          {/* Big Emoji + Temp */}
          <div className="flex items-center gap-4 mb-6">
            <span className="text-7xl">{weatherData.emoji}</span>
            <div>
              <div className="text-5xl font-black text-slate-800 leading-tight">{weatherData.temperature}°C</div>
              <div className="text-lg text-slate-600 font-semibold mt-1">{weatherData.description}</div>
            </div>
          </div>

          {/* Detailed Info Cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* Precipitation Probability */}
            <div className="p-3 rounded-xl bg-white/70 border border-blue-100">
              <div className="flex items-center gap-2 mb-1">
                <Droplets size={18} className="text-blue-500" />
                <span className="text-[10px] uppercase font-black text-slate-400 tracking-wide">Pioggia</span>
              </div>
              <p className={`text-2xl font-black ${weatherData.rainProbability > 60 ? 'text-red-500' : weatherData.rainProbability > 30 ? 'text-orange-500' : 'text-green-500'}`}>
                {weatherData.rainProbability}%
              </p>
            </div>

            {/* WMO Code Info */}
            <div className="p-3 rounded-xl bg-white/70 border border-blue-100">
              <div className="flex items-center gap-2 mb-1">
                <Eye size={18} className="text-indigo-500" />
                <span className="text-[10px] uppercase font-black text-slate-400 tracking-wide">Codice WMO</span>
              </div>
              <p className="text-2xl font-black text-indigo-600">
                {weatherData.weatherCode}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200">
        <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-2">
          📡 Fonte Dati
        </p>
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-800">Open-Meteo API</span> - Previsioni meteo gratuite e accurate per la tua posizione. I dati vengono aggiornati in tempo reale.
        </p>
        <p className="text-xs text-slate-500 mt-3">
          ⚠️ Le previsioni meteo possono variare. Si consiglia di controllare le condizioni prima della partita.
        </p>
      </div>

      {/* Tips */}
      <div className="mt-6 p-4 rounded-2xl bg-amber-50 border border-amber-200">
        <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mb-2">
          💡 Consigli
        </p>
        <ul className="text-xs text-slate-600 space-y-1">
          {weatherData?.rainProbability > 70 && (
            <li>🌧️ Alta probabilità di pioggia - Porta un ombrello!</li>
          )}
          {weatherData?.temperature < 10 && (
            <li>🧊 Farai freddo - Vesti a strati!</li>
          )}
          {weatherData?.temperature > 28 && (
            <li>☀️ Molto caldo - Idratati bene!</li>
          )}
          {!weatherData?.rainProbability > 30 && (
            <li>☀️ Meteo sereno - Perfetto per giocare!</li>
          )}
        </ul>
      </div>
    </div>
  );
}
