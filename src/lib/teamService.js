/**
 * Team Management Utilities - Supabase
 * Funzioni per gestire squadre, team_members e operazioni correlate
 * 
 * Schema Teams Reale:
 * - id UUID
 * - name TEXT
 * - description TEXT
 * - logo_url TEXT
 * - invite_code VARCHAR(10) UNIQUE
 * - created_at TIMESTAMP
 * - created_by UUID REFERENCES auth.users(id)
 */

import { supabase } from './supabase';

/**
 * Recupera tutti i team dell'utente corrente
 * @param {string} userId - ID dell'utente
 * @returns {Promise<Array>} Lista di team
 */
export async function getUserTeams(userId) {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .select(`
        team_id,
        joined_at,
        teams (
          id,
          name,
          description,
          logo_url,
          invite_code,
          created_by,
          created_at
        )
      `)
      .eq('user_id', userId);

    if (error) throw error;

    // Filtra duplicati e ritorna array di team
    return data
      ?.map(item => item.teams)
      .filter((v, i, a) => a.findIndex(t => t?.id === v?.id) === i) || [];
  } catch (err) {
    console.error('Errore nel recupero team utente:', err);
    return [];
  }
}

/**
 * Cerca team per nome o codice invito
 * @param {string} searchQuery - Query di ricerca
 * @returns {Promise<Array>} Lista di team trovati
 */
export async function searchTeams(searchQuery = '') {
  try {
    let query = supabase.from('teams').select(`
      id,
      name,
      description,
      logo_url,
      invite_code,
      created_by,
      created_at
    `);

    if (searchQuery.trim()) {
      // Ricerca per nome (ilike) o codice invito
      query = query.or(
        `name.ilike.%${searchQuery}%,invite_code.ilike.%${searchQuery}%`
      );
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Errore nella ricerca team:', err);
    return [];
  }
}

/**
 * Ottiene il numero di membri di un team
 * @param {string} teamId - ID del team
 * @returns {Promise<number>} Numero di membri
 */
export async function getTeamMemberCount(teamId) {
  try {
    const { count, error } = await supabase
      .from('team_members')
      .select('*', { count: 'exact' })
      .eq('team_id', teamId);

    if (error) throw error;
    return count || 0;
  } catch (err) {
    console.error('Errore nel conteggio membri:', err);
    return 0;
  }
}

/**
 * Verifica se l'utente è già membro di un team
 * @param {string} teamId - ID del team
 * @param {string} userId - ID dell'utente
 * @returns {Promise<boolean>} True se è membro
 */
export async function isUserTeamMember(teamId, userId) {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return !!data;
  } catch (err) {
    console.error('Errore nella verifica appartenenza:', err);
    return false;
  }
}

/**
 * Aggiunge un utente a un team
 * @param {string} teamId - ID del team
 * @param {string} userId - ID dell'utente
 * @returns {Promise<object>} Risultato dell'inserimento
 */
export async function addUserToTeam(teamId, userId) {
  try {
    // Verifica se è già membro
    const isMember = await isUserTeamMember(teamId, userId);
    if (isMember) {
      throw new Error('Utente già membro di questo team');
    }

    const { data, error } = await supabase
      .from('team_members')
      .insert({
        team_id: teamId,
        user_id: userId,
        joined_at: new Date().toISOString()
      })
      .select();

    if (error) throw error;
    return data?.[0] || null;
  } catch (err) {
    console.error('Errore nell\'aggiunta utente al team:', err);
    throw err;
  }
}

/**
 * Rimuove un utente da un team
 * @param {string} teamId - ID del team
 * @param {string} userId - ID dell'utente
 * @returns {Promise<boolean>} True se rimosso con successo
 */
export async function removeUserFromTeam(teamId, userId) {
  try {
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Errore nella rimozione utente dal team:', err);
    throw err;
  }
}

/**
 * Crea un nuovo team
 * @param {object} teamData - Dati del team {name, description, logo_url}
 * @param {string} userId - ID dell'utente creatore
 * @returns {Promise<object>} Team creato
 */
