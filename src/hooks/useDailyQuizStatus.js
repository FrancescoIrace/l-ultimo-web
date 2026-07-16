import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const getTodayDateStr = () => new Date().toISOString().split('T')[0];

// Centralizza il controllo "l'utente ha gia' giocato la Sfida Giornaliera oggi?",
// prima duplicato tra PWADashboard.jsx (banner in home) e SfidaGiornaliera.jsx (pagina del quiz).
export function useDailyQuizStatus() {
  const [status, setStatus] = useState('LOADING'); // LOADING | UNAUTHENTICATED | ALREADY_PLAYED | AVAILABLE | ERROR
  const [streakDays, setStreakDays] = useState(0);

  const refresh = useCallback(async () => {
    setStatus('LOADING');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStatus('UNAUTHENTICATED');
        return;
      }

      const { data: attempt, error } = await supabase
        .from('daily_game_attempts')
        .select('id')
        .eq('user_id', user.id)
        .eq('played_at', getTodayDateStr())
        .maybeSingle();

      if (error) throw error;

      // La streak (giorni consecutivi) serve sia come nudge prima di giocare sia come
      // riepilogo dopo: la calcoliamo qui una volta sola per entrambi i casi.
      const { data: streak, error: streakError } = await supabase.rpc('get_daily_quiz_streak');
      if (streakError) throw streakError;
      setStreakDays(streak ?? 0);

      setStatus(attempt ? 'ALREADY_PLAYED' : 'AVAILABLE');
    } catch (err) {
      console.error('Errore controllo stato Sfida Giornaliera:', err);
      setStatus('ERROR');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { status, streakDays, refresh };
}
