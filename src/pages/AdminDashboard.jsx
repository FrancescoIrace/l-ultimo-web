import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAlert } from '../components/AlertComponent';
import { ChevronLeft, ShieldAlert, Trash2, Ban, ShieldCheck, Search, MessageCircle, Building2, Plus, Eye, EyeOff, X, Pencil, LayoutGrid, ChevronDown, ChevronUp, ChevronsUpDown, Sun, Moon } from 'lucide-react';
import Loader from '../components/Loader';
import LocationPicker from '../components/LocationPicker';
import GestisciCampi from './business/GestisciCampi';

const PAGE_SIZE = 30;

const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString('it-IT') : '—';

// Username/location/is_banned vivono su profiles: ordinabili lato server su tutta
// la lista. created_at/last_sign_in_at arrivano da auth.users via edge function
// (vedi enrichUsersWithAuthInfo) e non sono una colonna di profiles, quindi si
// possono ordinare solo lato client, sui soli utenti gia' caricati in pagina.
const SERVER_SORT_COLUMNS = { username: 'username', full_name: 'full_name', location: 'location', is_banned: 'is_banned' };
const CLIENT_SORT_COLUMNS = ['created_at', 'last_sign_in_at'];

function SortableTh({ column, label, sortBy, sortDir, onSort }) {
    const isActive = sortBy === column;
    return (
        <th className="text-left px-4 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest">
            <button
                type="button"
                onClick={() => onSort(column)}
                className={`flex items-center gap-1 transition-colors ${isActive ? 'text-slate-700 dark:text-slate-100' : 'hover:text-slate-600 dark:hover:text-slate-300'}`}
            >
                {label}
                {isActive ? (
                    sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                ) : (
                    <ChevronsUpDown size={12} className="text-slate-300" />
                )}
            </button>
        </th>
    );
}

