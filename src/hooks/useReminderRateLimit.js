import { useState, useCallback } from 'react';

/**
 * Hook per gestire il rate limiting delle notifiche di reminder
 * 
 * FUNZIONAMENTO:
 * ===============
 * Questo hook previene che l'organizzatore spammi troppi reminder.
 * 
 * LIMITE: Massimo 1 notifica ogni 30 minuti per match
 * 
 * COME FUNZIONA:
 * 1. Quando il creatore clicca "Invia Reminder", viene chiamato canSendReminder()
 * 2. Questo controlla localStorage per vedere quando è stato inviato l'ultimo reminder
 * 3. Se sono passati almeno 30 minuti → PERMESSO
 * 4. Se sono passati meno di 30 minuti → BLOCCATO (mostra tempo residuo)
 * 5. Dopo l'invio, recordReminder() salva il timestamp in localStorage
 * 
 * STORAGE:
 * - Chiave: `reminder_${matchId}` (es: reminder_abc123)
 * - Valore: { lastTime: 1234567890 } (timestamp in millisecondi)
 * 
 * ESEMPIO DI FLUSSO:
 * - 14:00 → Creatore invia reminder ✅ (primo invio)
 * - 14:05 → Creatore clicca di nuovo → "Riprova tra 25:00" ❌
 * - 14:30 → Creatore può inviare di nuovo ✅
 * 
 * VANTAGGI:
 * - Salvo in localStorage (persiste tra refresh)
 * - Semplice e performante
 * - Non richiede backend
 */
export function useReminderRateLimit(matchId) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastReminderTime, setLastReminderTime] = useState(null);

  /**
   * Controlla se può inviare un reminder
   * @returns {object} { canSend: boolean, nextResetIn: number (secondi) }
   */
  const canSendReminder = useCallback(() => {
    try {
      const key = `reminder_${matchId}`;
      const stored = JSON.parse(localStorage.getItem(key) || '{}');
      const now = Date.now();
      const thirtyMinutesInMs = 30 * 60 * 1000;

      // Gestisci sia il vecchio formato (count, resetTime) che il nuovo (lastTime)
      const lastTime = stored.lastTime ?? stored.resetTime ?? 0;

      // Calcola quanto tempo è passato dall'ultimo reminder
      const timeSinceLastReminder = now - Number(lastTime);
      
      // Può inviare se sono passati almeno 30 minuti
      const canSend = timeSinceLastReminder >= thirtyMinutesInMs;
      
      // Calcola i secondi rimanenti fino al prossimo invio (sempre >= 0)
      const nextResetIn = Math.max(0, Math.ceil((thirtyMinutesInMs - timeSinceLastReminder) / 1000));

      return { canSend, nextResetIn };
    } catch (error) {
      console.error('Errore nel rate limiter:', error);
      return { canSend: true, nextResetIn: 0 };
    }
  }, [matchId]);

  /**
   * Registra che è stato inviato un reminder
   * Salva il timestamp corrente in localStorage
   */
  const recordReminder = useCallback(() => {
    const key = `reminder_${matchId}`;
    const now = Date.now();
    localStorage.setItem(key, JSON.stringify({ lastTime: now }));
    setLastReminderTime(now);
  }, [matchId]);

  return {
    canSendReminder,        // Funzione per controllare se può inviare
    recordReminder,         // Funzione per registrare l'invio
    isLoading,              // Stato di caricamento
    setIsLoading,           // Setter per isLoading
    error,                  // Errore (se presente)
    setError,               // Setter per error
    lastReminderTime,       // Timestamp dell'ultimo reminder inviato
  };
}
