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
 * Notifica il centro sportivo quando riceve una richiesta di prenotazione campo
 * @param {string} centerId - ID del profilo del centro (sports_courts.center_id)
 * @param {string} matchTitle - Titolo della partita
 * @param {string} organizerName - Nome dell'organizzatore che invia la richiesta
 * @param {string} matchId - ID della partita
 * @param {string} organizerId - ID dell'organizzatore
 */
export async function notifyReservationRequest(centerId, matchTitle, organizerName, matchId, organizerId) {
  return createNotification({
    userId: centerId,
    senderId: organizerId,
    type: 'reservation_request',
    title: '📥 Nuova Richiesta di Prenotazione',
    content: `${organizerName} ha richiesto il campo per ${matchTitle ? `"${matchTitle}"` : 'una partita'}`,
    link: '/',
    metadata: { matchId, organizerId, organizerName },
  });
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
    content: `${playerName} si è unito ${matchTitle ? `a "${matchTitle}"` : 'alla tua partita'}`,
    link: `/match/${matchId}`,
    metadata: {
      matchId,
      playerId: joinedUserId,
      playerName,
    },
  });
}

/**
 * Notifica l'organizzatore quando la partita raggiunge il numero massimo di giocatori
 */
export async function notifyMatchFull(matchId, matchTitle, organizerId) {
  return createNotification({
    userId: organizerId,
    type: 'match_full',
    title: '✅ Partita al completo!',
    content: `${matchTitle ? `"${matchTitle}"` : 'La tua partita'} ha raggiunto il numero massimo di giocatori`,
    link: `/match/${matchId}`,
    metadata: { matchId },
  });
}

/**
 * Notifica gli altri partecipanti confermati quando qualcuno abbandona una partita piena
 */
export async function notifyMatchSpotFreed(matchId, matchTitle, leaverName, participantIds) {
  const notifications = participantIds.map(userId =>
    createNotification({
      userId,
      type: 'match_leave',
      title: '👋 Un giocatore ha abbandonato',
      content: `${leaverName} ha lasciato ${matchTitle ? `"${matchTitle}"` : 'la partita'}: si è liberato un posto`,
      link: `/match/${matchId}`,
      metadata: { matchId },
    })
  );

  return Promise.all(notifications);
}

/**
 * Notifica chi viene ripescato dalla lista d'attesa perché si è liberato un posto
 */
export async function notifyWaitlistPromoted(matchId, matchTitle, promotedUserId) {
  return createNotification({
    userId: promotedUserId,
    type: 'match_promotion',
    title: '🎉 Sei entrato in partita!',
    content: `Si è liberato un posto in ${matchTitle ? `"${matchTitle}"` : 'una partita'}: sei passato dalla lista d'attesa ai confermati!`,
    link: `/match/${matchId}`,
    metadata: { matchId },
  });
}

/**
 * Notifica l'organizzatore quando un abbandono viene coperto da un ripescaggio
 * automatico dalla lista d'attesa (partita ancora piena, cambio di giocatore)
 */
export async function notifyOrganizerSpotFilled(matchId, matchTitle, leaverName, promotedName, organizerId) {
  return createNotification({
    userId: organizerId,
    type: 'match_leave',
    title: '🔄 Cambio in Partita',
    content: `${leaverName} ha abbandonato ${matchTitle ? `"${matchTitle}"` : 'la tua partita'}: ${promotedName} è entrato al suo posto dalla lista d'attesa`,
    link: `/match/${matchId}`,
    metadata: { matchId },
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
      content: `${matchTitle ? `"${matchTitle}"` : 'La tua partita'}: ${updateMessage}`,
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
      content: `${matchTitle ? `La partita "${matchTitle}"` : 'La partita'} è stata cancellata`,
      link: null,
      metadata: { matchId },
    })
  );

  return Promise.all(notifications);
}

/**
 * Notifica organizzatore/partecipanti quando il centro sportivo CONFERMA la prenotazione
 * @param {string} userId - destinatario (organizzatore o partecipante confermato)
 * @param {string} matchTitle - titolo della partita
 * @param {string} sport - sport della partita
 * @param {string} matchId - ID della partita
 * @param {string} centerId - ID del profilo del centro (mittente)
 */
export async function notifyReservationConfirmed(userId, matchTitle, sport, matchId, centerId) {
  return createNotification({
    userId,
    senderId: centerId,
    type: 'match_update',
    title: '✅ Prenotazione Confermata!',
    content: `La tua richiesta per la partita di ${sport} è stata ACCETTATA!`,
    link: `/match/${matchId}`,
    metadata: { matchId },
  });
}

/**
 * Notifica organizzatore/partecipanti quando il centro RIFIUTA la richiesta
 * o ANNULLA la partita già confermata
 * @param {string} userId - destinatario (organizzatore o partecipante confermato)
 * @param {string} matchTitle - titolo della partita
 * @param {string} reason - motivo fornito dal centro
 * @param {string} matchId - ID della partita
 * @param {string} centerId - ID del profilo del centro (mittente)
 */