export default function AdminDashboard({ session }) {
    const navigate = useNavigate();
    const { success, error: showError, confirmDangerous } = useAlert();

    // null = ancora in verifica, true/false = esito noto. La fonte di verita' e'
    // profiles.is_admin (la stessa controllata da RLS ed edge function), non l'email:
    // prima qui si controllava un indirizzo hardcoded, che avrebbe negato l'accesso a
    // qualunque secondo admin promosso via is_admin=true sul proprio profilo.
    const [isAdmin, setIsAdmin] = useState(null);

    // Modalita' notte solo per questa pagina (non segue il tema di sistema),
    // persistita per riaprire il pannello sempre con la preferenza scelta.
    const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('adminDarkMode') === 'true');

    useEffect(() => {
        localStorage.setItem('adminDarkMode', String(isDarkMode));
    }, [isDarkMode]);

    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('reports'); // 'reports' | 'users' | 'centers'

    const [reports, setReports] = useState([]);
    const [reportActionId, setReportActionId] = useState(null);
    const [chatReports, setChatReports] = useState([]);
    const [chatReportActionId, setChatReportActionId] = useState(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'banned'
    const [sortBy, setSortBy] = useState('username');
    const [sortDir, setSortDir] = useState('asc');
    const [users, setUsers] = useState([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [usersPage, setUsersPage] = useState(0);
    const [usersTotalCount, setUsersTotalCount] = useState(0);
    const [banTarget, setBanTarget] = useState(null); // profilo in fase di ban
    const [banReason, setBanReason] = useState('');
    const [banActionLoading, setBanActionLoading] = useState(false);

    const [centers, setCenters] = useState([]);
    const [togglingCenterId, setTogglingCenterId] = useState(null);
    const [expandedCourtsCenterId, setExpandedCourtsCenterId] = useState(null);
    const [isCreateCenterOpen, setIsCreateCenterOpen] = useState(false);
    const [editingCenter, setEditingCenter] = useState(null); // null = crea, altrimenti modifica
    const [creatingCenter, setCreatingCenter] = useState(false);
    const emptyCenterForm = { email: '', password: '', username: '', full_name: '', business_address: '', lat: null, lng: null, cellulare: '' };
    const [centerForm, setCenterForm] = useState(emptyCenterForm);

    useEffect(() => {
        async function checkAdmin() {
            if (!session?.user?.id) {
                setIsAdmin(false);
                return;
            }

            const { data, error } = await supabase
                .from('profiles')
                .select('is_admin')
                .eq('id', session.user.id)
                .single();

            if (error) {
                console.error('Errore verifica permessi admin:', error.message);
                setIsAdmin(false);
                return;
            }

            setIsAdmin(!!data?.is_admin);
        }

        checkAdmin();
    }, [session]);

    useEffect(() => {
        async function fetchReports() {
            setLoading(true);
            const { data, error } = await supabase
                .from('review_reports')
                .select(`
                    id, reason, status, created_at,
                    reporter:reporter_id ( id, username ),
                    review:review_id (
                        id, comment, rating,
                        reviewer:reviewer_id ( id, username ),
                        target:target_id ( id, username )
                    )
                `)
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Errore fetch segnalazioni:', error.message);
            } else {
                setReports(data || []);
            }
            setLoading(false);
        }

        if (isAdmin) fetchReports();
    }, [isAdmin]);

    useEffect(() => {
        async function fetchChatReports() {
            const { data, error } = await supabase
                .from('match_message_reports')
                .select(`
                    id, reason, status, created_at,
                    reporter:reporter_id ( id, username ),
                    reported:reported_user_id ( id, username, is_banned ),
                    match:match_id ( id, title )
                `)
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Errore fetch segnalazioni chat:', error.message);
            } else {
                setChatReports(data || []);
            }
        }

        if (isAdmin) fetchChatReports();
    }, [isAdmin]);

    useEffect(() => {
        async function fetchCenters() {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, username, full_name, business_address, lat, lng, cellulare, is_visible')
                .eq('role', 'center')
                .order('full_name', { ascending: true });

            if (error) {
                console.error('Errore fetch centri:', error.message);
            } else {
                setCenters(data || []);
            }
        }

        if (isAdmin) fetchCenters();
    }, [isAdmin]);

    // Lista utenti paginata (30 per pagina): caricata di default (prima non
    // mostrava nulla finche' non si cercava), ricaricata da capo quando cambiano
    // filtro/ordinamento/pagina. Il conteggio esatto (count: 'exact') serve sia per
    // il numero totale accanto al titolo sia per calcolare le pagine disponibili.
    const fetchUsers = async () => {
        setUsersLoading(true);

        const serverSortColumn = SERVER_SORT_COLUMNS[sortBy] || 'username';
        let query = supabase
            .from('profiles')
            .select('id, username, full_name, avatar_url, location, is_banned, ban_reason', { count: 'exact' })
            .eq('role', 'player')
            .order(serverSortColumn, { ascending: sortDir === 'asc' })
            .range(usersPage * PAGE_SIZE, usersPage * PAGE_SIZE + PAGE_SIZE - 1);

        if (statusFilter === 'active') query = query.eq('is_banned', false);
        if (statusFilter === 'banned') query = query.eq('is_banned', true);
        if (searchQuery.trim()) {
            // La virgola spezzerebbe la sintassi di .or() di PostgREST (separatore
            // tra condizioni): la togliamo dal termine di ricerca, non serve comunque
            // per cercare per username/nome/luogo.
            const term = searchQuery.trim().replace(/,/g, '');
            query = query.or(`username.ilike.%${term}%,full_name.ilike.%${term}%,location.ilike.%${term}%`);
        }

        const { data, error, count } = await query;
        setUsersLoading(false);

        if (error) {
            console.error('Errore fetch utenti:', error.message);
            return;
        }

        setUsersTotalCount(count ?? 0);
        setUsers(data || []);
        enrichUsersWithAuthInfo(data || []);
    };

    // Data iscrizione e ultimo accesso vivono solo in auth.users, non su profiles:
    // servono una chiamata alla edge function (service role) per ogni pagina di
    // utenti appena caricata, poi vengono fuse nello state esistente.
    const enrichUsersWithAuthInfo = async (userList) => {
        if (userList.length === 0) return;

        const { data, error } = await supabase.functions.invoke('admin-list-user-auth-info', {
            body: { userIds: userList.map(u => u.id) },
        });

        if (error) {
            console.error('Errore recupero data iscrizione/ultimo accesso:', error.message);
            return;
        }

        const authInfo = data?.users || {};
        setUsers(prev => prev.map(u => authInfo[u.id] ? { ...u, ...authInfo[u.id] } : u));
    };

    useEffect(() => {
        if (isAdmin) fetchUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAdmin, statusFilter, sortBy, sortDir, usersPage]);

    // Se la colonna attiva e' ordinabile solo lato client (created_at/last_sign_in_at,
    // che non vivono su profiles), riordina qui i soli utenti gia' caricati; per le
    // altre colonne l'ordine arriva gia' corretto dalla query sopra.
    const displayedUsers = useMemo(() => {
        if (!CLIENT_SORT_COLUMNS.includes(sortBy)) return users;

        return [...users].sort((a, b) => {
            const aTime = a[sortBy] ? new Date(a[sortBy]).getTime() : 0;
            const bTime = b[sortBy] ? new Date(b[sortBy]).getTime() : 0;
            return sortDir === 'asc' ? aTime - bTime : bTime - aTime;
        });
    }, [users, sortBy, sortDir]);

    const handleSort = (column) => {
        setUsersPage(0);
        if (sortBy === column) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortDir('asc');
        }
    };

    const handleStatusFilterChange = (value) => {
        setStatusFilter(value);
        setUsersPage(0);
    };

    const handleDismiss = async (report) => {
        setReportActionId(report.id);
        const { error } = await supabase
            .from('review_reports')
            .update({ status: 'dismissed' })
            .eq('id', report.id);
        setReportActionId(null);

        if (error) {
            showError('Impossibile aggiornare la segnalazione');
            return;
        }
        setReports(prev => prev.filter(r => r.id !== report.id));
        success('Segnalazione ignorata');
    };

    const handleRemoveReview = async (report) => {
        if (!report.review) {
            showError('La recensione segnalata non esiste più');
            return;
        }
        const confirmed = await confirmDangerous('Eliminare definitivamente questa recensione?');
        if (!confirmed) return;

        setReportActionId(report.id);
        const { error: deleteError } = await supabase
            .from('reviews')
            .delete()
            .eq('id', report.review.id);

        if (deleteError) {
            setReportActionId(null);
            showError('Impossibile eliminare la recensione');
            return;
        }

        await supabase
            .from('review_reports')
            .update({ status: 'resolved' })
            .eq('id', report.id);

        setReportActionId(null);
        setReports(prev => prev.filter(r => r.id !== report.id));
        success('Recensione rimossa');
    };

    const handleDismissChatReport = async (report) => {
        setChatReportActionId(report.id);
        const { error } = await supabase
            .from('match_message_reports')
            .update({ status: 'dismissed' })
            .eq('id', report.id);
        setChatReportActionId(null);

        if (error) {
            showError('Impossibile aggiornare la segnalazione');
            return;
        }
        setChatReports(prev => prev.filter(r => r.id !== report.id));
        success('Segnalazione ignorata');
    };

    const handleBanFromChatReport = async (report) => {
        if (!report.reported) {
            showError('L\'utente segnalato non esiste più');
            return;
        }
        const confirmed = await confirmDangerous(`Bannare ${report.reported.username}? Non potrà più accedere all'app.`);
        if (!confirmed) return;

        setChatReportActionId(report.id);
        const { error } = await supabase.functions.invoke('admin-ban-user', {
            body: { targetUserId: report.reported.id, action: 'ban', reason: `Segnalazione chat: ${report.reason}` },
        });

        if (error) {
            setChatReportActionId(null);
            showError('Impossibile bannare l\'utente');
            return;
        }

        await supabase
            .from('match_message_reports')
            .update({ status: 'resolved' })
            .eq('id', report.id);

        setChatReportActionId(null);
        setChatReports(prev => prev.filter(r => r.id !== report.id));
        success(`${report.reported.username} è stato bannato`);
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        if (usersPage === 0) {
            // Gia' in prima pagina: il cambio pagina non scatterebbe l'effect, va
            // rilanciata la fetch a mano con la query di ricerca aggiornata.
            fetchUsers();
        } else {
            setUsersPage(0);
        }
    };

    const openBanModal = (profile) => {
        setBanReason('');
        setBanTarget(profile);
    };

    const handleConfirmBan = async () => {
        if (!banTarget) return;
        setBanActionLoading(true);
        const { error } = await supabase.functions.invoke('admin-ban-user', {
            body: { targetUserId: banTarget.id, action: 'ban', reason: banReason.trim() || null },
        });
        setBanActionLoading(false);

        if (error) {
            showError('Impossibile bannare l\'utente');
            return;
        }

        setUsers(prev => prev.map(u => u.id === banTarget.id ? { ...u, is_banned: true, ban_reason: banReason.trim() || null } : u));
        success(`${banTarget.username} è stato bannato`);
        setBanTarget(null);
    };

    const handleUnban = async (profile) => {
        const confirmed = await confirmDangerous(`Sbannare ${profile.username}? Potrà accedere di nuovo all'app.`);
        if (!confirmed) return;

        setBanActionLoading(true);
        const { error } = await supabase.functions.invoke('admin-ban-user', {
            body: { targetUserId: profile.id, action: 'unban' },
        });
        setBanActionLoading(false);

        if (error) {
            showError('Impossibile sbannare l\'utente');
            return;
        }

        setUsers(prev => prev.map(u => u.id === profile.id ? { ...u, is_banned: false, ban_reason: null } : u));
        success(`${profile.username} è stato sbannato`);
    };

    const openCreateCenterModal = () => {
        setEditingCenter(null);
        setCenterForm(emptyCenterForm);
        setIsCreateCenterOpen(true);
    };

    const openEditCenterModal = (center) => {
        setEditingCenter(center);
        setCenterForm({
            email: '',
            password: '',
            username: center.username || '',
            full_name: center.full_name || '',
            business_address: center.business_address || '',
            lat: center.lat ?? null,
            lng: center.lng ?? null,
            cellulare: center.cellulare || '',
        });
        setIsCreateCenterOpen(true);
    };

    const closeCenterModal = () => {
        setIsCreateCenterOpen(false);
        setEditingCenter(null);
    };

    const handleCreateCenter = async () => {
        if (!centerForm.email.trim() || !centerForm.password.trim() || !centerForm.username.trim() || !centerForm.full_name.trim()) {
            showError('Email, password, username e nome del centro sono obbligatori');
            return;
        }
        if (centerForm.password.trim().length < 6) {
            showError('La password deve avere almeno 6 caratteri');
            return;
        }

        setCreatingCenter(true);
        const { data, error } = await supabase.functions.invoke('admin-create-center', {
            body: {
                email: centerForm.email.trim(),
                password: centerForm.password.trim(),
                username: centerForm.username.trim(),
                full_name: centerForm.full_name.trim(),
                business_address: centerForm.business_address || null,
                lat: centerForm.lat,
                lng: centerForm.lng,
                cellulare: centerForm.cellulare.trim() || null,
            },
        });
        setCreatingCenter(false);

        if (error) {
            showError('Impossibile creare il centro: ' + error.message);
            return;
        }

        setCenters(prev => [...prev, {
            id: data.centerId,
            username: centerForm.username.trim(),
            full_name: centerForm.full_name.trim(),
            business_address: centerForm.business_address || null,
            lat: centerForm.lat,
            lng: centerForm.lng,
            cellulare: centerForm.cellulare.trim() || null,
            is_visible: true,
        }].sort((a, b) => a.full_name.localeCompare(b.full_name)));

        success(`Centro "${centerForm.full_name}" creato con successo!`);
        closeCenterModal();
        setCenterForm(emptyCenterForm);
    };

    const handleUpdateCenter = async () => {
        if (!centerForm.full_name.trim()) {
            showError('Il nome del centro è obbligatorio');
            return;
        }

        setCreatingCenter(true);
        const updatedFields = {
            full_name: centerForm.full_name.trim(),
            business_address: centerForm.business_address || null,
            lat: centerForm.lat,
            lng: centerForm.lng,
            cellulare: centerForm.cellulare.trim() || null,
        };
        const { error } = await supabase
            .from('profiles')
            .update(updatedFields)
            .eq('id', editingCenter.id);
        setCreatingCenter(false);

        if (error) {
            showError('Impossibile aggiornare il centro');
            return;
        }

        setCenters(prev => prev.map(c => c.id === editingCenter.id ? { ...c, ...updatedFields } : c)
            .sort((a, b) => a.full_name.localeCompare(b.full_name)));

        success(`Centro "${centerForm.full_name}" aggiornato`);
        closeCenterModal();
        setCenterForm(emptyCenterForm);
    };

    const handleSubmitCenterForm = () => {
        if (editingCenter) return handleUpdateCenter();
        return handleCreateCenter();
    };

    const handleToggleVisibility = async (center) => {
        setTogglingCenterId(center.id);
        const newValue = !center.is_visible;
        const { error } = await supabase
            .from('profiles')
            .update({ is_visible: newValue })
            .eq('id', center.id);
        setTogglingCenterId(null);

        if (error) {
            showError('Impossibile aggiornare la visibilità');
            return;
        }

        setCenters(prev => prev.map(c => c.id === center.id ? { ...c, is_visible: newValue } : c));
    };

    if (isAdmin === null) {
        return (
            <Loader variant="page" />
        );
    }

    if (!isAdmin) {
        return (
            <div className="max-w-md mx-auto p-10 text-center">
                <ShieldAlert size={48} className="mx-auto text-red-400 mb-4" />
                <p className="font-black uppercase text-slate-600">Accesso negato</p>
                <button
                    onClick={() => navigate('/')}
                    className="mt-6 text-xs font-bold uppercase text-blue-600 dark:text-blue-400 hover:underline"
                >
                    Torna alla home
                </button>
            </div>
        );
    }

    if (loading) {
        return (
            <Loader variant="page" />
        );
    }

    const TABS = [
        { key: 'reports', label: 'Segnalazioni', count: reports.length + chatReports.length },
        { key: 'users', label: 'Utenti', count: null },
        { key: 'centers', label: 'Centri', count: centers.length },
    ];

    return (
        <main className={`w-full p-6 pb-24 bg-slate-50 min-h-screen dark:bg-slate-900 ${isDarkMode ? 'dark' : ''}`}>
            <button
                onClick={() => navigate(-1)}
                type="button"
                className="mb-6 flex items-center gap-1.5 text-xs font-bold uppercase text-slate-500 hover:text-slate-700 transition dark:text-slate-400 dark:hover:text-slate-200"
            >
                <ChevronLeft size={16} />
                Indietro
            </button>

            <div className="flex items-start justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 mb-2 flex items-center gap-2 dark:text-slate-50">
                        <ShieldCheck className="text-indigo-600 dark:text-indigo-400" size={28} />
                        Pannello Admin
                    </h1>
                    <p className="text-sm font-bold uppercase text-slate-400 tracking-wide">
                        Moderazione contenuti
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setIsDarkMode(v => !v)}
                    title={isDarkMode ? 'Disattiva modalità notte' : 'Attiva modalità notte'}
                    className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors flex-shrink-0 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                    {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>
            </div>

            {/* ── TAB ── */}
            <div className="flex gap-2 mb-6 border-b border-slate-200 overflow-x-auto dark:border-slate-700">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2.5 text-xs font-black uppercase tracking-widest border-b-2 whitespace-nowrap transition-colors ${activeTab === tab.key ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                    >
                        {tab.label}{typeof tab.count === 'number' && tab.count > 0 ? ` (${tab.count})` : ''}
                    </button>
                ))}
            </div>

            {/* ── SEGNALAZIONI ── */}
            {activeTab === 'reports' && (
                <>
                    <section className="mb-8">
                        <h2 className="text-lg font-black uppercase text-slate-700 mb-3 dark:text-slate-200">
                            Segnalazioni ({reports.length})
                        </h2>
                        <div className="grid gap-4 md:grid-cols-2">
                            {reports.length > 0 ? (
                                reports.map((report) => (
                                    <div key={report.id} className="p-5 bg-white border border-slate-100 shadow-sm rounded-3xl dark:bg-slate-800 dark:border-slate-700">
                                        <p className="text-[10px] font-black uppercase text-slate-400 mb-2">
                                            Segnalata da <span className="text-blue-600 dark:text-blue-400">{report.reporter?.username || 'utente eliminato'}</span>
                                        </p>

                                        {report.review ? (
                                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 mb-3 dark:bg-slate-900 dark:border-slate-700">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-black text-yellow-500 text-sm">{'★'.repeat(report.review.rating)}</span>
                                                    <span className="text-[10px] font-bold uppercase text-slate-400 ml-auto">
                                                        {report.review.reviewer?.username} → {report.review.target?.username}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-700 dark:text-slate-300">
                                                    {report.review.comment ? `"${report.review.comment}"` : <span className="italic text-slate-400">Nessun commento</span>}
                                                </p>
                                            </div>
                                        ) : (
                                            <p className="text-xs italic text-slate-400 mb-3">Recensione già eliminata</p>
                                        )}

                                        <p className="text-sm text-slate-600 mb-4 dark:text-slate-300">
                                            <strong>Motivo:</strong> {report.reason}
                                        </p>

                                        <div className="flex gap-3">
                                            <button
                                                type="button"
                                                onClick={() => handleDismiss(report)}
                                                disabled={reportActionId === report.id}
                                                className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-colors disabled:opacity-50 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                                            >
                                                Ignora
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveReview(report)}
                                                disabled={reportActionId === report.id || !report.review}
                                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-red-700 transition-colors disabled:opacity-50"
                                            >
                                                <Trash2 size={13} />
                                                Rimuovi recensione
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-6 bg-white border border-slate-100 rounded-3xl text-center dark:bg-slate-800 dark:border-slate-700 md:col-span-2">
                                    <p className="font-bold text-slate-600 dark:text-slate-300">Nessuna segnalazione in sospeso.</p>
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-lg font-black uppercase text-slate-700 mb-3 dark:text-slate-200 flex items-center gap-2">
                            <MessageCircle size={18} className="text-blue-600 dark:text-blue-400" />
                            Segnalazioni Chat ({chatReports.length})
                        </h2>
                        <div className="grid gap-4 md:grid-cols-2">
                            {chatReports.length > 0 ? (
                                chatReports.map((report) => (
                                    <div key={report.id} className="p-5 bg-white border border-slate-100 shadow-sm rounded-3xl dark:bg-slate-800 dark:border-slate-700">
                                        <p className="text-[10px] font-black uppercase text-slate-400 mb-2">
                                            Segnalata da <span className="text-blue-600 dark:text-blue-400">{report.reporter?.username || 'utente eliminato'}</span>
                                            {' '}contro{' '}
                                            <span className="text-red-600">{report.reported?.username || 'utente eliminato'}</span>
                                        </p>

                                        {report.match?.title && (
                                            <p className="text-xs italic text-slate-400 mb-2">Partita: {report.match.title}</p>
                                        )}

                                        <p className="text-sm text-slate-600 mb-4 dark:text-slate-300">
                                            <strong>Motivo:</strong> {report.reason}
                                        </p>

                                        <div className="flex gap-3">
                                            <button
                                                type="button"
                                                onClick={() => handleDismissChatReport(report)}
                                                disabled={chatReportActionId === report.id}
                                                className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-colors disabled:opacity-50 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                                            >
                                                Ignora
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleBanFromChatReport(report)}
                                                disabled={chatReportActionId === report.id || !report.reported || report.reported.is_banned}
                                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-red-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-red-700 transition-colors disabled:opacity-50"
                                            >
                                                <Ban size={13} />
                                                Banna utente
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-6 bg-white border border-slate-100 rounded-3xl text-center dark:bg-slate-800 dark:border-slate-700 md:col-span-2">
                                    <p className="font-bold text-slate-600 dark:text-slate-300">Nessuna segnalazione chat in sospeso.</p>
                                </div>
                            )}
                        </div>
                    </section>
                </>
            )}

            {/* ── GESTIONE UTENTI (BAN/UNBAN) ── */}
            {activeTab === 'users' && (
                <section>
                    <h2 className="text-lg font-black uppercase text-slate-700 mb-3 dark:text-slate-200">Gestione utenti ({usersTotalCount})</h2>

                    <div className="flex flex-col sm:flex-row gap-2 mb-4">
                        <form onSubmit={handleSearchSubmit} className="flex gap-2 flex-1">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Cerca per username..."
                                className="flex-1 border border-slate-200 rounded-2xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
                            />
                            <button
                                type="submit"
                                disabled={usersLoading}
                                className="px-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                                <Search size={18} />
                            </button>
                        </form>
                        <select
                            value={statusFilter}
                            onChange={(e) => handleStatusFilterChange(e.target.value)}
                            className="border border-slate-200 rounded-2xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
                        >
                            <option value="all">Tutti</option>
                            <option value="active">Attivi</option>
                            <option value="banned">Bannati</option>
                        </select>
                    </div>

                    {/* Tabella (desktop) */}
                    <div className="hidden md:block bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm dark:bg-slate-800 dark:border-slate-700">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100 dark:bg-slate-900 dark:border-slate-700">
                                    <SortableTh column="username" label="Username" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                                    <SortableTh column="full_name" label="Nome Completo" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                                    <SortableTh column="location" label="Luogo" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                                    <SortableTh column="created_at" label="Iscritto il" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                                    <SortableTh column="last_sign_in_at" label="Ultimo accesso" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                                    <SortableTh column="is_banned" label="Stato" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                                    <th className="text-right px-4 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest">Azioni</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                                {displayedUsers.map((profile) => (
                                    <tr key={profile.id}>
                                        <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100">{profile.username}</td>
                                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{profile.full_name || '—'}</td>
                                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{profile.location || '—'}</td>
                                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{formatDate(profile.created_at)}</td>
                                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{formatDate(profile.last_sign_in_at)}</td>
                                        <td className="px-4 py-3">
                                            {profile.is_banned ? (
                                                <span className="text-[10px] font-black uppercase text-red-500 dark:text-red-400">
                                                    Bannato{profile.ban_reason ? ` — ${profile.ban_reason}` : ''}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">Attivo</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {profile.is_banned ? (
                                                <button
                                                    type="button"
                                                    onClick={() => handleUnban(profile)}
                                                    disabled={banActionLoading}
                                                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 font-black rounded-xl uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-colors disabled:opacity-50 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                                                >
                                                    <ShieldCheck size={13} />
                                                    Sbanna
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => openBanModal(profile)}
                                                    disabled={banActionLoading}
                                                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white font-black rounded-xl uppercase text-[10px] tracking-widest hover:bg-red-700 transition-colors disabled:opacity-50"
                                                >
                                                    <Ban size={13} />
                                                    Banna
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {users.length === 0 && !usersLoading && (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-10 text-center text-slate-400 font-bold">
                                            Nessun utente trovato.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Card (mobile) */}
                    <div className="md:hidden space-y-3">
                        {displayedUsers.map((profile) => (
                            <div key={profile.id} className="p-4 bg-white border border-slate-100 shadow-sm rounded-2xl flex items-center gap-3 dark:bg-slate-800 dark:border-slate-700">
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm text-slate-800 truncate dark:text-slate-100">{profile.username}</p>
                                    {profile.full_name && (
                                        <p className="text-xs text-slate-400 truncate">{profile.full_name}</p>
                                    )}
                                    <p className="text-xs text-slate-400 truncate">
                                        {profile.location || 'Luogo non specificato'} · Iscritto il {formatDate(profile.created_at)}
                                    </p>
                                    <p className="text-xs text-slate-400 truncate">
                                        Ultimo accesso: {formatDate(profile.last_sign_in_at)}
                                    </p>
                                    {profile.is_banned && (
                                        <p className="text-[10px] font-black uppercase text-red-500 dark:text-red-400">
                                            Bannato{profile.ban_reason ? ` — ${profile.ban_reason}` : ''}
                                        </p>
                                    )}
                                </div>
                                {profile.is_banned ? (
                                    <button
                                        type="button"
                                        onClick={() => handleUnban(profile)}
                                        disabled={banActionLoading}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 font-black rounded-xl uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-colors disabled:opacity-50 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                                    >
                                        <ShieldCheck size={13} />
                                        Sbanna
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => openBanModal(profile)}
                                        disabled={banActionLoading}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white font-black rounded-xl uppercase text-[10px] tracking-widest hover:bg-red-700 transition-colors disabled:opacity-50"
                                    >
                                        <Ban size={13} />
                                        Banna
                                    </button>
                                )}
                            </div>
                        ))}
                        {users.length === 0 && !usersLoading && (
                            <div className="p-6 bg-white border border-slate-100 rounded-3xl text-center dark:bg-slate-800 dark:border-slate-700">
                                <p className="font-bold text-slate-600 dark:text-slate-300">Nessun utente trovato.</p>
                            </div>
                        )}
                    </div>

                    {usersTotalCount > PAGE_SIZE && (
                        <div className="flex items-center justify-center gap-3 mt-4">
                            <button
                                type="button"
                                onClick={() => setUsersPage(p => Math.max(0, p - 1))}
                                disabled={usersPage === 0 || usersLoading}
                                className="px-4 py-2 bg-slate-100 text-slate-600 font-black rounded-xl uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-colors disabled:opacity-40 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                            >
                                ‹ Precedente
                            </button>
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                Pagina {usersPage + 1} di {Math.max(1, Math.ceil(usersTotalCount / PAGE_SIZE))}
                            </span>
                            <button
                                type="button"
                                onClick={() => setUsersPage(p => p + 1)}
                                disabled={usersPage >= Math.ceil(usersTotalCount / PAGE_SIZE) - 1 || usersLoading}
                                className="px-4 py-2 bg-slate-100 text-slate-600 font-black rounded-xl uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-colors disabled:opacity-40 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                            >
                                Successiva ›
                            </button>
                        </div>
                    )}
                </section>
            )}

            {/* ── GESTIONE CENTRI ── */}
            {activeTab === 'centers' && (
                <section>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-black uppercase text-slate-700 flex items-center gap-2 dark:text-slate-200">
                            <Building2 size={18} className="text-emerald-600 dark:text-emerald-400" />
                            Gestione Centri
                        </h2>
                        <button
                            type="button"
                            onClick={openCreateCenterModal}
                            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white font-black rounded-xl uppercase text-[10px] tracking-widest hover:bg-emerald-700 transition-colors"
                        >
                            <Plus size={13} />
                            Crea Centro
                        </button>
                    </div>

                    <div className="space-y-3">
                        {centers.length > 0 ? (
                            centers.map((center) => (
                                <div key={center.id} className="bg-white border border-slate-100 shadow-sm rounded-2xl overflow-hidden dark:bg-slate-800 dark:border-slate-700">
                                    <div className="p-4 flex flex-wrap items-center gap-3">
                                        <div className="flex-1 min-w-[160px]">
                                            <p className="font-bold text-sm text-slate-800 truncate dark:text-slate-100">{center.full_name || center.username}</p>
                                            <p className="text-xs text-slate-400 truncate">{center.business_address || 'Indirizzo non specificato'}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleToggleVisibility(center)}
                                            disabled={togglingCenterId === center.id}
                                            className={`flex items-center gap-1.5 px-3 py-2 font-black rounded-xl uppercase text-[10px] tracking-widest transition-colors disabled:opacity-50 ${center.is_visible ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-300 dark:hover:bg-emerald-500/30' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600'}`}
                                        >
                                            {center.is_visible ? <Eye size={13} /> : <EyeOff size={13} />}
                                            {center.is_visible ? 'Visibile' : 'Nascosto'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => openEditCenterModal(center)}
                                            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 font-black rounded-xl uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-colors dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                                        >
                                            <Pencil size={13} />
                                            Modifica
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setExpandedCourtsCenterId(prev => prev === center.id ? null : center.id)}
                                            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-700 font-black rounded-xl uppercase text-[10px] tracking-widest hover:bg-indigo-100 transition-colors dark:bg-indigo-500/20 dark:text-indigo-300 dark:hover:bg-indigo-500/30"
                                        >
                                            <LayoutGrid size={13} />
                                            Campi
                                            {expandedCourtsCenterId === center.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                        </button>
                                    </div>

                                    {expandedCourtsCenterId === center.id && (
                                        <div className="border-t border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
                                            <GestisciCampi centerId={center.id} />
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            <div className="p-6 bg-white border border-slate-100 rounded-3xl text-center dark:bg-slate-800 dark:border-slate-700">
                                <p className="font-bold text-slate-600 dark:text-slate-300">Nessun centro creato.</p>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {isCreateCenterOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50" onClick={closeCenterModal}>
                    <div className="w-full max-w-md mx-auto bg-white rounded-t-3xl md:rounded-3xl md:my-8 p-6 space-y-3 max-h-[85vh] overflow-y-auto dark:bg-slate-800" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-1">
                            <h2 className="text-lg font-black text-slate-800 uppercase dark:text-slate-100">{editingCenter ? 'Modifica Centro' : 'Crea Centro'}</h2>
                            <button onClick={closeCenterModal} className="p-2 bg-slate-100 text-slate-400 rounded-full hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600">
                                <X size={18} />
                            </button>
                        </div>

                        {!editingCenter && (
                            <>
                                <input
                                    type="email"
                                    placeholder="Email di accesso"
                                    value={centerForm.email}
                                    onChange={(e) => setCenterForm(prev => ({ ...prev, email: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
                                />
                                <input
                                    type="text"
                                    placeholder="Password (min 6 caratteri)"
                                    value={centerForm.password}
                                    onChange={(e) => setCenterForm(prev => ({ ...prev, password: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
                                />
                                <input
                                    type="text"
                                    placeholder="Username"
                                    value={centerForm.username}
                                    onChange={(e) => setCenterForm(prev => ({ ...prev, username: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
                                />
                            </>
                        )}
                        <input
                            type="text"
                            placeholder="Nome del centro"
                            value={centerForm.full_name}
                            onChange={(e) => setCenterForm(prev => ({ ...prev, full_name: e.target.value }))}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
                        />
                        <input
                            type="text"
                            placeholder="Cellulare (opzionale)"
                            value={centerForm.cellulare}
                            onChange={(e) => setCenterForm(prev => ({ ...prev, cellulare: e.target.value }))}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
                        />

                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Indirizzo</p>
                            <LocationPicker
                                value={{ location: centerForm.business_address, location_lat: centerForm.lat, location_lng: centerForm.lng }}
                                onChange={(loc) => setCenterForm(prev => ({ ...prev, business_address: loc.location, lat: loc.location_lat, lng: loc.location_lng }))}
                            />
                        </div>

                        <button
                            type="button"
                            onClick={handleSubmitCenterForm}
                            disabled={creatingCenter}
                            className="w-full py-3 bg-emerald-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors disabled:opacity-60 mt-2"
                        >
                            {creatingCenter
                                ? (editingCenter ? 'Salvataggio...' : 'Creazione in corso...')
                                : (editingCenter ? 'Salva Modifiche' : 'Crea Centro')}
                        </button>
                    </div>
                </div>
            )}

            {banTarget && (
                <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50">
                    <div className="w-full max-w-md mx-auto bg-white rounded-t-3xl md:rounded-3xl p-6 dark:bg-slate-800">
                        <h2 className="text-lg font-black text-slate-800 uppercase dark:text-slate-100 mb-1">Banna Utente</h2>
                        <p className="text-sm text-slate-500 mb-4 dark:text-slate-400">
                            Stai per bannare <span className="font-bold">{banTarget.username}</span>. Non potrà più accedere all'app.
                        </p>
                        <textarea
                            value={banReason}
                            onChange={(e) => setBanReason(e.target.value)}
                            placeholder="Motivo del ban (opzionale)..."
                            rows={3}
                            className="w-full border border-slate-200 rounded-2xl p-3 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 dark:placeholder-slate-500"
                        />
                        <div className="flex gap-3 mt-5">
                            <button
                                type="button"
                                onClick={() => setBanTarget(null)}
                                className="flex-1 py-3 bg-slate-100 text-slate-600 font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-colors dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                            >
                                Annulla
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmBan}
                                disabled={banActionLoading}
                                className="flex-1 py-3 bg-red-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-lg shadow-red-200 hover:bg-red-700 transition-colors disabled:opacity-60"
                            >
                                {banActionLoading ? 'Ban in corso...' : 'Conferma Ban'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
