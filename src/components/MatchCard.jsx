import { useState, useEffect } from 'react';
import { Calendar, MapPin, Users, Pencil } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';


export default function MatchCard({ match, user }) {
  const [isJoined, setIsJoined] = useState(false);
  const isFull = match.current_players >= match.max_players;
  const isCreator = match.creator_id === user.id;
  const navigate = useNavigate();
  const isPast = new Date(match.datetime) < new Date();

  const date = new Date(match.datetime).toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Controlliamo se l'utente è già tra i partecipanti al caricamento
  useEffect(() => {

    async function checkUserRegistration() {
      const { data, error } = await supabase
        .from('participants')
        .select('id')
        .eq('match_id', match.id)
        .eq('user_id', user.id)
        .single();

      if (data) {
        setIsJoined(true);
      }
    }

    checkUserRegistration();
  }, [match.id, user.id]);

  const handleJoin = async () => {
    if (isJoined) {
      alert("Sei già iscritto a questa partita!");
      return;
    } // Evita click doppi se già unito

    if (isFull) {
      alert("Partita piena!"); // Qui poi metteremo la lista d'attesa
      return;
    }

    const { error: partError } = await supabase
      .from('participants')
      .insert([{ match_id: match.id, user_id: user.id }]);

    if (!partError) {
      await supabase
        .from('matches')
        .update({ current_players: match.current_players + 1 })
        .eq('id', match.id);

      alert("Iscritto con successo!");
      setIsJoined(true);
    } else {
      alert("Errore durante l'iscrizione: " + partError.message);
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
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition-shadow relative cursor-pointer active:scale-95 transition-all" onClick={() => navigate(`/match/${match.id}`)}>
      {/* Badge Organizzatore */}
      {isCreator && (
        <span className="absolute -top-2 -right-2 bg-amber-400 text-amber-900 text-[10px] font-black px-2 py-1 rounded-lg shadow-sm">
          TUO MATCH
        </span>
      )}
      <div className="flex justify-between items-start mb-3">
        <div className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-xs font-bold uppercase">
          {match.sport}
        </div>
        {isPast ? (
          <span className="text-xs font-medium text-red-500">PARTITA PASSATA</span>
        ) : (
          <span className={`text-xs font-medium ${isFull ? 'text-red-500' : 'text-green-500'}`}>
            {isFull ? 'PARTITA PIENA' : 'POSTI DISPONIBILI'}
          </span>
        )}

      </div>

      <h3 className="text-lg font-bold text-slate-800 mb-2 uppercase tracking-wide cursor-pointer hover:border-blue-300 transition-all">
        {match.title && match.title.length > 32 ? `${match.title.slice(0, 32)}...` : match.title || `Partita di ${match.sport}`}
      </h3>

      <div className="space-y-2 text-slate-600 text-sm">
        <div className="flex items-center gap-2">
          <Calendar size={16} />
          <span>{date}</span>
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
          <Users size={16} />
          <span className="font-semibold">{match.current_players} / {match.max_players} Giocatori</span>
        </div>
        <div className={`flex items-center gap-2 ${match.description ? '' : 'opacity-50 italic'}`}>
          <Pencil size={16} />
          <span className="font-semibold">{match.description ? match.description : "Nessuna nota"}</span>
        </div>
      </div>

      <div className="flex justify-between items-center mt-6">
        {/* Se sei il creatore, magari vuoi un tasto rosso piccolo per cancellare */}
        {isCreator && !isPast && (
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
            className="text-xs text-red-400 font-bold hover:text-red-600 transition-colors"
          >
            Annulla Partita
          </button>
        )}

        {!isPast ? (
          <button
            onClick={(e) => { e.stopPropagation(); handleJoin(); }}
            disabled={isJoined || isFull}
            className={`px-6 py-3 rounded-2xl font-bold text-sm transition-all active:scale-95 ${isFull
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : isJoined
                ? 'bg-green-600 text-white cursor-default'
                : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
          >
            {isJoined ? '✓ GIÀ UNITO' : isFull ? 'PIENA' : 'UNISCITI'}
          </button>

        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); }}
            className={` px-6 py-3 rounded-2xl font-bold text-sm transition-all active:scale-95 bg-slate-100 text-slate-400 cursor-not-allowed`}
          >
            {isJoined ? '✓ HAI PARTECIPATO' : 'PARTITA PASSATA'}          </button>
        )}

      </div>



    </div >
  );
}