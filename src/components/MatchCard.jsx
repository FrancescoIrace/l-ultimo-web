import { useState, useEffect } from 'react';
import { Calendar, MapPin, Users, Pencil } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAlert } from './AlertComponent';


export default function MatchCard({ match, user }) {
  const { alert, success, error, confirm, confirmDangerous } = useAlert();
  const [isJoined, setIsJoined] = useState(false);
  const isCreator = match.creator_id === user.id;
  const navigate = useNavigate();
  const isPast = new Date(match.datetime) < new Date();
  const [participants, setParticipants] = useState([]);
  const [waitingPlayers, setWaitingPlayers] = useState([]);
  const [confirmedPlayers, setConfirmedPlayers] = useState([]);

  // La partita è piena solo se i CONFERMATI raggiungono il limite
  const isFull = confirmedPlayers.length >= match.max_players;
  const isConfirmed = confirmedPlayers.some(p => p.user_id === user.id);
  const isWaiting = waitingPlayers.some(p => p.user_id === user.id);

  // Converti datetime string a oggetto Date
  const date = new Date(match.datetime);

  // Calcola il tempo rimanente
  const getTimeUntilMatch = () => {
    const now = new Date();
    const matchTime = date;
    const diff = matchTime - now;
    const hours = diff / (1000 * 60 * 60);
    const minutes = Math.floor(diff / (1000 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 0) return null; // Non mostrare se la partita è passata

    if (days >= 2) {
      return { label: `Tra ${days} giorni`, urgent: false };
    } else if (days === 1) {
      return { label: 'Domani', urgent: false };
    } else if (hours >= 12) {
      return { label: `Oggi (${Math.floor(hours)}h)`, urgent: false };
    } else if (hours >= 1) {
      return { label: `Tra ${Math.floor(hours)}h`, urgent: true };
    } else if (minutes > 0) {
      return { label: `Tra ${minutes}m`, urgent: true };
    }
    return null;
  };

  const timeInfo = getTimeUntilMatch();
  const timeLabel = timeInfo?.label;

  // In MatchCard.jsx
  useEffect(() => {
    if (!match.id || !user?.id) return;

    const fetchParticipants = async () => {
      const { data, error } = await supabase
        .from('participants')
        .select('user_id, status')
        .eq('match_id', match.id);

      if (!error && data) {
        setConfirmedPlayers(data.filter(p => p.status === 'confirmed'));
        setWaitingPlayers(data.filter(p => p.status === 'waiting'));
        // Verifica se l'utente loggato è tra i partecipanti (confermati o in attesa)
        setIsJoined(data.some(p => p.user_id === user.id));
      }
    };

    fetchParticipants();

    // Canale Real-time per la card
    const channel = supabase
      .channel(`match_card_${match.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'participants',
          filter: `match_id=eq.${match.id}`,
        },
        () => {
          fetchParticipants(); // Ricarica i dati locali alla card quando cambia qualcosa
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [match.id, user.id]);


  const handleJoin = async () => {
    const { data: status, error: rpcError } = await supabase.rpc('join_match_v2', {
      p_match_id: match.id,
      p_user_id: user.id,
      p_username: user.user_metadata?.username || 'Un giocatore'
    });

    if (rpcError) {
      error("Errore durante l'iscrizione: " + rpcError.message);
      return;
    }

    // Gestiamo il feedback all'utente in base a cosa ha deciso il database
    switch (status) {
      case 'confirmed':
        success("Iscritto con successo! Sei in campo.");
        break;
      case 'waiting':
        success("Partita piena: sei stato inserito in lista d'attesa.");
        break;
      case 'already_registered':
        error("Sei già iscritto a questa partita.");
        break;
      default:
        success("Richiesta elaborata.");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Vuoi davvero annullare questa partita?")) return;

    const { error } = await supabase
      .from('matches')
      .delete()
      .eq('id', match.id);

    if (error) alert("Errore nella cancellazione");
    else alert("Partita annullata correttamente!");
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition-shadow relative cursor-pointer active:scale-95 transition-all ${isPast ? 'opacity-60' : ''}`} onClick={() => navigate(`/match/${match.id}`)}>
      {/* Indicatore partita passata */}
      {isPast && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-slate-300 to-slate-200 rounded-t-xl"></div>
      )}

      {/* Overlay obliquo "Partita Finita" */}
      {isPast && (
        <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-31 w-80 bg-red-400 rounded-xl text-white font-bold text-center py-2 opacity-60 shadow-xl">
            Partita Finita
          </div>
        </div>
      )}
      {isCreator && (
        <span className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-amber-400 text-amber-900 text-[10px] font-black px-2 py-1 rounded-lg shadow-sm">
          TUO MATCH
        </span>
      )}
      <div className="flex justify-between items-start mb-3">
        <div className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-xs font-bold uppercase">
          {match.sport}
        </div>
        <div className="flex flex-col items-end gap-1">
          {timeLabel && (
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${timeInfo?.urgent ? 'text-red-600 bg-red-50' : 'text-indigo-600 bg-indigo-50'}`}>
              {timeLabel}
            </span>
          )}

        </div>
      </div>

      <h3 className="text-lg font-bold text-slate-800 mb-2 uppercase tracking-wide cursor-pointer hover:border-blue-300 transition-all">
        {match.title && match.title.length > 32 ? `${match.title.slice(0, 32)}...` : match.title || `Partita di ${match.sport}`}
      </h3>

      <div className="space-y-2 text-slate-600 text-sm">
        <div className="flex items-center gap-2">
          <Calendar size={16} />
          <span>{date.toLocaleString('it-IT', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin size={16} />
          <span>{match.location}</span>
        </div>
        {match.distance != null && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Distanza:</span>
            <span className="font-semibold">{match.distance.toFixed(1)} km</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Users size={16} color={isFull ? 'red' : 'green'} />
          <span className={`font-semibold ${isFull ? 'text-red-500' : 'text-green-500'}`}>{confirmedPlayers.length} / {match.max_players} Giocatori </span>
        </div>
        {waitingPlayers.length > 0 && (
          <>
            <div className="flex items-center gap-2">
              <Users size={16} color={'orange'} />
              <span className="text-orange-400">Giocatori in attesa: {waitingPlayers.length}</span>
            </div>
          </>
        )}

        <div className={`flex items-center gap-2 ${match.description ? '' : 'opacity-50 italic'}`}>
          <Pencil size={16} />
          <span className="font-semibold">{match.description ? match.description : "Nessuna nota"}</span>
        </div>
      </div>


      <div className="mt-6">
        {isPast ? (
          /* STATO 1: PARTITA CONCLUSA */
          <button
            disabled
            className="w-full py-3 rounded-2xl font-bold text-sm bg-slate-100 text-slate-400 cursor-not-allowed"
          >
            PARTITA CONCLUSA
          </button>
        ) : isConfirmed ? (
          /* STATO 2: GIOCATORE CONFERMATO */
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/match/${match.id}`);
            }}
            className="w-full py-3 rounded-2xl font-bold text-sm bg-green-600 text-white shadow-lg shadow-green-100 active:scale-95 transition-all"
          >
            ✓ SEI IN CAMPO
          </button>
        ) : isWaiting ? (
          /* STATO 3: GIOCATORE IN LISTA D'ATTESA */
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/match/${match.id}`);
            }}
            className="w-full py-3 rounded-2xl font-bold text-sm bg-amber-500 text-white shadow-lg shadow-amber-100 active:scale-95 transition-all"
          >
            ⏳ IN LISTA D'ATTESA
          </button>
        ) : isFull ? (
          /* STATO 4: PARTITA PIENA (MA UTENTE ESTERNO) */
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleJoin();
            }}
            className="w-full py-3 rounded-2xl font-bold text-sm bg-slate-800 text-white shadow-lg shadow-slate-200 hover:bg-slate-900 active:scale-95 transition-all"
          >
            UNISCITI ALLA LISTA
          </button>
        ) : (
          /* STATO 5: POSTI DISPONIBILI (UTENTE ESTERNO) */
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleJoin();
            }}
            className="w-full py-3 rounded-2xl font-bold text-sm bg-blue-600 text-white shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95 transition-all"
          >
            UNISCITI ORA
          </button>
        )}
      </div>


    </div >
  );
}