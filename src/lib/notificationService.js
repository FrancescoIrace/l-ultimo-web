import { supabase } from '../lib/supabase';

/**
 * Chiama l'Edge Function per inviare le push notifications
 * @param {string} notificationId - ID della notifica
 */
async function triggerPushNotification(notificationId) {
  try {
    console.log('📤 Chiamando Edge Function per push:', notificationId);
    
    const response = await supabase.functions.invoke('send-push-notification', {
      body: { notificationId },
    });

    console.log('✅ Edge Function risposta:', response);
    return response;
  } catch (err) {
    console.error('❌ Errore nell\'invio della push via Edge Function:', err);
    // Non lancia errore, così la notifica in-app funziona comunque
  }
}

/**
 * Crea una notifica per un utente
 * @param {string} userId - ID dell'utente destinatario
 * @param {string} senderId - ID dell'utente che ha generato l'azione (opzionale)
 * @param {string} type - Tipo di notifica (match_join, match_update, etc.)
 * @param {string} title - Titolo della notifica
 * @param {string} content - Contenuto/messaggio della notifica
 * @param {string} link - Link per reindirizzare (es: /match/123)
 * @param {object} metadata - Dati extra opzionali
 * @param {boolean} sendPush - Se true, invia anche via push notification
 */
export async function createNotification({
  userId,
  senderId = null,
  type,
  title,
  content,
  link = null,
  metadata = {},
  sendPush = true,
}) {
  try {
    console.log('📝 Creando notifica:', { type, title, userId });
    
    // Usa la RPC function che bypassa RLS
    const { data, error } = await supabase.rpc('create_notification_with_push', {
      p_user_id: userId,
      p_sender_id: senderId,
      p_type: type,
      p_title: title,
      p_content: content,
      p_link: link,
      p_metadata: metadata,
      p_send_push: sendPush,
    });

    if (error) throw error;

    const notificationId = data;
    console.log('✅ Notifica creata:', notificationId);

    // Se sendPush è true, chiama l'Edge Function
    if (sendPush && notificationId) {
      // Esegui in background, non bloccare
      triggerPushNotification(notificationId);
    }

    return { success: true, data: { id: notificationId } };
  } catch (err) {
    console.error('❌ Errore nella creazione della notifica:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Notifica quando qualcuno si unisce a un match
 * @param {string} matchId - ID del match
 * @param {string} matchTitle - Titolo del match
 * @param {string} playerName - Nome del giocatore che si unisce
 * @param {string} organizerId - ID dell'organizzatore del match
 * @param {string} joinedUserId - ID dell'utente che si è unito
 */
export async function notifyMatchJoin(
  matchId,
  matchTitle,
  playerName,
  organizerId,
  joinedUserId
) {
  return createNotification({
    userId: organizerId,
    senderId: joinedUserId,
    type: 'match_join',
    title: '🎯 Nuovo Giocatore!',
    content: `${playerName} si è unito a "${matchTitle}"`,
    link: `/match/${matchId}`,
    metadata: {
      matchId,
      playerId: joinedUserId,
      playerName,
    },
  });
}

/**
 * Notifica quando un match viene aggiornato
 */
export async function notifyMatchUpdate(matchId, matchTitle, updateMessage, participantIds) {
  const notifications = participantIds.map(userId =>
    createNotification({
      userId,
      type: 'match_update',
      title: '📝 Aggiornamento Partita',
      content: `"${matchTitle}": ${updateMessage}`,
      link: `/match/${matchId}`,
      metadata: { matchId },
    })
  );

  return Promise.all(notifications);
}

/**
 * Notifica quando un match viene cancellato
 */
export async function notifyMatchCancelled(matchId, matchTitle, participantIds) {
  const notifications = participantIds.map(userId =>
    createNotification({
      userId,
      type: 'match_cancelled',
      title: '❌ Partita Cancellata',
      content: `La partita "${matchTitle}" è stata cancellata`,
      link: null,
      metadata: { matchId },
    })
  );

  return Promise.all(notifications);
}

/**
 * Notifica reminder prima di un match
 */
export async function notifyMatchReminder(matchId, matchTitle, hoursLeft, participantIds) {
  const time = hoursLeft > 1 ? `tra ${hoursLeft} ore` : 'tra meno di un\'ora';

  const notifications = participantIds.map(userId =>
    createNotification({
      userId,
      type: 'match_reminder',
      title: '⏰ Ricordati della Partita!',
      content: `"${matchTitle}" inizia ${time}`,
      link: `/match/${matchId}`,
      metadata: { matchId, hoursLeft },
    })
  );

  return Promise.all(notifications);
}

/**
 * Notifica per invito nel team
 */
export async function notifyTeamInvite(invitedUserId, inviterName, teamName, invitedByUserId) {
  return createNotification({
    userId: invitedUserId,
    senderId: invitedByUserId,
    type: 'team_invite',
    title: '👥 Invito al Team',
    content: `${inviterName} ti ha invitato a unirti a "${teamName}"`,
    link: `/find-friends`, // O il link che preferisci
    metadata: { teamName, inviterName },
  });
}

/**
 * Notifica quando un giocatore abbandona un match
 */
export async function notifyMatchLeave(matchId, matchTitle, playerName, organizerId, leftUserId) {
  return createNotification({
    userId: organizerId,
    senderId: leftUserId,
    type: 'match_leave',
    title: '👋 Giocatore in Partenza',
    content: `${playerName} ha abbandonato "${matchTitle}"`,
    link: `/match/${matchId}`,
    metadata: {
      matchId,
      playerId: leftUserId,
      playerName,
    },
  });
}

/**
 * Notifica generica personalizzata
 */
export async function notifyGeneric(userId, type, title, content, link = null, metadata = {}) {
  return createNotification({
    userId,
    type,
    title,
    content,
    link,
    metadata,
  });
}
