import { useState, useEffect } from 'react';
import { Calendar, MapPin, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';


export default function MatchCard({ match, user }) {
  const [isJoined, setIsJoined] = useState(false);
  const isFull = match.current_players >= match.max_players;
  const isCreator = match.creator_id === user.id;

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
        console.log(data);
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
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition-shadow relative">
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
        <span className={`text-xs font-medium ${isFull ? 'text-red-500' : 'text-green-500'}`}>
          {isFull ? 'PARTITA PIENA' : 'POSTI DISPONIBILI'}
        </span>
      </div>

      <h3 className="text-lg font-bold text-slate-800 mb-2 uppercase tracking-wide">
        {match.title || `Partita di ${match.sport}`}
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
        <div className="flex items-center gap-2">
          <Users size={16} />
          <span className="font-semibold">{match.current_players} / {match.max_players} Giocatori</span>
        </div>
      </div>

      {/* <button className={`w-full mt-4 py-2 rounded-lg font-bold transition-colors ${isFull
          ? 'bg-orange-500 text-white hover:bg-orange-600'
          : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}>
        {isFull ? 'Mettiti in lista d\'attesa' : 'Unisciti alla partita'}
      </button> */}

      <div className="flex justify-between items-center mt-6">
        {/* Se sei il creatore, magari vuoi un tasto rosso piccolo per cancellare */}
        {isCreator && (
          <button
            onClick={handleDelete}
            className="text-xs text-red-400 font-bold hover:text-red-600 transition-colors"
          >
            Annulla Partita
          </button>
        )}

        <button
          onClick={handleJoin}
          disabled={isFull && !isJoined}
          className={`px-6 py-3 rounded-2xl font-bold text-sm transition-all active:scale-95 ${isJoined
            ? 'bg-green-100 text-green-600 border border-green-200'
            : isFull
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-blue-600 text-white shadow-lg shadow-blue-100 hover:bg-blue-700'
            }`}
        >
          {isJoined ? '✓ GIÀ UNITO' : isFull ? 'PIENA' : 'UNISCITI'}
        </button>
      </div>



    </div >
  );
}