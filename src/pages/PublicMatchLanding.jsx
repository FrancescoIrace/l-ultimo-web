import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Calendar, MapPin, Users, LogIn, Smartphone, ArrowLeft, ArrowRight, SportShoe } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Loader from '../components/Loader';

export default function PublicMatchLanding() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadMatch() {
      const { data, error } = await supabase
        .from('matches')
        .select('id, title, sport, datetime, location, description, max_players, current_players')
        .eq('id', id)
        .eq('is_public', true)
        .maybeSingle();

      if (error) {
        console.error('Errore caricamento partita pubblica:', error);
        setError('Partita non trovata.');
      } else if (!data) {
        setError('Partita non trovata o non pubblica.');
      } else {
        setMatch(data);
      }
      setLoading(false);
    }

    loadMatch();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white px-6">
        <Loader variant="inline" size={48} />
        <p className="mt-4 text-slate-300 font-bold">Caricamento partita...</p>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center px-6 text-center">
        <span className="text-2xl font-black tracking-tighter mb-8">L'ULTIMO</span>
        <div className="w-full max-w-sm rounded-3xl bg-slate-800 border border-slate-700 p-8">
          <h1 className="text-2xl font-black mb-3">Partita non trovata</h1>
          <p className="text-slate-300 text-sm leading-relaxed mb-6">
            Il link potrebbe essere scaduto o la partita non è più pubblica.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-2xl bg-lime-300 text-slate-900 font-black px-6 py-3 hover:bg-lime-200 transition-colors"
          >
            Vai su L'ULTIMO <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    );
  }

  const when = new Date(match.datetime).toLocaleString('it-IT', {
    weekday: 'long', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
  const spotsLeft = Math.max(0, (match.max_players || 0) - (match.current_players || 0));
  const fillPct = match.max_players ? Math.min(100, Math.round((match.current_players / match.max_players) * 100)) : 0;
  const isFull = spotsLeft === 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* HERO scuro */}
      <div className="bg-slate-900 text-white">
        <div className="max-w-lg mx-auto px-5 pt-6 pb-24">
          <div className="flex items-center justify-between mb-8">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 text-slate-400 text-sm font-bold hover:text-white transition-colors"
            >
              <ArrowLeft size={16} /> Indietro
            </button>
            <span className="text-lg font-black tracking-tighter">L'ULTIMO</span>
          </div>

          <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-lime-300 bg-lime-300/10 px-3 py-1.5 rounded-full mb-4">
            ● Sei stato invitato
          </span>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">{match.title || match.sport}</h1>
          <p className="text-slate-300 text-sm sm:text-base flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5"><SportShoe size={16} className="text-lime-300" /> {match.sport}</span>
            <span className="inline-flex items-center gap-1.5 capitalize"><Calendar size={16} className="text-lime-300" /> {when}</span>
          </p>
        </div>
      </div>

      {/* CARD dettagli (sovrapposta all'hero) */}
      <div className="max-w-lg mx-auto px-5 -mt-16 pb-10">
        <div className="rounded-3xl bg-white border border-slate-200 p-6 shadow-xl shadow-slate-200/60">
          <div className="grid grid-cols-2 gap-3 mb-5">
            <InfoTile icon={<SportShoe size={13} className="text-blue-600" />} label="Sport" value={match.sport} />
            <InfoTile icon={<MapPin size={13} className="text-blue-600" />} label="Dove" value={match.location} />
            <InfoTile icon={<Calendar size={13} className="text-blue-600" />} label="Quando" value={when} className="capitalize" />
            <InfoTile icon={<Users size={13} className="text-blue-600" />} label="Posti" value={isFull ? 'Al completo' : `${spotsLeft} liberi`} />
          </div>

          {/* Barra riempimento partecipanti */}
          <div className="mb-2 flex items-center justify-between text-xs font-bold">
            <span className="text-slate-500 uppercase tracking-wider">Partecipanti</span>
            <span className={isFull ? 'text-red-500' : 'text-blue-600'}>{match.current_players}/{match.max_players}</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${isFull ? 'bg-red-500' : 'bg-blue-600'}`}
              style={{ width: `${fillPct}%` }}
            />
          </div>

          {match.description && (
            <div className="mt-6 rounded-2xl bg-slate-50 border border-slate-200 p-4">
              <h2 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5">Descrizione</h2>
              <p className="text-sm text-slate-700 leading-relaxed">{match.description}</p>
            </div>
          )}
        </div>

        {/* CTA conversione */}
        <div className="mt-5 rounded-3xl bg-slate-900 text-white p-6 sm:p-7">
          <h2 className="text-xl font-black mb-2">Vuoi entrare in partita?</h2>
          <p className="text-slate-300 text-sm leading-relaxed mb-5">
            Registrati su L'ULTIMO, installa l'app e torna a questo link per prenotare il tuo posto — è gratis.
          </p>
          <ol className="space-y-2.5 mb-6">
            {[
              { n: '1', t: 'Crea il tuo account gratuito' },
              { n: '2', t: "Installa l'app sul telefono" },
              { n: '3', t: 'Riapri questo link e prenota il posto' },
            ].map(s => (
              <li key={s.n} className="flex items-center gap-3">
                <span className="w-7 h-7 flex-shrink-0 rounded-xl bg-lime-300 text-slate-900 font-black text-sm flex items-center justify-center">{s.n}</span>
                <span className="text-sm font-bold text-slate-100">{s.t}</span>
              </li>
            ))}
          </ol>
          <div className="space-y-3">
            <Link
              to="/signup"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-lime-300 py-3.5 text-slate-900 font-black hover:bg-lime-200 transition-colors"
            >
              <LogIn size={18} /> Registrati e gioca
            </Link>
            <div className="flex gap-3">
              <Link
                to="/login"
                className="flex-1 text-center rounded-2xl border border-slate-700 py-3 text-sm font-bold text-slate-200 hover:bg-slate-800 transition-colors"
              >
                Ho già un account
              </Link>
              <Link
                to="/install-guide"
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl border border-slate-700 py-3 text-sm font-bold text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <Smartphone size={16} /> Installa
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoTile({ icon, label, value, className = '' }) {
  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1">
        {icon} {label}
      </div>
      <p className={`text-sm font-bold text-slate-800 leading-tight break-words ${className}`}>{value || '—'}</p>
    </div>
  );
}
