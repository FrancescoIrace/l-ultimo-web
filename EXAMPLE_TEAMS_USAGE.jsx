/**
 * EXAMPLE_TEAMS_USAGE.jsx
 * 
 * Esempi di utilizzo avanzato del componente TeamsManager
 * e delle funzioni teamService per gestire squadre
 * 
 * Copia e adatta gli snippet che ti servono al tuo progetto.
 */

// ============================================
// 1. UTILIZZO BASE NEL PWADashboard
// ============================================

import TeamsManager from '../components/TeamsManager';
import { useState } from 'react';

function PWADashboardExample() {
  const [showTeamsManager, setShowTeamsManager] = useState(false);
  const user = { id: 'user123' }; // Dall'auth

  return (
    <>
      <button onClick={() => setShowTeamsManager(true)}>
        Apri Squadre
      </button>

      {showTeamsManager && (
        <TeamsManager
          userId={user.id}
          onClose={() => setShowTeamsManager(false)}
        />
      )}
    </>
  );
}

// ============================================
// 2. PAGE DI DETTAGLIO TEAM
// ============================================

import { useParams } from 'react-router-dom';
import { getTeamDetails, getTeamMembers } from '../lib/teamService';

function TeamDetailPage() {
  const { teamId } = useParams();
  const [team, setTeam] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTeamData() {
      const teamData = await getTeamDetails(teamId);
      const membersData = await getTeamMembers(teamId);
      setTeam(teamData);
      setMembers(membersData);
      setLoading(false);
    }
    loadTeamData();
  }, [teamId]);

  if (loading) return <div>Caricamento...</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">{team?.name}</h1>
      <p className="text-gray-600">{team?.description}</p>
      
      {team?.is_private && (
        <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full">
          🔒 Privata
        </span>
      )}

      <h2 className="text-xl font-bold mt-6">Membri ({members.length})</h2>
      <div className="space-y-2">
        {members.map(member => (
          <div key={member.user_id} className="bg-gray-50 p-3 rounded-lg">
            <p className="font-bold">{member.profiles?.username}</p>
            <p className="text-xs text-gray-500">
              Iscritto da: {new Date(member.joined_at).toLocaleDateString('it-IT')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// 3. FORM DI CREAZIONE TEAM
// ============================================

import { createTeam } from '../lib/teamService';
import { useAlert } from '../components/AlertComponent';

function CreateTeamForm() {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_private: false,
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const { success, error } = useAlert();
  const user = { id: 'user123' };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const newTeam = await createTeam(formData, user.id);
      success(`Squadra "${newTeam.name}" creata con successo!`);
      setFormData({ name: '', description: '', is_private: false, password: '' });
      // Naviga al dettaglio del team
      navigate(`/team/${newTeam.id}`);
    } catch (err) {
      error('Errore: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <label className="block text-sm font-bold mb-2">Nome Squadra</label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Es: Calcetto Domenica"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-bold mb-2">Descrizione (opzionale)</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Descrivi la tua squadra..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
        />
      </div>

      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={formData.is_private}
            onChange={(e) => setFormData({ ...formData, is_private: e.target.checked })}
            className="w-5 h-5 cursor-pointer"
          />
          <span className="font-bold">Squadra Privata (richiede password)</span>
        </label>
      </div>

      {formData.is_private && (
        <div>
          <label className="block text-sm font-bold mb-2">Password</label>
          <input
            type="password"
            required
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder="Inserisci password"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Creazione...' : 'Crea Squadra'}
      </button>
    </form>
  );
}

// ============================================
// 4. LISTA DELLE MIE SQUADRE (ALTERNATIVA)
// ============================================

import { getUserTeams, removeUserFromTeam } from '../lib/teamService';
import { motion } from 'framer-motion';

function MyTeamsList() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const user = { id: 'user123' };
  const { success, error } = useAlert();

  useEffect(() => {
    async function loadTeams() {
      const userTeams = await getUserTeams(user.id);
      setTeams(userTeams);
      setLoading(false);
    }
    loadTeams();
  }, [user.id]);

  const handleLeaveTeam = async (teamId) => {
    if (!confirm('Sei sicuro di voler lasciare questa squadra?')) return;

    try {
      await removeUserFromTeam(teamId, user.id);
      setTeams(teams.filter(t => t.id !== teamId));
      success('Hai lasciato la squadra');
    } catch (err) {
      error('Errore: ' + err.message);
    }
  };

  if (loading) return <div>Caricamento...</div>;

  return (
    <div className="space-y-3">
      {teams.map(team => (
        <motion.div
          key={team.id}
          whileHover={{ scale: 1.02 }}
          className="bg-white border-2 border-yellow-200 rounded-2xl p-4 flex items-center justify-between"
        >
          <div>
            <h3 className="font-bold text-lg">{team.name}</h3>
            <p className="text-sm text-gray-600">{team.description}</p>
          </div>
          <button
            onClick={() => handleLeaveTeam(team.id)}
            className="px-4 py-2 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600"
          >
            Lascia
          </button>
        </motion.div>
      ))}
    </div>
  );
}

// ============================================
// 5. RICERCA TEAMS CON DEBOUNCE
// ============================================

import { searchTeams } from '../lib/teamService';
import { Search } from 'lucide-react';

function SearchTeams() {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim()) {
        setLoading(true);
        const teams = await searchTeams(searchQuery);
        setResults(teams);
        setLoading(false);
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Cerca squadre..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
        />
      </div>

      {loading && <p className="text-gray-500">Ricerca...</p>}

      <div className="space-y-2">
        {results.map(team => (
          <div
            key={team.id}
            className="bg-gray-50 p-4 rounded-lg flex items-center justify-between cursor-pointer hover:bg-gray-100"
            onClick={() => navigate(`/team/${team.id}`)}
          >
            <div>
              <p className="font-bold">{team.name}</p>
              {team.is_private && <span className="text-xs text-red-600">🔒 Privata</span>}
            </div>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
              Scopri
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// 6. AGGIUNGERE UTENTI A TEAM (BATCH)
// ============================================

import { addManyUsersToTeam } from '../lib/teamService';

async function inviteUsersToTeam() {
  const teamId = 'team123';
  const userIds = ['user1', 'user2', 'user3'];

  try {
    await addManyUsersToTeam(teamId, userIds);
    console.log('Utenti aggiunti al team');
  } catch (err) {
    console.error('Errore:', err);
  }
}

// ============================================
// 7. MONITORAGGIO REAL-TIME TEAM
// ============================================

function TeamRealtimeListener({ teamId }) {
  const [memberCount, setMemberCount] = useState(0);

  useEffect(() => {
    // Sottoscrizione ai cambiamenti in team_members
    const channel = supabase
      .channel(`team_members_${teamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'team_members',
          filter: `team_id=eq.${teamId}`
        },
        async () => {
          const count = await getTeamMemberCount(teamId);
          setMemberCount(count);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [teamId]);

  return (
    <div className="bg-blue-50 p-4 rounded-lg">
      <p className="font-bold">👥 Membri del Team: {memberCount}</p>
    </div>
  );
}

// ============================================
// 8. INTEGRAZIONE CON PROFILO UTENTE
// ============================================

function UserProfileWithTeams({ userId }) {
  const [userTeams, setUserTeams] = useState([]);

  useEffect(() => {
    async function loadUserTeams() {
      const teams = await getUserTeams(userId);
      setUserTeams(teams);
    }
    loadUserTeams();
  }, [userId]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Squadre di questo Utente</h2>
      <div className="grid grid-cols-2 gap-2">
        {userTeams.map(team => (
          <div
            key={team.id}
            className="bg-yellow-50 border-2 border-yellow-200 p-3 rounded-lg text-center cursor-pointer hover:bg-yellow-100"
            onClick={() => navigate(`/team/${team.id}`)}
          >
            <p className="font-bold text-sm">{team.name}</p>
            {team.is_private && <p className="text-xs text-red-600">🔒</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// 9. VALIDAZIONE PASSWORD TEAM
// ============================================

async function handlePrivateTeamJoin(teamId, password) {
  try {
    // Verifica password
    const isValid = await verifyTeamPassword(teamId, password);
    
    if (!isValid) {
      return { success: false, error: 'Password non valida' };
    }

    // Se corretta, aggiungi l'utente
    const user = { id: 'user123' };
    await addUserToTeam(teamId, user.id);
    
    return { success: true, message: 'Unito al team!' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ============================================
// 10. HOOK CUSTOM - useTeams
// ============================================

function useTeams(userId) {
  const [myTeams, setMyTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTeams() {
      const teams = await getUserTeams(userId);
      setMyTeams(teams);
      setLoading(false);
    }
    loadTeams();
  }, [userId]);

  const joinTeam = async (teamId, password = null) => {
    await joinTeam(teamId, userId, password);
    const teams = await getUserTeams(userId);
    setMyTeams(teams);
  };

  const leaveTeam = async (teamId) => {
    await removeUserFromTeam(teamId, userId);
    setMyTeams(myTeams.filter(t => t.id !== teamId));
  };

  return { myTeams, loading, joinTeam, leaveTeam };
}

// Utilizzo dell'hook:
function MyTeamsWithHook() {
  const user = { id: 'user123' };
  const { myTeams, loading, joinTeam, leaveTeam } = useTeams(user.id);

  return (
    <div>
      {myTeams.map(team => (
        <div key={team.id}>
          <h3>{team.name}</h3>
          <button onClick={() => leaveTeam(team.id)}>Lascia</button>
        </div>
      ))}
    </div>
  );
}

export default MyTeamsList;