export async function createTeam(teamData, userId) {
  try {
    // Genera un codice invito univoco di 10 caratteri
    const generateInviteCode = () => {
      return Math.random().toString(36).substring(2, 10).toUpperCase();
    };

    const { data, error } = await supabase
      .from('teams')
      .insert({
        name: teamData.name,
        description: teamData.description || '',
        logo_url: teamData.logo_url || null,
        invite_code: generateInviteCode(),
        created_by: userId,
        created_at: new Date().toISOString()
      })
      .select();

    if (error) throw error;

    const newTeam = data?.[0];

    // Aggiunge il creatore come membro
    if (newTeam) {
      await addUserToTeam(newTeam.id, userId);
    }

    return newTeam || null;
  } catch (err) {
    console.error('Errore nella creazione team:', err);
    throw err;
  }
}

/**
 * Recupera i dettagli di un team
 * @param {string} teamId - ID del team
 * @returns {Promise<object>} Dettagli del team
 */
export async function getTeamDetails(teamId) {
  try {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();

    if (error) throw error;
    return data || null;
  } catch (err) {
    console.error('Errore nel recupero team:', err);
    return null;
  }
}

/**
 * Recupera i dettagli di un team by invite_code
 * @param {string} inviteCode - Codice invito (es: GALA26)
 * @returns {Promise<object>} Dettagli del team
 */
export async function getTeamByInviteCode(inviteCode) {
  try {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('invite_code', inviteCode.toUpperCase())
      .single();

    if (error) throw error;
    return data || null;
  } catch (err) {
    console.error('Errore nel recupero team by invite_code:', err);
    return null;
  }
}

/**
 * Recupera i membri di un team
 * @param {string} teamId - ID del team
 * @returns {Promise<Array>} Lista dei membri
 */
