import { useState, useEffect } from 'react';
import { Plus, Users, Search, Copy, Check, ArrowLeft, ChevronRight, Lock, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAlert } from '../components/AlertComponent';
import { useNavigate } from 'react-router-dom';

export default function TeamsPage({ session }) {
    const navigate = useNavigate();
    const userId = session?.user?.id;

    // States per tab navigation
    const [activeTab, setActiveTab] = useState('myTeams'); // myTeams | discover | create
    const [myTeams, setMyTeams] = useState([]);
    const [allTeams, setAllTeams] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [processingTeam, setProcessingTeam] = useState(null);
    const [copiedCode, setCopiedCode] = useState(null);
    const [tooltipActive, setTooltipActive] = useState(false);
    const [countCreatedTeams, setCountCreatedTeams] = useState(0);

    // States per create team form
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        logo_url: '',
        is_private: false,
        password: ''
    });
    const [creatingTeam, setCreatingTeam] = useState(false);

    // States per modale password squadre private
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [selectedTeamForPassword, setSelectedTeamForPassword] = useState(null);
    const [passwordInput, setPasswordInput] = useState('');
    const [verifyingPassword, setVerifyingPassword] = useState(false);

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
        created_by,
        is_private,
        password
      `);

            // Filtro by ricerca - per nome (ilike) o codice invito
            if (query.trim()) {
                supabaseQuery = supabaseQuery.or(
                    `name.ilike.%${query}%,invite_code.ilike.%${query}%`
                );
            }

            const { data, error: err } = await supabaseQuery;

            if (err) throw err;
            //Count delle squadre create dall'utente (per limitare a 3 per il momento)
            const createdCount = data.filter(team => team.created_by === userId).length;
            setCountCreatedTeams(createdCount);
            console.log('Squadre create dall\'utente:', createdCount);
            setAllTeams(data || []);
        } catch (err) {
            error('Errore nella ricerca squadre: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Effetto per caricare i dati iniziali
    useEffect(() => {
        if (userId) {
            fetchMyTeams();
            fetchAllTeams();
        }
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

    // Aggiunge l'utente al team_members (con controllo password se privata)
    const handleJoinTeam = async (team) => {
        // Se la squadra è privata, apri modale password
        if (team.is_private) {
            setSelectedTeamForPassword(team);
            setShowPasswordModal(true);
            setPasswordInput('');
            return;
        }

        // Se pubblica, procedi direttamente
        await performJoinTeam(team);
    };

    // Verifica password e unisce al team
    const handleVerifyPassword = async () => {
        // console.log('Verifying password for team:', selectedTeamForPassword.password);
        // console.log('Entered password:', passwordInput);
        if (!passwordInput.trim()) {
            error('Inserisci la password');
            return;
        }

        if (passwordInput !== selectedTeamForPassword.password) {
            error('❌ Password errata!');
            setPasswordInput('');
            return;
        }

        setVerifyingPassword(true);
        try {
            await performJoinTeam(selectedTeamForPassword);
            setShowPasswordModal(false);
            setPasswordInput('');
            setSelectedTeamForPassword(null);
        } catch (err) {
            error('Errore nell\'unirsi al team: ' + err.message);
        } finally {
            setVerifyingPassword(false);
        }
    };

    // Logica effettiva di join (senza controllo password)
    const performJoinTeam = async (team) => {
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

    // Crea nuovo team
    const handleCreateTeam = async (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            error('Il nome della squadra è obbligatorio');
            return;
        }

        // Valida password se privata
        if (formData.is_private && !formData.password.trim()) {
            error('La password è obbligatoria per squadre private');
            return;
        }

        if (formData.is_private && formData.password.length > 6) {
            error('La password non può superare 6 caratteri');
            return;
        }

        try {
            setCreatingTeam(true);

            // Genera codice invito univoco (10 caratteri alfanumerici)
            const generateInviteCode = () => {
                return Math.random().toString(36).substring(2, 10).toUpperCase();
            };

            const inviteCode = generateInviteCode();

            // Crea team
            const { data: newTeam, error: createErr } = await supabase
                .from('teams')
                .insert({
                    name: formData.name,
                    description: formData.description || '',
                    logo_url: formData.logo_url || '',
                    invite_code: inviteCode,
                    is_private: formData.is_private,
                    password: formData.is_private ? formData.password : null,
                    created_by: userId,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (createErr) throw createErr;

            // Aggiungi creatore al team
            const { error: memberErr } = await supabase
                .from('team_members')
                .insert({
                    team_id: newTeam.id,
                    user_id: userId,
                    joined_at: new Date().toISOString()
                });

            if (memberErr) throw memberErr;

            const privacyLabel = formData.is_private ? '🔒 Privata' : '🌐 Pubblica';
            success(`Squadra "${formData.name}" (${privacyLabel}) creata! Codice: ${inviteCode}`);

            // Reset form
            setFormData({
                name: '',
                description: '',
                logo_url: '',
                is_private: false,
                password: ''
            });

            // Ricarica team
            fetchMyTeams();
            fetchAllTeams();

            // Torna al tab "I miei Gruppi"
            setActiveTab('myTeams');
        } catch (err) {
            error('Errore nella creazione della squadra: ' + err.message);
        } finally {
            setCreatingTeam(false);
        }
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
                        Non hai ancora squadre. Scoprine una o creane una!
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
            <div className="sticky top-0 z-3 pb-4">
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
                                        className={`px-3 py-2 rounded-lg font-semibold text-xs transition-all active:scale-95 whitespace-nowrap flex-shrink-0 ${myTeams.some(t => t.id === team.id)
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

    // Render Tab "Crea Squadra"
    const renderCreateTeamTab = () => (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
        >
            <form onSubmit={handleCreateTeam} className="space-y-5">
                {/* Info squadre create dall'utente */}
                <div className={`border rounded-xl shadow p-3 text-xl text-md font-semibold ${countCreatedTeams >= 3 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gradient-to-r from-blue-200 to-yellow-300 border-blue-300 text-blue-800'}`}>
                    <div className="flex items-center justify-between">
                        <p>
                            Squadre create: <span className="font-black">{countCreatedTeams}</span>/3
                        </p>
                        <div className="relative cursor-help">
                            <button
                                type="button"
                                onClick={() => setTooltipActive(!tooltipActive)}
                                className="p-1 hover:opacity-70 transition-opacity"
                            >
                                <Info size={22} className="inline" />
                            </button>
                            {tooltipActive && (
                                <div className="absolute bottom-full right-0 mb-2 bg-slate-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10 animate-fade-in">
                                    Puoi avere max 3 squadre create contemporaneamente
                                </div>
                            )}
                        </div>
                    </div>
                    {countCreatedTeams >= 3 && (
                        <p className="mt-1">❌ Hai raggiunto il limite. Rimuovi una squadra per creare una nuova.</p>
                    )}
                </div>
                {/* Nome Squadra */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                        Nome Squadra *
                    </label>
                    <input
                        type="text"
                        placeholder="Es: Calcetto Domenica"
                        maxLength={30}
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        required
                    />
                    <p className="text-xs text-slate-400 mt-1">
                        {formData.name.length}/30 caratteri
                    </p>
                </div>

                {/* Descrizione */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                        Descrizione
                    </label>
                    <textarea
                        placeholder="Es: Partite settimanali di calcetto tra amici"
                        maxLength={200}
                        rows={3}
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                        {formData.description.length}/200 caratteri
                    </p>
                </div>

                {/* URL Logo */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                        URL Logo (Opzionale)
                    </label>
                    <input
                        type="url"
                        placeholder="https://example.com/logo.jpg"
                        value={formData.logo_url}
                        onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    {formData.logo_url && (
                        <div className="mt-3 w-20 h-20 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 flex items-center justify-center">
                            <img
                                src={formData.logo_url}
                                alt="preview"
                                className="w-full h-full object-cover"
                                onError={() => {
                                    error('Impossibile caricare l\'immagine');
                                }}
                            />
                        </div>
                    )}
                </div>

                {/* Privacy Toggle */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                        Tipo di Squadra
                    </label>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, is_private: false, password: '' })}
                            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${!formData.is_private
                                ? 'bg-blue-500 text-white shadow-lg'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            🌐 Pubblica
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, is_private: true })}
                            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${formData.is_private
                                ? 'bg-red-500 text-white shadow-lg'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            🔒 Privata
                        </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                        {formData.is_private
                            ? 'Solo con password possono unirsi'
                            : 'Chiunque può unirsi tramite codice invito'}
                    </p>
                </div>

                {/* Password Field - Solo se privata */}
                {formData.is_private && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-2"
                    >
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                            Password Squadra * (max 6 caratteri)
                        </label>
                        <input
                            type="text"
                            placeholder="Es: ABC123"
                            maxLength={6}
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value.toUpperCase() })}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-sm font-mono font-bold"
                        />
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-slate-400">
                                Caratteri: {formData.password.length}/6
                            </p>
                            {formData.password && (
                                <span className="text-xs text-green-600 font-bold">
                                    ✓ Password impostata
                                </span>
                            )}
                        </div>
                    </motion.div>
                )}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <p className="text-xs text-blue-700 font-semibold">
                        💡 Un codice invito univoco verrà generato automaticamente per condividere la tua squadra!
                    </p>
                </div>

                {/* Bottoni */}
                <div className="flex gap-3 pt-4">
                    <button
                        type="button"
                        onClick={() => {
                            setFormData({ name: '', description: '', logo_url: '', is_private: false, password: '' });
                            setActiveTab('myTeams');
                        }}
                        className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all active:scale-95"
                    >
                        Annulla
                    </button>
                    <button
                        type="submit"
                        disabled={
                            creatingTeam ||
                            !formData.name.trim() ||
                            (formData.is_private && !formData.password.trim())
                        }
                        className="flex-1 px-4 py-4 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 flex items-center justify-center gap-2"
                    >
                        {creatingTeam ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Creazione...
                            </>
                        ) : (
                            <>
                                <Plus size={18} />
                                Crea Squadra
                            </>
                        )}
                    </button>
                </div>
            </form>
        </motion.div>
    );

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white max-w-md mx-auto p-4">
            {/* TASTO INDIETRO */}
            <button
                onClick={() => navigate("/partite")}
                type="button"
                className="mb-4 flex items-center gap-1.5 text-xs font-bold uppercase text-slate-400 hover:text-slate-600 transition"
            >
                <ChevronRight size={14} className="rotate-180" />
                Indietro
            </button>
            {/* TITOLO COMPONENTE */}
            <h1 className="text-4xl font-black text-slate-800 text-center">Squadre</h1>
            <p className="text-sm text-slate-400 text-center mt-2">
                Gestisci le tue squadre o unisciti a quelle degli amici!
            </p>

            {/* Main Content */}
            <div className="max-w-md mx-auto mt-3 pb-20">
                {/* Tab Navigation */}
                <div className="flex gap-2 mb-6 bg-transparent sticky top-16 z-2">
                    {[
                        { id: 'myTeams', label: 'I miei Gruppi', icon: '👥' },
                        { id: 'discover', label: 'Scopri', icon: '🔍' },
                        { id: 'create', label: 'Crea', icon: '➕' }
                    ].map(tab => (
                        <motion.button
                            key={tab.id}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 py-3 px-4 rounded-full font-bold text-sm transition-all ${activeTab === tab.id
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                }`}
                        >
                            <span className="mr-2">{tab.icon}</span>
                            {tab.label}
                        </motion.button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="space-y-4">
                    {activeTab === 'myTeams' && renderMyTeamsTab()}
                    {activeTab === 'discover' && renderDiscoverTab()}
                    {activeTab === 'create' && renderCreateTeamTab()}
                </div>
            </div>

            {/* Password Modal per Squadre Private */}
            {showPasswordModal && selectedTeamForPassword && (
                <div className="fixed inset-0 bg-black/50 flex items-end z-50">
                    <motion.div
                        initial={{ y: 300, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 300, opacity: 0 }}
                        className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-6 space-y-4"
                    >
                        {/* Header */}
                        <div>
                            <h2 className="text-2xl font-black text-slate-800">🔒 Squadra Privata</h2>
                            <p className="text-sm text-slate-500 mt-2">
                                La squadra <strong>"{selectedTeamForPassword.name}"</strong> è protetta da password
                            </p>
                        </div>

                        {/* Password Input */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                                Inserisci Password (max 6 caratteri)
                            </label>
                            <input
                                type="text"
                                placeholder="Es: ABC123"
                                maxLength={6}
                                value={passwordInput}
                                onChange={(e) => setPasswordInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleVerifyPassword()}
                                className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center font-bold text-lg tracking-widest"
                                autoFocus
                            />
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-3 pt-4">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowPasswordModal(false);
                                    setPasswordInput('');
                                    setSelectedTeamForPassword(null);
                                }}
                                className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all active:scale-95"
                            >
                                Annulla
                            </button>
                            <button
                                type="button"
                                onClick={handleVerifyPassword}
                                disabled={verifyingPassword || !passwordInput.trim()}
                                className="flex-1 px-4 py-3 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl font-bold text-sm hover:shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {verifyingPassword ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Verifica...
                                    </>
                                ) : (
                                    <>🔓 Sblocca</>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