export async function notifyReservationRejected(userId, matchTitle, reason, matchId, centerId) {
  return createNotification({
    userId,
    senderId: centerId,
    type: 'match_cancelled',
    title: '❌ Prenotazione Annullata',
    content: `Spiacenti, la partita "${matchTitle}" è stata annullata/rifiutata dal centro sportivo.\nMotivo: ${reason}`,
    link: `/match/${matchId}`,
    metadata: { matchId, reason },
  });
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
 * @param {string} invitedUserId - ID dell'utente invitato
 * @param {string} inviterName - Nome di chi invita
 * @param {string} teamName - Nome della squadra
 * @param {string} teamId - ID della squadra (per il link)
 * @param {string} invitedByUserId - ID di chi invita
 */
export async function notifyTeamInvite(invitedUserId, inviterName, teamName, teamId, invitedByUserId) {
  return createNotification({
    userId: invitedUserId,
    senderId: invitedByUserId,
    type: 'team_invite',
    title: '👥 Invito al Team',
    content: `${inviterName} ti ha invitato a unirti a "${teamName}"`,
    link: `/squadre/${teamId}`,
    metadata: { teamId, teamName, inviterName },
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

/**
 * Notifica quando qualcuno invia una richiesta di amicizia
 * @param {string} targetUserId - ID dell'utente che riceve la richiesta
 * @param {string} senderName - Nome di chi invia la richiesta
 * @param {string} senderId - ID di chi invia la richiesta
 */
export async function notifyFriendRequest(targetUserId, senderName, senderId) {
  return createNotification({
    userId: targetUserId,
    senderId,
    type: 'friend_request',
    title: '👤 Richiesta di amicizia',
    content: `${senderName} vuole aggiungerti come amico`,
    link: '/richieste-amici',
    metadata: { senderId, senderName },
  });
}

/**
 * Notifica quando una richiesta di amicizia viene rifiutata
 * @param {string} targetUserId - ID di chi aveva inviato la richiesta (ora notificato)
 * @param {string} rejecterName - Nome di chi ha rifiutato
 * @param {string} rejecterId - ID di chi ha rifiutato
 */
export async function notifyFriendRejected(targetUserId, rejecterName, rejecterId) {
  return createNotification({
    userId: targetUserId,
    senderId: rejecterId,
    type: 'friend_rejected',
    title: '❌ Richiesta rifiutata',
    content: `${rejecterName} ha rifiutato la tua richiesta di amicizia`,
    link: '/trova-amici',
    metadata: { rejecterId, rejecterName },
    sendPush: false, // notifica solo in-app, non push
  });
}

/**
 * Notifica quando una richiesta di amicizia viene accettata
 * @param {string} targetUserId - ID di chi aveva inviato la richiesta (ora notificato)
 * @param {string} accepterName - Nome di chi ha accettato
 * @param {string} accepterId - ID di chi ha accettato
 */
export async function notifyFriendAccepted(targetUserId, accepterName, accepterId) {
  return createNotification({
    userId: targetUserId,
    senderId: accepterId,
    type: 'friend_accepted',
    title: '🤝 Amicizia accettata!',
    content: `${accepterName} ha accettato la tua richiesta di amicizia`,
    link: `/profile/${accepterId}`,
    metadata: { accepterId, accepterName },
  });
}

/**
 * Notifica un giocatore quando riceve una recensione dopo una partita
 * @param {string} targetUserId - ID di chi riceve la recensione
 * @param {string} reviewerName - Nome di chi ha recensito
 * @param {number} rating - Voto (1-5)
 * @param {string} matchId - ID della partita
 * @param {string} reviewerId - ID di chi ha recensito
 */
export async function notifyReviewReceived(targetUserId, reviewerName, rating, matchId, reviewerId) {
  const stars = '⭐'.repeat(Math.max(1, Math.min(5, Number(rating) || 0)));
  return createNotification({
    userId: targetUserId,
    senderId: reviewerId,
    type: 'review_received',
    title: '⭐ Nuova recensione!',
    content: `${reviewerName} ti ha lasciato una recensione ${stars}`,
    link: `/recensioni/${targetUserId}`,
    metadata: { matchId, rating, reviewerName },
  });
}

/**
 * Notifica il creatore di un team quando un nuovo membro si unisce.
 * Non fa nulla se chi si unisce è il creatore stesso.
 * @param {object} team - Oggetto team { id, name, created_by }
 * @param {string} newMemberId - ID di chi si è appena unito
 */
export async function notifyTeamMemberJoined(team, newMemberId) {
  try {
    if (!team?.created_by || team.created_by === newMemberId) return;

    // Recupera il nome del nuovo membro
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', newMemberId)
      .single();

    const memberName = profile?.username || 'Un giocatore';

    return createNotification({
      userId: team.created_by,
      senderId: newMemberId,
      type: 'team_member_joined',
      title: '🎉 Nuovo membro nella squadra!',
      content: `${memberName} si è unito a "${team.name}"`,
      link: `/squadre/${team.id}`,
      metadata: { teamId: team.id, teamName: team.name, memberName },
    });
  } catch (err) {
    console.error('Errore nella notifica nuovo membro team:', err);
  }
}