export async function getTeamMembers(teamId) {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .select(`
        user_id,
        joined_at,
        profiles (
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('team_id', teamId);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Errore nel recupero membri team:', err);
    return [];
  }
}

/**
 * Iscrive l'utente a un team
 * @param {string} teamId - ID del team
 * @param {string} userId - ID dell'utente
 * @returns {Promise<object>} Risultato
 */
export async function joinTeam(teamId, userId) {
  try {
    const team = await getTeamDetails(teamId);
    if (!team) {
      throw new Error('Team non trovato');
    }

    // Aggiunge l'utente al team
    return await addUserToTeam(teamId, userId);
  } catch (err) {
    console.error('Errore nell\'iscrizione al team:', err);
    throw err;
  }
}

/**
 * Iscrive utente a team by invite_code
 * @param {string} inviteCode - Codice invito
 * @param {string} userId - ID dell'utente
 * @returns {Promise<object>} Team a cui l'utente si è iscritto
 */
export async function joinTeamByInviteCode(inviteCode, userId) {
  try {
    const team = await getTeamByInviteCode(inviteCode);
    if (!team) {
      throw new Error('Codice invito non valido');
    }

    await joinTeam(team.id, userId);
    return team;
  } catch (err) {
    console.error('Errore nell\'iscrizione tramite codice:', err);
    throw err;
  }
}

/**
 * Aggiorna un team
 * @param {string} teamId - ID del team
 * @param {object} updates - Campi da aggiornare {name, description, logo_url}
 * @returns {Promise<object>} Team aggiornato
 */
export async function updateTeam(teamId, updates) {
  try {
    const { data, error } = await supabase
      .from('teams')
      .update(updates)
      .eq('id', teamId)
      .select();

    if (error) throw error;
    return data?.[0] || null;
  } catch (err) {
    console.error('Errore nell\'aggiornamento team:', err);
    throw err;
  }
}

/**
 * Rigenerano il codice invito di un team
 * @param {string} teamId - ID del team
 * @returns {Promise<string>} Nuovo codice invito
 */
export async function regenerateInviteCode(teamId) {
  try {
    const generateNewCode = () => {
      return Math.random().toString(36).substring(2, 10).toUpperCase();
    };

    const { data, error } = await supabase
      .from('teams')
      .update({ invite_code: generateNewCode() })
      .eq('id', teamId)
      .select();

    if (error) throw error;
    return data?.[0]?.invite_code || null;
  } catch (err) {
    console.error('Errore nella rigenerazione codice:', err);
    throw err;
  }
}

/**
 * Elimina un team (solo il creatore)
 * @param {string} teamId - ID del team
 * @param {string} userId - ID dell'utente
 * @returns {Promise<boolean>} True se eliminato
 */
export async function deleteTeam(teamId, userId) {
  try {
    // Verifica che l'utente sia il creatore
    const team = await getTeamDetails(teamId);
    if (team?.created_by !== userId) {
      throw new Error('Solo il creatore può eliminare il team');
    }

    // Rimuove tutti i membri
    await supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId);

    // Elimina il team
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', teamId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Errore nell\'eliminazione team:', err);
    throw err;
  }
}

/**
 * Iscrive un numero di utenti a un team (batch)
 * @param {string} teamId - ID del team
 * @param {Array<string>} userIds - Array di ID utenti
 * @returns {Promise<object>} Risultato
 */
export async function addManyUsersToTeam(teamId, userIds) {
  try {
    const membersData = userIds.map(userId => ({
      team_id: teamId,
      user_id: userId,
      joined_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('team_members')
      .insert(membersData);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Errore nell\'aggiunta batch utenti:', err);
    throw err;
  }
}


/**
 * Ottiene il numero di membri di un team
 * @param {string} teamId - ID del team
 * @returns {Promise<number>} Numero di membri
 */
export async function getTeamMemberCount(teamId) {
  try {
    const { count, error } = await supabase
      .from('team_members')
      .select('*', { count: 'exact' })
      .eq('team_id', teamId);

    if (error) throw error;
    return count || 0;
  } catch (err) {
    console.error('Errore nel conteggio membri:', err);
    return 0;
  }
}

/**
 * Verifica se l'utente è già membro di un team
 * @param {string} teamId - ID del team
 * @param {string} userId - ID dell'utente
 * @returns {Promise<boolean>} True se è membro
 */
export async function isUserTeamMember(teamId, userId) {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .select('id')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return !!data;
  } catch (err) {
    console.error('Errore nella verifica appartenenza:', err);
    return false;
  }
}

/**
 * Aggiunge un utente a un team
 * @param {string} teamId - ID del team
 * @param {string} userId - ID dell'utente
 * @returns {Promise<object>} Risultato dell'inserimento
 */
export async function addUserToTeam(teamId, userId) {
  try {
    // Verifica se è già membro
    const isMember = await isUserTeamMember(teamId, userId);
    if (isMember) {
      throw new Error('Utente già membro di questo team');
    }

    const { data, error } = await supabase
      .from('team_members')
      .insert({
        team_id: teamId,
        user_id: userId,
        joined_at: new Date().toISOString()
      })
      .select();

    if (error) throw error;
    return data?.[0] || null;
  } catch (err) {
    console.error('Errore nell\'aggiunta utente al team:', err);
    throw err;
  }
}

/**
 * Rimuove un utente da un team
 * @param {string} teamId - ID del team
 * @param {string} userId - ID dell'utente
 * @returns {Promise<boolean>} True se rimosso con successo
 */
export async function removeUserFromTeam(teamId, userId) {
  try {
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Errore nella rimozione utente dal team:', err);
    throw err;
  }
}

/**
 * Verifica la password di un team privato (richiede RPC in Supabase)
 * @param {string} teamId - ID del team
 * @param {string} password - Password da verificare
 * @returns {Promise<boolean>} True se password corretta
 */
export async function verifyTeamPassword(teamId, password) {
  try {
    // Nota: Richiede che sia stata creata una RPC in Supabase
    // Esempio RPC:
    // CREATE OR REPLACE FUNCTION verify_team_password(
    //   p_team_id UUID,
    //   p_password TEXT
    // ) RETURNS BOOLEAN AS $$
    // BEGIN
    //   RETURN EXISTS (
    //     SELECT 1 FROM teams
    //     WHERE id = p_team_id
    //     AND password = crypt(p_password, password)
    //   );
    // END;
    // $$ LANGUAGE plpgsql;

    const { data, error } = await supabase.rpc(
      'verify_team_password',
      {
        p_team_id: teamId,
        p_password: password
      }
    );

    if (error) {
      console.error('Errore verifica password:', error);
      return false;
    }

    return data === true;
  } catch (err) {
    console.error('Errore:', err);
    return false;
  }
}

/**
 * Crea un nuovo team
 * @param {object} teamData - Dati del team {name, description, is_private, password}
 * @param {string} userId - ID dell'utente creatore
 * @returns {Promise<object>} Team creato
 */
export async function createTeam(teamData, userId) {
  try {
    const { data, error } = await supabase
      .from('teams')
      .insert({
        name: teamData.name,
        description: teamData.description || '',
        is_private: teamData.is_private || false,
        password: teamData.password || null,
        created_by: userId,
        created_at: new Date().toISOString()
      })
      .select();

    if (error) throw error;

    const newTeam = data?.[0];

    // Aggiunge il creatore come membro
    if (newTeam) {
      await addUserToTeam(newTeam.id, userId);
    }

    return newTeam || null;
  } catch (err) {
    console.error('Errore nella creazione team:', err);
    throw err;
  }
}

/**
 * Recupera i dettagli di un team
 * @param {string} teamId - ID del team
 * @returns {Promise<object>} Dettagli del team
 */
export async function getTeamDetails(teamId) {
  try {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();

    if (error) throw error;
    return data || null;
  } catch (err) {
    console.error('Errore nel recupero team:', err);
    return null;
  }
}

/**
 * Recupera i membri di un team
 * @param {string} teamId - ID del team
 * @returns {Promise<Array>} Lista dei membri
 */
export async function getTeamMembers(teamId) {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .select(`
        user_id,
        joined_at,
        profiles (
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('team_id', teamId);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Errore nel recupero membri team:', err);
    return [];
  }
}

/**
 * Iscrive l'utente a un team (con gestione password per team privati)
 * @param {string} teamId - ID del team
 * @param {string} userId - ID dell'utente
 * @param {string|null} password - Password (solo per team privati)
 * @returns {Promise<object>} Risultato
 */
export async function joinTeam(teamId, userId, password = null) {
  try {
    const team = await getTeamDetails(teamId);
    if (!team) {
      throw new Error('Team non trovato');
    }

    // Se il team è privato, verifica la password
    if (team.is_private && password) {
      const isCorrect = await verifyTeamPassword(teamId, password);
      if (!isCorrect) {
        throw new Error('Password non valida');
      }
    }

    // Aggiunge l'utente al team
    return await addUserToTeam(teamId, userId);
  } catch (err) {
    console.error('Errore nell\'iscrizione al team:', err);
    throw err;
  }
}

/**
 * Aggiorna un team
 * @param {string} teamId - ID del team
 * @param {object} updates - Campi da aggiornare
 * @returns {Promise<object>} Team aggiornato
 */
export async function updateTeam(teamId, updates) {
  try {
    const { data, error } = await supabase
      .from('teams')
      .update(updates)
      .eq('id', teamId)
      .select();

    if (error) throw error;
    return data?.[0] || null;
  } catch (err) {
    console.error('Errore nell\'aggiornamento team:', err);
    throw err;
  }
}

/**
 * Elimina un team (solo il creatore)
 * @param {string} teamId - ID del team
 * @param {string} userId - ID dell'utente
 * @returns {Promise<boolean>} True se eliminato
 */
export async function deleteTeam(teamId, userId) {
  try {
    // Verifica che l'utente sia il creatore
    const team = await getTeamDetails(teamId);
    if (team?.created_by !== userId) {
      throw new Error('Solo il creatore può eliminare il team');
    }

    // Rimuove tutti i membri
    await supabase
      .from('team_members')
      .delete()
      .eq('team_id', teamId);

    // Elimina il team
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', teamId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Errore nell\'eliminazione team:', err);
    throw err;
  }
}

/**
 * Iscrive un numero di utenti a un team (batch)
 * @param {string} teamId - ID del team
 * @param {Array<string>} userIds - Array di ID utenti
 * @returns {Promise<object>} Risultato
 */
export async function addManyUsersToTeam(teamId, userIds) {
  try {
    const membersData = userIds.map(userId => ({
      team_id: teamId,
      user_id: userId,
      joined_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('team_members')
      .insert(membersData);

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Errore nell\'aggiunta batch utenti:', err);
    throw err;
  }
}
