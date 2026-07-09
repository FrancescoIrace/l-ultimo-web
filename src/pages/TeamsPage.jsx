import { useState, useEffect } from 'react';
import { Plus, Users, Search, Copy, Check, ArrowLeft, Lock, Globe, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAlert } from '../components/AlertComponent';
import { useNavigate } from 'react-router-dom';
import { notifyTeamMemberJoined } from '../lib/notificationService';
import Loader from '../components/Loader';

// Card squadra riutilizzata da "Le mie Squadre" ed "Esplora": altezza fissa, info minime
function TeamCard({ team, onClick, trailing }) {
    const meta = [
        team.is_private ? 'Privata' : 'Pubblica',
        team.citta,
        team.sport?.[0]
    ].filter(Boolean).join(' · ');

    return (
        <motion.div
            whileHover={{ scale: 1.01 }}
            onClick={onClick}
            className="flex items-center gap-3 h-20 bg-white border border-gray-100 rounded-2xl px-4 shadow-sm hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
        >
            {/* Avatar */}
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden bg-blue-50">
                {team.logo_url ? (
                    <img src={team.logo_url} alt={team.name} className="w-full h-full object-cover" />
                ) : (
                    <span className="text-lg text-blue-600 font-bold">
                        {team.name ? team.name.charAt(0).toUpperCase() : 'T'}
                    </span>
                )}
            </div>

            {/* Nome + info essenziali */}
            <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-800 text-sm truncate">{team.name}</h3>
                <p className="text-xs text-slate-400 truncate mt-0.5 flex items-center gap-1">
                    {team.is_private ? <Lock size={11} className="flex-shrink-0" /> : <Globe size={11} className="flex-shrink-0" />}
                    <span className="truncate">{meta}</span>
                </p>
            </div>

            {/* Azione/indicatore a destra */}
            <div className="flex-shrink-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                {trailing}
            </div>
        </motion.div>
    );
}

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
        password: '',
        sport: [],
        citta: '',
        primary_color: '#3b82f6',
        secondary_color: '#1e40af'
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
            created_by,
            is_private,
            sport,
            citta,
            primary_color,
            secondary_color
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
        sport,
        citta,
        primary_color,
        secondary_color
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

    // Verifica password (lato server, via RPC) e unisce al team
    const handleVerifyPassword = async () => {
        if (!passwordInput.trim()) {
            error('Inserisci la password');
            return;
        }

        setVerifyingPassword(true);
        try {
            const { data: isCorrect, error: verifyErr } = await supabase.rpc('verify_team_password', {
                p_team_id: selectedTeamForPassword.id,
                p_password: passwordInput
            });

            if (verifyErr) throw verifyErr;

            if (!isCorrect) {
                error('❌ Password errata!');
                setPasswordInput('');
                return;
            }

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
                    sport: formData.sport || [],
                    citta: formData.citta || '',
                    primary_color: formData.primary_color || '#3b82f6',
                    secondary_color: formData.secondary_color || '#1e40af',
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
                password: '',
                sport: [],
                citta: '',
                primary_color: '#3b82f6',
                secondary_color: '#1e40af'
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
                    <Users size={40} className="mx-auto mb-4 text-slate-300" />
                    <p className="text-slate-600 text-sm font-medium">
                        Non hai ancora squadre. Scoprine una o creane una!
                    </p>
                </div>
            ) : (
                myTeams.map(team => (
                    <TeamCard
                        key={team.id}
                        team={team}
                        onClick={() => navigate(`/squadre/${team.id}`)}
                        trailing={
                            <button
                                onClick={() => handleCopyCode(team.invite_code)}
                                className="flex items-center gap-1 text-[10px] font-mono bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-all"
                            >
                                {copiedCode === team.invite_code ? (
                                    <Check size={12} className="text-green-600" />
                                ) : (
                                    <Copy size={12} />
                                )}
                                {team.invite_code}
                            </button>
                        }
                    />
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
                allTeams.map(team => {
                    const alreadyMember = myTeams.some(t => t.id === team.id);
                    return (
                        <TeamCard
                            key={team.id}
                            team={team}
                            onClick={() => navigate(`/squadre/${team.id}`)}
                            trailing={
                                <button
                                    onClick={() => handleJoinTeam(team)}
                                    disabled={processingTeam === team.id || alreadyMember}
                                    className={`px-3 py-1.5 rounded-lg font-semibold text-[11px] transition-all active:scale-95 whitespace-nowrap ${alreadyMember
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                        : processingTeam === team.id
                                            ? 'bg-blue-300 text-white'
                                            : 'bg-blue-600 text-white hover:bg-blue-700'
                                        }`}
                                >
                                    {processingTeam === team.id
                                        ? '...'
                                        : alreadyMember
                                            ? 'Iscritto'
                                            : 'Unisciti'}
                                </button>
                            }
                        />
                    );
                })
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
                <div className={`border rounded-xl shadow-md p-3 text-sm ${countCreatedTeams >= 3 ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gradient-to-r from-blue-500 to-purple-600 border-blue-300 text-white'}`}>
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
                                <Info size={20} className="inline" />
                            </button>
                            {tooltipActive && (
                                <div className="absolute bottom-full right-0 mb-2 bg-slate-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10 animate-fade-in">
                                    Puoi avere max 3 squadre create contemporaneamente
                                </div>
                            )}
                        </div>
                    </div>
                    {countCreatedTeams >= 3 && (
                        <p className="mt-2 text-xs">❌ Hai raggiunto il limite. Rimuovi una squadra per creare una nuova.</p>
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
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
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
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    {formData.logo_url && (
                        <div className="mt-3 w-20 h-20 bg-white rounded-lg overflow-hidden border border-slate-200 flex items-center justify-center">
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



                {/* Città */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                        Città 📍
                    </label>
                    <input
                        type="text"
                        placeholder="Es: Napoli"
                        value={formData.citta}
                        onChange={(e) => setFormData({ ...formData, citta: e.target.value })}
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                </div>

                {/* Sport - Mini Card Grid */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-3">
                        Sport (max 5)
                    </label>
                    <div className="grid grid-cols-4 gap-1 mb-3">
                        {[
                            { name: 'Calcetto', icon: '⚽' },
                            { name: 'Calcio a 7', icon: '⚽' },
                            { name: 'Calcio a 11', icon: '⚽' },
                            { name: 'Basket', icon: '🏀' },
                            { name: 'Volley', icon: '🏐' },
                            { name: 'Tennis', icon: '🎾' },
                            { name: 'Palestra', icon: '💪' },
                            { name: 'Corsa', icon: '🏃‍♂️' }
                        ].map(({ name: sport, icon }) => {
                            const isSelected = formData.sport.includes(sport);
                            const isDisabled = formData.sport.length >= 5 && !isSelected;
                            return (
                                <motion.button
                                    key={sport}
                                    type="button"
                                    whileHover={!isDisabled ? { scale: 1.02 } : {}}
                                    whileTap={!isDisabled ? { scale: 0.98 } : {}}
                                    onClick={() => {
                                        if (isSelected) {
                                            setFormData({ ...formData, sport: formData.sport.filter(s => s !== sport) });
                                        } else if (formData.sport.length < 5) {
                                            setFormData({ ...formData, sport: [...formData.sport, sport] });
                                        }
                                    }}
                                    disabled={isDisabled}
                                    className={`p-3 rounded-xl border-2 transition-all font-semibold text-sm flex flex-col items-center justify-center gap-2 ${isSelected
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-lg'
                                            : isDisabled
                                                ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed opacity-50'
                                                : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-blue-50'
                                        }`}
                                >
                                    <span className="text-lg">{icon}</span>
                                    <span className="text-xs text-center leading-tight">{sport}</span>
                                </motion.button>
                            );
                        })}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                        <p className="text-slate-400">
                            Selezionati: <span className="font-bold text-slate-600">{formData.sport.length}/5</span>
                        </p>
                        {formData.sport.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                                {formData.sport.map(sport => (
                                    <span key={sport} className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-semibold">
                                        {sport}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>


                {/* Colori Squadra */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-3">
                        🎨 Colori Squadra
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col items-start gap-2">
                            <div className="flex items-center gap-2 w-full">
                                <label className="block text-xs font-bold text-slate-600">Colore Primario</label>
                                <input
                                    type="color"
                                    value={formData.primary_color}
                                    onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                                    className="w-12 h-10 border-2 border-slate-200 rounded-lg cursor-pointer"
                                />
                            </div>
                            <span className="text-xs text-slate-400 font-mono">{formData.primary_color}</span>
                        </div>
                        <div className="flex flex-col items-start gap-2">
                            <div className="flex items-center gap-2 w-full">
                                <label className="block text-xs font-bold text-slate-600">Colore Secondario</label>
                                <input
                                    type="color"
                                    value={formData.secondary_color}
                                    onChange={(e) => setFormData({ ...formData, secondary_color: e.target.value })}
                                    className="w-12 h-10 border-2 border-slate-200 rounded-lg cursor-pointer"
                                />
                            </div>
                            <span className="text-xs text-slate-400 font-mono">{formData.secondary_color}</span>
                        </div>
                    </div>
                    <div className="mt-3 flex gap-2 h-12">
                        <div
                            className="flex-1 rounded-lg border-2 border-slate-200"
                            style={{ backgroundColor: formData.primary_color }}
                        />
                        <div
                            className="flex-1 rounded-lg border-2 border-slate-200"
                            style={{ backgroundColor: formData.secondary_color }}
                        />
                    </div>
                </div>

                {/* Privacy Toggle */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                        PRIVACY SQUADRA
                    </label>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, is_private: false, password: '' })}
                            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${!formData.is_private
                                ? 'bg-blue-500 text-white shadow-lg'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            🌐 Pubblica
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormData({ ...formData, is_private: true })}
                            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${formData.is_private
                                ? 'bg-red-500 text-white shadow-lg'
                                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-200'
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
                            className="w-full p-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-sm font-mono font-bold"
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
                            setFormData({ name: '', description: '', logo_url: '', is_private: false, password: '', sport: [], citta: '', primary_color: '#3b82f6', secondary_color: '#1e40af' });
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
                            (formData.is_private && !formData.password.trim()) || countCreatedTeams >= 3
                        }
                        className="flex-1 px-4 py-4 bg-blue-600 text-white rounded-2xl font-bold text-sm hover:shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 flex items-center justify-center gap-2"
                    >
                        {creatingTeam ? (
                            <>
                                <Loader variant="inline" size={16} color="white" />
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
        <div className="h-[calc(100vh-58px)] bg-gradient-to-b from-blue-50 to-white flex flex-col overflow-hidden">
            {/* Blocco fisso: torna indietro, titolo, tabs e ricerca */}
            <div className="flex-shrink-0">
                <div className="max-w-md mx-auto p-4 pb-0">
                    {/* TASTO INDIETRO */}
                    <button
                        onClick={() => navigate("/")}
                        type="button"
                        className="mb-4 flex items-center gap-1.5 text-xs font-bold uppercase text-slate-400 hover:text-slate-600 transition"
                    >
                        <ArrowLeft size={14} />
                        Indietro
                    </button>
                    {/* TITOLO COMPONENTE */}
                    <h1 className="text-4xl font-black text-slate-800 text-center">Squadre</h1>
                    <p className="text-sm text-slate-400 text-center mt-2">
                        Gestisci le tue squadre o unisciti a quelle degli amici!
                    </p>
                </div>

                {/* Tab Navigation + (se Esplora) barra di ricerca, un unico blocco fisso a piena larghezza */}
                <div className="bg-white/80 backdrop-blur-md border-b border-slate-100 py-3 mt-3">
                    <div className="max-w-md mx-auto px-4 space-y-3">
                        <div className="flex gap-3">
                            {[
                                { id: 'myTeams', label: 'Le mie Squadre', icon: Users },
                                { id: 'discover', label: 'Esplora', icon: Search },
                                { id: 'create', label: 'Nuovo Team', icon: Plus }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex-1 flex flex-col items-center justify-center h-16 rounded-2xl shadow-md active:scale-95 transition-transform cursor-pointer ${activeTab === tab.id
                                        ? 'bg-blue-600'
                                        : 'bg-white border border-gray-100'
                                        }`}
                                >
                                    <tab.icon size={18} className={activeTab === tab.id ? 'text-white' : 'text-blue-600'} />
                                    <span className={`text-[11px] mt-1 ${activeTab === tab.id ? 'text-white font-bold' : 'text-slate-800 font-semibold'}`}>
                                        {tab.label}
                                    </span>
                                </button>
                            ))}
                        </div>

                        {activeTab === 'discover' && (
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
                                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
                        )}
                    </div>
                </div>
            </div>

            {/* Lista scrollabile: riempie esattamente lo spazio tra tabs e fondo schermo */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-md mx-auto p-4 space-y-4 pb-20">
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
                                        <Loader variant="inline" size={16} color="white" />
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
