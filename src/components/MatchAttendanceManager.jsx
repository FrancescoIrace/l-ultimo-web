import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { AlertTriangle, Check, X } from 'lucide-react';
import { useAlert } from './AlertComponent';

export default function MatchAttendanceManager({ match, user, onUpdate }) {
  const [isLoading, setIsLoading] = useState(false);
  const { confirmDangerous } = useAlert();

  // Calcola le ore rimanenti - datetime arriva come "YYYY-MM-DD HH:mm:ss" senza timezone
  // Calcoliamo anche i minuti per una visualizzazione più precisa, ma mostriamo solo le ore con una cifra decimale
  const now = new Date();
  const rawDatetime = match.datetime?.replace(' ', 'T') ?? '';
  const matchDate = new Date(rawDatetime);
  const hoursRemaining = (matchDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  const minutesRemaining = (matchDate.getTime() - now.getTime()) / (1000 * 60);

  // Funzione per formattare il tempo rimanente in italiano
  const formatTimeRemaining = () => {
    const totalMinutes = Math.floor(minutesRemaining);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours === 0) {
      return `${minutes} minuti`;
    } else if (hours === 1) {
      return minutes === 0 ? '1 ora' : `1 ora e ${minutes} minuti`;
    } else {
      return minutes === 0 ? `${hours} ore` : `${hours} ore e ${minutes} minuti`;
    }
  };

  // Controlla se l'utente è partecipante confermato senza risposta - calcolato direttamente nel render
  const participant = match.participants?.find(p => p.user_id === user.id);
  const shouldShow =
    participant &&
    participant.status === 'confirmed' &&
    participant.final_attendance !== true &&
    hoursRemaining > 0 &&
    hoursRemaining <= 24;

  console.log('[MatchAttendanceManager] debug:', {
    participant,
    hoursRemaining,
    shouldShow,
    participants: match.participants,
    userId: user.id,
  });

  const handleConfirm = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('participants')
      .update({ final_attendance: true })
      .eq('match_id', match.id)
      .eq('user_id', user.id)
      .select();

    console.log('[MatchAttendanceManager] confirm result:', { data, error });

    if (error) {
      console.error("Errore durante la conferma:", error);
      alert(`Errore: ${error.message}`);
    } else if (!data || data.length === 0) {
      console.warn("Nessuna riga aggiornata - possibile problema RLS o match_id/user_id errati", {
        match_id: match.id,
        user_id: user.id,
        participant_id: participant?.id,
      });
      // Prova con l'ID diretto del partecipante
      const { data: data2, error: error2 } = await supabase
        .from('participants')
        .update({ final_attendance: true })
        .eq('id', participant.id)
        .select();
      console.log('[MatchAttendanceManager] confirm retry by id:', { data2, error2 });
      if (!error2) onUpdate();
      else alert(`Errore: ${error2.message}`);
    } else {
      onUpdate();
    }
    setIsLoading(false);
  };

  const handleDecline = () => {
    confirmDangerous('Sicuro di voler rinunciare a partecipare a questa partita?', async () => {
      setIsLoading(true);

      // 1. Rimuovi il partecipante
      const { error: deleteError } = await supabase
        .from('participants')
        .delete()
        .eq('match_id', match.id)
        .eq('user_id', user.id);

      if (deleteError) {
        console.error("Errore durante la rinuncia:", deleteError);
        setIsLoading(false);
        return;
      }

      // 2. Invia notifica al creatore
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

      await supabase.from('notifications').insert({
        user_id: match.creator_id,
        sender_id: user.id,
        type: 'MATCH_LEAVE',
        message: `${userProfile?.username || 'Qualcuno'} ha rinunciato alla partita che hai creato.`,
        related_match_id: match.id,
      });

      onUpdate();
      setIsLoading(false);
    });
  };

  if (!shouldShow) {
    return null;
  }

  return (
    <div className="bg-blue-600 text-white rounded-3xl p-6 my-6 shadow-2xl animate-pulse">
      <div className="flex items-center gap-4 mb-4">
        <AlertTriangle size={32} className="flex-shrink-0" />
        <div>
          <h3 className="font-black text-xl">Conferma la tua presenza!</h3>
          <p className="text-sm text-blue-100">Manca poco all'inizio della partita.</p>
          <span className="font-bold text-white">{formatTimeRemaining()} rimanenti.</span>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          onClick={handleConfirm}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-2 bg-white text-blue-700 font-bold py-3 rounded-2xl transition hover:bg-blue-50 active:scale-95 disabled:opacity-50"
        >
          <Check size={20} />
          SÌ, CONFERMO
        </button>
        <button
          onClick={handleDecline}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-800/50 text-white font-bold py-3 rounded-2xl transition hover:bg-blue-800 active:scale-95 disabled:opacity-50"
        >
          <X size={20} />
          NO, RINUNCIO
        </button>
      </div>
    </div>
  );
}
