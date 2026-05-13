import { useState, useEffect } from 'react';
import { Plus, Users, Search, Copy, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAlert } from './AlertComponent';

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
            className="bg-white border-2 border-yellow-200 rounded-2xl p-4 cursor-pointer hover:shadow-lg transition-all active:scale-95"
          >
            <div className="flex items-start gap-4">
              {/* Logo o Avatar */}
              <div className="w-16 h-16 bg-yellow-100 rounded-xl flex items-center justify-center flex-shrink-0">
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
                <p className="text-xs text-slate-500 mb-2">
                  {team.description || 'Nessuna descrizione'}
                </p>

                {/* Codice Invito */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleCopyCode(team.invite_code)}
                  className="flex items-center gap-2 text-xs bg-yellow-50 border border-yellow-200 px-3 py-1.5 rounded-lg font-bold text-yellow-700 hover:bg-yellow-100 transition-all"
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
      <div className="sticky top-0 z-10 bg-white pb-4">
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
            className="bg-white border-2 border-slate-200 rounded-2xl p-4 hover:shadow-lg transition-all"
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
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className="font-bold text-slate-800">{team.name}</h3>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleJoinTeam(team)}
                    disabled={
                      processingTeam === team.id ||
                      myTeams.some(t => t.id === team.id)
                    }
                    className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all active:scale-95 whitespace-nowrap ${
                      myTeams.some(t => t.id === team.id)
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : processingTeam === team.id
                        ? 'bg-blue-300 text-white'
                        : 'bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:shadow-lg shadow-blue-200'
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

                {/* Codice Invito e Info */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="bg-slate-50 text-slate-600 px-2 py-1 rounded font-mono font-bold border border-slate-200">
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
      className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-lg"
    >
      {/* Header */}
      <div className="border-b border-slate-200 px-4 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-800">⚽ Squadre</h1>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200">
        <motion.button
          whileHover={{ backgroundColor: 'rgba(229, 231, 235, 0.5)' }}
          onClick={() => setActiveTab('myTeams')}
          className={`flex-1 py-4 font-bold transition-all relative text-sm ${
            activeTab === 'myTeams'
              ? 'text-yellow-500 bg-yellow-50'
              : 'text-slate-600'
          }`}
        >
          I miei Gruppi
          {activeTab === 'myTeams' && (
            <motion.div
              layoutId="tabIndicator"
              className="absolute bottom-0 left-0 right-0 h-1 bg-yellow-500"
            />
          )}
        </motion.button>

        <motion.button
          whileHover={{ backgroundColor: 'rgba(229, 231, 235, 0.5)' }}
          onClick={() => setActiveTab('discover')}
          className={`flex-1 py-4 font-bold transition-all relative text-sm ${
            activeTab === 'discover'
              ? 'text-blue-500 bg-blue-50'
              : 'text-slate-600'
          }`}
        >
          Scopri
          {activeTab === 'discover' && (
            <motion.div
              layoutId="tabIndicator"
              className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500"
            />
          )}
        </motion.button>
      </div>

      {/* Tab Content */}
      <div className="overflow-y-auto px-4 py-4 max-h-96">
        {activeTab === 'myTeams' && renderMyTeamsTab()}
        {activeTab === 'discover' && renderDiscoverTab()}
      </div>
    </motion.div>
  );
}
