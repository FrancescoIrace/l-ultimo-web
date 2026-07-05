import { useState, useEffect } from 'react';
import { Plus, Users, Search, Copy, Check, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAlert } from './AlertComponent';
import { notifyTeamMemberJoined } from '../lib/notificationService';

export default function TeamsManager({ userId }) {
  const [activeTab, setActiveTab] = useState('myTeams');
  const [myTeams, setMyTeams] = useState([]);
  const [allTeams, setAllTeams] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [processingTeam, setProcessingTeam] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);
  const { success, error } = useAlert();

  // Fetch dei team dell'utente dalla tabella team_members
  const fetchMyTeams = async () => {
    try {
      const { data, error: err } = await supabase
        .from('team_members')
        .select(`
          team_id,
          teams (
            id,
            name,
            description,
            logo_url,
            invite_code,
            created_by
          )
        `)
        .eq('user_id', userId);

      if (err) throw err;

      // Filtra squadre duplicate e estrai i dati principali
      const uniqueTeams = data
        ?.map(item => item.teams)
        .filter((v, i, a) => a.findIndex(t => t?.id === v?.id) === i) || [];

      setMyTeams(uniqueTeams);
    } catch (err) {
      error('Errore nel caricamento delle squadre: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch di tutte le squadre con filtro ricerca
  const fetchAllTeams = async (query = '') => {
    try {
      setLoading(true);
      let supabaseQuery = supabase.from('teams').select(`
        id,
        name,
        description,
        logo_url,
        invite_code,
        created_by
      `);

      // Filtro by ricerca - per nome (ilike) o codice invito
      if (query.trim()) {
        supabaseQuery = supabaseQuery.or(
          `name.ilike.%${query}%,invite_code.ilike.%${query}%`
        );
      }

      const { data, error: err } = await supabaseQuery;

      if (err) throw err;
      setAllTeams(data || []);
    } catch (err) {
      error('Errore nella ricerca squadre: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Effetto per caricare i dati iniziali
  useEffect(() => {
    fetchMyTeams();
    fetchAllTeams();
  }, [userId]);

  // Effetto per la ricerca con debounce
  useEffect(() => {
    if (activeTab === 'discover') {
      const timer = setTimeout(() => {
        fetchAllTeams(searchQuery);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, activeTab]);

  // Aggiunge l'utente al team_members
  const handleJoinTeam = async (team) => {
    try {
      setProcessingTeam(team.id);

      // Verifica se l'utente è già nel team
      const { data: existing } = await supabase
        .from('team_members')
        .select('id')
        .eq('team_id', team.id)
        .eq('user_id', userId)
        .single();

      if (existing) {
        error('Sei già membro di questa squadra');
        setProcessingTeam(null);
        return;
      }

      // Inserisci l'utente nel team
      const { error: err } = await supabase
        .from('team_members')
        .insert({
          team_id: team.id,
          user_id: userId,
          joined_at: new Date().toISOString()
        });

      if (err) throw err;

      success('Ti sei unito al team!');
      // Avvisa il creatore del team (in-app + push)
      notifyTeamMemberJoined(team, userId);

      // Ricarica i dati
      fetchMyTeams();
      fetchAllTeams(searchQuery);
    } catch (err) {
      error('Errore nell\'unirsi al team: ' + err.message);
    } finally {
      setProcessingTeam(null);
    }
  };

  // Copia codice invito
  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Render Tab "I miei Gruppi"
  const renderMyTeamsTab = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-4"
    >
      {myTeams.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">👥</div>
          <p className="text-slate-600 text-sm font-medium">
            Non hai ancora squadre. Scoprine una!
          </p>
        </div>
      ) : (
        myTeams.map(team => (
          <motion.div
            key={team.id}
            whileHover={{ scale: 1.02 }}
            className="bg-white rounded-2xl p-5 shadow-md hover:shadow-lg transition-all active:scale-95"
          >
            <div className="flex items-start gap-4">
              {/* Logo o Avatar */}
              <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                {team.logo_url ? (
                  <img
                    src={team.logo_url}
                    alt={team.name}
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <span className="text-2xl">⚽</span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-800">{team.name}</h3>
                <p className="text-xs text-slate-500 mb-3">
                  {team.description || 'Nessuna descrizione'}
                </p>

                {/* Codice Invito - Badge piccolo e discreto */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleCopyCode(team.invite_code)}
                  className="flex items-center gap-2 text-xs bg-slate-100 px-3 py-2 rounded-lg font-semibold text-slate-600 hover:bg-slate-200 transition-all"
                >
                  {copiedCode === team.invite_code ? (
                    <>
                      <Check size={14} />
                      Copiato!
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      {team.invite_code}
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>
        ))
      )}
    </motion.div>
  );

  // Render Tab "Scopri"
  const renderDiscoverTab = () => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-4"
    >
      {/* Barra di ricerca */}
      <div className="sticky top-[58px] z-10 bg-white pb-4">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Cerca per nome o codice..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-100 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Lista risultati */}
      {loading && searchQuery ? (
        <div className="text-center py-8">
          <p className="text-slate-500 text-sm">Ricerca in corso...</p>
        </div>
      ) : allTeams.length === 0 && searchQuery ? (
        <div className="text-center py-8">
          <p className="text-slate-500 text-sm">Nessuna squadra trovata</p>
        </div>
      ) : !searchQuery ? (
        <div className="text-center py-12">
          <p className="text-slate-600 text-sm font-medium">
            Inizia a cercare una squadra...
          </p>
        </div>
      ) : (
        allTeams.map(team => (
          <motion.div
            key={team.id}
            whileHover={{ scale: 1.02 }}
            className="bg-white rounded-2xl p-5 shadow-md hover:shadow-lg transition-all"
          >
            <div className="flex items-start gap-4">
              {/* Logo o Avatar */}
              <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                {team.logo_url ? (
                  <img
                    src={team.logo_url}
                    alt={team.name}
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <span className="text-xl">⚽</span>
                )}
              </div>

              {/* Info e Bottone */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-1">
                    <h3 className="font-bold text-slate-800">{team.name}</h3>
                    {team.is_private && (
                      <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0">
                        <Lock size={12} />
                        Privata
                      </span>
                    )}
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleJoinTeam(team)}
                    disabled={
                      processingTeam === team.id ||
                      myTeams.some(t => t.id === team.id)
                    }
                    className={`px-3 py-2 rounded-lg font-semibold text-xs transition-all active:scale-95 whitespace-nowrap flex-shrink-0 ${
                      myTeams.some(t => t.id === team.id)
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : processingTeam === team.id
                        ? 'bg-blue-300 text-white'
                        : 'bg-blue-600 text-white hover:shadow-lg'
                    }`}
                  >
                    {processingTeam === team.id
                      ? 'Caricamento...'
                      : myTeams.some(t => t.id === team.id)
                      ? 'Iscritto'
                      : 'Unisciti'}
                  </motion.button>
                </div>

                <p className="text-xs text-slate-500 mb-2">
                  {team.description || 'Nessuna descrizione'}
                </p>

                {/* Codice Invito - Badge discreto */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="bg-slate-100 text-slate-600 px-2.5 py-1.5 rounded-lg font-mono font-semibold">
                    {team.invite_code}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        ))
      )}
    </motion.div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="bg-white rounded-3xl overflow-hidden shadow-md"
    >
      {/* Header */}
      <div className="px-4 py-4 flex items-center justify-between border-b border-slate-100">
        <h1 className="text-2xl font-black text-slate-800">⚽ Squadre</h1>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 px-4 py-4 bg-transparent">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setActiveTab('myTeams')}
          className={`flex-1 py-3 px-4 rounded-full font-bold text-sm transition-all ${
            activeTab === 'myTeams'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
        >
          I miei Gruppi
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setActiveTab('discover')}
          className={`flex-1 py-3 px-4 rounded-full font-bold text-sm transition-all ${
            activeTab === 'discover'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
        >
          Scopri
        </motion.button>
      </div>

      {/* Tab Content */}
      <div className="overflow-y-auto px-4 py-4 space-y-4">
        {activeTab === 'myTeams' && renderMyTeamsTab()}
        {activeTab === 'discover' && renderDiscoverTab()}
      </div>
    </motion.div>
  );
}
