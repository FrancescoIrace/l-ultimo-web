import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAlert } from '../components/AlertComponent';
import { ChevronLeft, ShieldAlert, Trash2, Ban, ShieldCheck, Search, MessageCircle, Building2, Plus, Eye, EyeOff, X } from 'lucide-react';
import Loader from '../components/Loader';
import LocationPicker from '../components/LocationPicker';

const ADMIN_EMAIL = 'admin@admin.it';

export default function AdminDashboard({ session }) {
    const navigate = useNavigate();
    const { success, error: showError, confirmDangerous } = useAlert();

    const isAdmin = session?.user?.email === ADMIN_EMAIL;

    const [loading, setLoading] = useState(isAdmin);
    const [reports, setReports] = useState([]);
    const [reportActionId, setReportActionId] = useState(null);
    const [chatReports, setChatReports] = useState([]);
    const [chatReportActionId, setChatReportActionId] = useState(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [banTarget, setBanTarget] = useState(null); // profilo in fase di ban
    const [banReason, setBanReason] = useState('');
    const [banActionLoading, setBanActionLoading] = useState(false);

    const [centers, setCenters] = useState([]);
    const [togglingCenterId, setTogglingCenterId] = useState(null);
    const [isCreateCenterOpen, setIsCreateCenterOpen] = useState(false);
    const [creatingCenter, setCreatingCenter] = useState(false);
    const emptyCenterForm = { email: '', password: '', username: '', full_name: '', business_address: '', lat: null, lng: null, cellulare: '' };
    const [centerForm, setCenterForm] = useState(emptyCenterForm);

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
                .select('id, username, full_name, business_address, is_visible')
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

    const handleSearch = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        setSearchLoading(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('id, username, avatar_url, is_banned, ban_reason')
            .ilike('username', `%${searchQuery.trim()}%`)
            .limit(20);
        setSearchLoading(false);

        if (error) {
            console.error('Errore ricerca utenti:', error.message);
            return;
        }
        setSearchResults(data || []);
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

        setSearchResults(prev => prev.map(u => u.id === banTarget.id ? { ...u, is_banned: true, ban_reason: banReason.trim() || null } : u));
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

        setSearchResults(prev => prev.map(u => u.id === profile.id ? { ...u, is_banned: false, ban_reason: null } : u));
        success(`${profile.username} è stato sbannato`);
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
            is_visible: true,
        }].sort((a, b) => a.full_name.localeCompare(b.full_name)));

        success(`Centro "${centerForm.full_name}" creato con successo!`);
        setIsCreateCenterOpen(false);
        setCenterForm(emptyCenterForm);
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

    if (!isAdmin) {
        return (
            <div className="max-w-md mx-auto p-10 text-center">
                <ShieldAlert size={48} className="mx-auto text-red-400 mb-4" />
                <p className="font-black uppercase text-slate-600">Accesso negato</p>
                <button
                    onClick={() => navigate('/')}
                    className="mt-6 text-xs font-bold uppercase text-blue-600 hover:underline"
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

    return (
        <main className="max-w-md mx-auto p-6 pb-24 bg-slate-50 min-h-screen">
            <button
                onClick={() => navigate(-1)}
                type="button"
                className="mb-6 flex items-center gap-1.5 text-xs font-bold uppercase text-slate-500 hover:text-slate-700 transition"
            >
                <ChevronLeft size={16} />
                Indietro
            </button>

            <h1 className="text-3xl font-black text-slate-900 mb-2 flex items-center gap-2">
                <ShieldCheck className="text-indigo-600" size={28} />
                Pannello Admin
            </h1>
            <p className="text-sm font-bold uppercase text-slate-400 mb-6 tracking-wide">
                Moderazione contenuti
            </p>

            {/* ── SEGNALAZIONI IN SOSPESO ── */}
            <section className="mb-8">
                <h2 className="text-lg font-black uppercase text-slate-700 mb-3">
                    Segnalazioni ({reports.length})
                </h2>
                <div className="space-y-4">
                    {reports.length > 0 ? (
                        reports.map((report) => (
                            <div key={report.id} className="p-5 bg-white border border-slate-100 shadow-sm rounded-3xl">
                                <p className="text-[10px] font-black uppercase text-slate-400 mb-2">
                                    Segnalata da <span className="text-blue-600">{report.reporter?.username || 'utente eliminato'}</span>
                                </p>

                                {report.review ? (
                                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 mb-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-black text-yellow-500 text-sm">{'★'.repeat(report.review.rating)}</span>
                                            <span className="text-[10px] font-bold uppercase text-slate-400 ml-auto">
                                                {report.review.reviewer?.username} → {report.review.target?.username}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-700">
                                            {report.review.comment ? `"${report.review.comment}"` : <span className="italic text-slate-400">Nessun commento</span>}
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-xs italic text-slate-400 mb-3">Recensione già eliminata</p>
                                )}

                                <p className="text-sm text-slate-600 mb-4">
                                    <strong>Motivo:</strong> {report.reason}
                                </p>

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => handleDismiss(report)}
                                        disabled={reportActionId === report.id}
                                        className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-colors disabled:opacity-50"
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
                        <div className="p-6 bg-white border border-slate-100 rounded-3xl text-center">
                            <p className="font-bold text-slate-600">Nessuna segnalazione in sospeso.</p>
                        </div>
                    )}
                </div>
            </section>

            {/* ── SEGNALAZIONI CHAT ── */}
            <section className="mb-8">
                <h2 className="text-lg font-black uppercase text-slate-700 mb-3 flex items-center gap-2">
                    <MessageCircle size={18} className="text-blue-600" />
                    Segnalazioni Chat ({chatReports.length})
                </h2>
                <div className="space-y-4">
                    {chatReports.length > 0 ? (
                        chatReports.map((report) => (
                            <div key={report.id} className="p-5 bg-white border border-slate-100 shadow-sm rounded-3xl">
                                <p className="text-[10px] font-black uppercase text-slate-400 mb-2">
                                    Segnalata da <span className="text-blue-600">{report.reporter?.username || 'utente eliminato'}</span>
                                    {' '}contro{' '}
                                    <span className="text-red-600">{report.reported?.username || 'utente eliminato'}</span>
                                </p>

                                {report.match?.title && (
                                    <p className="text-xs italic text-slate-400 mb-2">Partita: {report.match.title}</p>
                                )}

                                <p className="text-sm text-slate-600 mb-4">
                                    <strong>Motivo:</strong> {report.reason}
                                </p>

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => handleDismissChatReport(report)}
                                        disabled={chatReportActionId === report.id}
                                        className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-colors disabled:opacity-50"
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
                        <div className="p-6 bg-white border border-slate-100 rounded-3xl text-center">
                            <p className="font-bold text-slate-600">Nessuna segnalazione chat in sospeso.</p>
                        </div>
                    )}
                </div>
            </section>

            {/* ── GESTIONE UTENTI (BAN/UNBAN) ── */}
            <section>
                <h2 className="text-lg font-black uppercase text-slate-700 mb-3">Gestione utenti</h2>
                <form onSubmit={handleSearch} className="flex gap-2 mb-4">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Cerca per username..."
                        className="flex-1 border border-slate-200 rounded-2xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        type="submit"
                        disabled={searchLoading}
                        className="px-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        <Search size={18} />
                    </button>
                </form>

                <div className="space-y-3">
                    {searchResults.map((profile) => (
                        <div key={profile.id} className="p-4 bg-white border border-slate-100 shadow-sm rounded-2xl flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm text-slate-800 truncate">{profile.username}</p>
                                {profile.is_banned && (
                                    <p className="text-[10px] font-black uppercase text-red-500">
                                        Bannato{profile.ban_reason ? ` — ${profile.ban_reason}` : ''}
                                    </p>
                                )}
                            </div>
                            {profile.is_banned ? (
                                <button
                                    type="button"
                                    onClick={() => handleUnban(profile)}
                                    disabled={banActionLoading}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 font-black rounded-xl uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-colors disabled:opacity-50"
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
                </div>
            </section>

            {/* ── GESTIONE CENTRI ── */}
            <section className="mt-8">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-black uppercase text-slate-700 flex items-center gap-2">
                        <Building2 size={18} className="text-emerald-600" />
                        Gestione Centri
                    </h2>
                    <button
                        type="button"
                        onClick={() => { setCenterForm(emptyCenterForm); setIsCreateCenterOpen(true); }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white font-black rounded-xl uppercase text-[10px] tracking-widest hover:bg-emerald-700 transition-colors"
                    >
                        <Plus size={13} />
                        Crea Centro
                    </button>
                </div>

                <div className="space-y-3">
                    {centers.length > 0 ? (
                        centers.map((center) => (
                            <div key={center.id} className="p-4 bg-white border border-slate-100 shadow-sm rounded-2xl flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm text-slate-800 truncate">{center.full_name || center.username}</p>
                                    <p className="text-xs text-slate-400 truncate">{center.business_address || 'Indirizzo non specificato'}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleToggleVisibility(center)}
                                    disabled={togglingCenterId === center.id}
                                    className={`flex items-center gap-1.5 px-3 py-2 font-black rounded-xl uppercase text-[10px] tracking-widest transition-colors disabled:opacity-50 ${center.is_visible ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                >
                                    {center.is_visible ? <Eye size={13} /> : <EyeOff size={13} />}
                                    {center.is_visible ? 'Visibile' : 'Nascosto'}
                                </button>
                            </div>
                        ))
                    ) : (
                        <div className="p-6 bg-white border border-slate-100 rounded-3xl text-center">
                            <p className="font-bold text-slate-600">Nessun centro creato.</p>
                        </div>
                    )}
                </div>
            </section>

            {isCreateCenterOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={() => setIsCreateCenterOpen(false)}>
                    <div className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-6 space-y-3 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-1">
                            <h2 className="text-lg font-black text-slate-800 uppercase">Crea Centro</h2>
                            <button onClick={() => setIsCreateCenterOpen(false)} className="p-2 bg-slate-100 text-slate-400 rounded-full hover:bg-slate-200">
                                <X size={18} />
                            </button>
                        </div>

                        <input
                            type="email"
                            placeholder="Email di accesso"
                            value={centerForm.email}
                            onChange={(e) => setCenterForm(prev => ({ ...prev, email: e.target.value }))}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <input
                            type="text"
                            placeholder="Password (min 6 caratteri)"
                            value={centerForm.password}
                            onChange={(e) => setCenterForm(prev => ({ ...prev, password: e.target.value }))}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <input
                            type="text"
                            placeholder="Username"
                            value={centerForm.username}
                            onChange={(e) => setCenterForm(prev => ({ ...prev, username: e.target.value }))}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <input
                            type="text"
                            placeholder="Nome del centro"
                            value={centerForm.full_name}
                            onChange={(e) => setCenterForm(prev => ({ ...prev, full_name: e.target.value }))}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <input
                            type="text"
                            placeholder="Cellulare (opzionale)"
                            value={centerForm.cellulare}
                            onChange={(e) => setCenterForm(prev => ({ ...prev, cellulare: e.target.value }))}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                            onClick={handleCreateCenter}
                            disabled={creatingCenter}
                            className="w-full py-3 bg-emerald-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors disabled:opacity-60 mt-2"
                        >
                            {creatingCenter ? 'Creazione in corso...' : 'Crea Centro'}
                        </button>
                    </div>
                </div>
            )}

            {banTarget && (
                <div className="fixed inset-0 bg-black/50 flex items-end z-50">
                    <div className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-6">
                        <h2 className="text-lg font-black text-slate-800 uppercase mb-1">Banna Utente</h2>
                        <p className="text-sm text-slate-500 mb-4">
                            Stai per bannare <span className="font-bold">{banTarget.username}</span>. Non potrà più accedere all'app.
                        </p>
                        <textarea
                            value={banReason}
                            onChange={(e) => setBanReason(e.target.value)}
                            placeholder="Motivo del ban (opzionale)..."
                            rows={3}
                            className="w-full border border-slate-200 rounded-2xl p-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                        />
                        <div className="flex gap-3 mt-5">
                            <button
                                type="button"
                                onClick={() => setBanTarget(null)}
                                className="flex-1 py-3 bg-slate-100 text-slate-600 font-black rounded-2xl uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-colors"
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
