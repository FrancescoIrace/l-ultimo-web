import { Link } from 'react-router-dom';
import { Zap, Clock, Bell, CalendarPlus, Navigation, Users, Lock, Star, Building2, Trees, MapPin, Sparkles, Trophy, Award, Flame, ArrowRight } from 'lucide-react';

const QUICK_ACTIONS = [
    { icon: CalendarPlus, title: 'Sul calendario in un tap', text: "Data e ora della partita finiscono su Google Calendar o iCal con un solo tocco. Promemoria automatico, zero rischio di dimenticarla." },
    { icon: Navigation, title: 'Naviga fino al campo', text: 'Tocca il luogo della partita e apri subito Google Maps o Apple Maps: indicazioni pronte, senza copiare indirizzi.' },
];

const TEAM_FEATURES = [
    { icon: Users, title: 'Crea la tua squadra', text: 'Raduna i tuoi amici in una squadra permanente e gestisci la rosa in un posto solo.' },
    { icon: Lock, title: 'Partite riservate', text: 'Organizza match visibili e prenotabili solo dai componenti della tua squadra.' },
    { icon: Star, title: 'Recensioni a fine partita', text: 'A fine match vota gli altri giocatori: la community resta corretta e affidabile.' },
];

const SPORTS = [
    { label: 'Calcio', icon: '⚽' },
    { label: 'Calcetto', icon: '⚽' },
    { label: 'Basket', icon: '🏀' },
    { label: 'Volley', icon: '🏐' },
    { label: 'Padel', icon: '🎾' },
    { label: 'Tennis', icon: '🎾' },
    { label: 'Corsa', icon: '🏃' },
    { label: 'Palestra', icon: '🏋️' },
];

const HOW_IT_WORKS = [
    { n: '01', title: 'Trova partite per distanza', text: 'Vedi solo i match nel tuo raggio. Filtra per sport, orario e livello e unisciti in un tap.' },
    { n: '02', title: 'Organizza in pochi tap', text: "Scegli sport, campo — un centro affiliato o un campetto pubblico — e numero di giocatori. Pubblichi e L'ULTIMO ti riempie la squadra." },
    { n: '03', title: 'Squadre, tornei e amici', text: 'Crea la tua squadra, sfida le altre e segui i tornei dei centri associati vicino a te.' },
];

const WHERE_TO_PLAY = [
    { icon: Building2, title: 'Centri affiliati', text: 'Struttura, campi, orari e recensioni: scegli il campo e organizzi il match dallo stesso posto.' },
    { icon: Trees, title: 'Campi pubblici', free: true, text: 'I campetti dei parchi comunali, sulla mappa. Nessun costo, nessuna prenotazione: prendi e vai.' },
    { icon: MapPin, title: 'Manca il tuo campo?', text: 'Segnalalo in venti secondi: dopo un controllo lo aggiungiamo per tutta la community.' },
];

const SEASON_FEATURES = [
    { icon: Sparkles, title: 'Sfida Giornaliera', text: 'Un quiz al giorno per fare punti e tenere viva la classifica. Rispondi giusto, scala posizioni.' },
    { icon: Trophy, title: 'Classifica a stagioni', text: "Ogni stagione azzera i punti: si riparte tutti alla pari. Chi vince entra nell'Albo d'Oro." },
    { icon: Award, title: 'Badge e livello', text: 'Colleziona i badge di stagione e mostra sport, livello e ruoli sul tuo profilo pubblico.' },
];

function ComingSoonPill({ label = '▶ Google Play', dark = false, large = false }) {
    return (
        <span className={`inline-flex items-center gap-2 rounded-2xl font-bold cursor-not-allowed select-none ${large ? 'px-6 py-4' : 'px-4 py-2.5 text-sm'} ${dark ? 'border border-white/30 bg-white/10 text-white/80' : 'border border-slate-200 bg-slate-50 text-slate-500'}`}>
            {label} <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md ${dark ? 'bg-white/15 text-white' : 'bg-slate-200 text-slate-500'}`}>Presto</span>
        </span>
    );
}

export default function LandingPage() {
    return (
        <div className="w-full min-h-screen bg-white text-slate-900 overflow-x-hidden">
            {/* HEADER */}
            <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-slate-100">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <span className="text-2xl font-black text-blue-600 tracking-tighter">L'ULTIMO</span>
                    <nav className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-600">
                        <a href="#dove-giocare" className="hover:text-blue-600 transition-colors">Dove giocare</a>
                        <a href="#come-funziona" className="hover:text-blue-600 transition-colors">Come funziona</a>
                        <a href="#sport" className="hover:text-blue-600 transition-colors">Sport</a>
                        <a href="#beta" className="text-blue-600 hover:text-blue-700 transition-colors">Diventa tester</a>
                    </nav>
                    <div className="flex items-center gap-3">
                        <Link to="/accedi" className="text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors">
                            Accedi
                        </Link>
                        <ComingSoonPill />
                    </div>
                </div>
            </header>

            {/* HERO */}
            <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-16 md:pt-16 md:pb-24 grid md:grid-cols-2 gap-10 md:gap-8 items-center">
                <div>
                    <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full mb-5">
                        ● Organizza · Trova · Gioca
                    </span>
                    <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-[1.05] mb-5">
                        La partita è a un <span className="text-blue-600">tap</span> di distanza.
                    </h1>
                    <p className="text-slate-500 text-base sm:text-lg leading-relaxed mb-8 max-w-md">
                        Trova match vicino a te, organizza il tuo in 30 secondi e riempi la squadra — nei centri o nei campetti pubblici gratuiti. Otto sport, una sola app.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 mb-6">
                        <a
                            href="https://groups.google.com/g/ultimo-app-testers"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 rounded-2xl font-bold px-6 py-4 bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200/70"
                        >
                            <Sparkles size={18} /> Entra nella beta Android
                        </a>
                        <ComingSoonPill large />
                    </div>
                    <p className="text-sm text-slate-400 font-medium">
                        Gratis e senza pubblicità invadenti. Ora in <a href="#beta" className="text-blue-600 font-bold hover:underline">accesso anticipato su Android</a>.
                    </p>
                </div>

                {/* Mockup illustrativo (statico, non collegato a dati reali) */}
                <div className="relative max-w-sm mx-auto md:mx-0 md:justify-self-end w-full">
                    <div className="absolute -top-4 right-4 sm:right-8 bg-slate-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 z-10">
                        <Zap size={14} className="text-amber-400" /> Marco si è unito alla tua partita
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5 shadow-sm mt-6">
                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                            <div className="flex justify-between items-start mb-3">
                                <span className="text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-600 px-2 py-1 rounded-full">Calcio a 5</span>
                                <span className="text-[10px] font-bold text-slate-400">Tra 3 giorni</span>
                            </div>
                            <h3 className="font-black text-slate-800 mb-2">Cinque Stelle Aurora</h3>
                            <div className="space-y-1.5 mb-4">
                                <p className="text-xs text-slate-500 flex items-center gap-1.5"><Clock size={12} /> Martedì 7 Lug, 21:00</p>
                                <p className="text-xs text-slate-500 flex items-center gap-1.5">📍 Centro Sportivo Aurora · 1.2km</p>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-600">6/10 Giocatori</span>
                                <span className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-xl">Unisciti</span>
                            </div>
                        </div>
                    </div>
                    <div className="absolute -bottom-4 -left-3 w-11 h-11 bg-blue-600 rounded-2xl shadow-lg flex items-center justify-center text-white font-black">L'</div>
                </div>
            </section>

            {/* BETA TESTER (Android closed beta) */}
            <section id="beta" className="bg-slate-900 text-white py-14 md:py-20">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-10 md:gap-12 items-center">
                    <div>
                        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-lime-300 bg-lime-300/10 px-3 py-1.5 rounded-full mb-5">
                            ● Beta chiusa · Android
                        </span>
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">Provala in anteprima. Diventa tester.</h2>
                        <p className="text-slate-400 text-sm sm:text-base leading-relaxed mb-7 max-w-md">
                            Cerchiamo tester Android. La provi prima di tutti e ti resta il badge <span className="text-lime-300 font-bold">Tester Interno</span> — che poi non si potrà più ottenere.
                        </p>
                        <ol className="space-y-2.5 mb-8">
                            {[
                                { n: '1', t: 'Iscriviti al gruppo tester', d: 'due click, self-service', href: 'https://groups.google.com/g/ultimo-app-testers' },
                                { n: '2', t: 'Conferma di voler essere tester', d: 'apri il link e accetta', href: 'https://play.google.com/apps/testing/app.lultimo.twa' },
                                { n: '3', t: "Scarica l'app e gioca", d: 'dal Play Store', href: 'https://play.google.com/store/apps/details?id=app.lultimo.twa' },
                            ].map(step => (
                                <li key={step.n}>
                                    <a
                                        href={step.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group flex items-center gap-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl px-4 py-3 transition-colors"
                                    >
                                        <span className="w-8 h-8 flex-shrink-0 rounded-xl bg-lime-300 text-slate-900 font-black flex items-center justify-center">{step.n}</span>
                                        <span className="flex-1 min-w-0">
                                            <span className="block font-bold text-sm leading-tight">{step.t}</span>
                                            <span className="block text-xs text-slate-400">{step.d}</span>
                                        </span>
                                        <ArrowRight size={16} className="text-slate-500 group-hover:text-lime-300 transition-colors flex-shrink-0" />
                                    </a>
                                </li>
                            ))}
                        </ol>
                        <a
                            href="https://groups.google.com/g/ultimo-app-testers"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-lime-300 text-slate-900 font-black px-6 py-3.5 rounded-2xl hover:bg-lime-200 transition-colors"
                        >
                            Entra nella beta <ArrowRight size={18} />
                        </a>
                    </div>

                    {/* Badge Tester Interno */}
                    <div className="flex justify-center md:justify-end">
                        <svg viewBox="0 0 128 150" className="w-36 sm:w-44 drop-shadow-2xl" xmlns="http://www.w3.org/2000/svg">
                            <path d="M64 3 L121 23 V76 C121 114 96 137 64 147 C32 137 7 114 7 76 V23 Z" fill="#3166E2" />
                            <path d="M64 3 L121 23 V76 C121 114 96 137 64 147 C32 137 7 114 7 76 V23 Z" fill="none" stroke="#16368F" strokeWidth="3" />
                            <text x="64" y="86" textAnchor="middle" fontFamily="system-ui, Arial" fontWeight="900" fontSize="60" fill="#ffffff">U</text>
                            <text x="65" y="114" textAnchor="middle" fontFamily="system-ui, Arial" fontWeight="800" fontSize="13" letterSpacing="3" fill="#C7EE62">TESTER</text>
                        </svg>
                    </div>
                </div>
            </section>

            {/* AZIONI RAPIDE: CALENDARIO + NAVIGAZIONE */}
            <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-14 md:pb-20">
                <div className="grid sm:grid-cols-2 gap-4">
                    {QUICK_ACTIONS.map(item => (
                        <div key={item.title} className="flex items-start gap-4 bg-blue-50 border border-blue-100 rounded-3xl p-5 sm:p-6">
                            <div className="w-11 h-11 flex items-center justify-center bg-blue-600 text-white rounded-2xl flex-shrink-0">
                                <item.icon size={20} />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-800 mb-1">{item.title}</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">{item.text}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* DOVE GIOCARE: CENTRI + CAMPI PUBBLICI */}
            <section id="dove-giocare" className="max-w-6xl mx-auto px-4 sm:px-6 pb-14 md:pb-20">
                <div className="mb-8">
                    <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-green-600 bg-green-50 px-3 py-1.5 rounded-full mb-4">
                        <Sparkles size={13} /> Novità
                    </span>
                    <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">Trova dove giocare.</h2>
                    <p className="text-slate-500 text-sm sm:text-base leading-relaxed max-w-md">
                        Centri sportivi affiliati e campetti pubblici gratuiti dei parchi, tutti sulla stessa mappa.
                    </p>
                </div>
                <div className="grid sm:grid-cols-3 gap-6">
                    {WHERE_TO_PLAY.map(item => (
                        <div key={item.title} className="bg-slate-50 border border-slate-100 rounded-3xl p-6">
                            <div className={`w-11 h-11 flex items-center justify-center rounded-2xl mb-3 ${item.free ? 'bg-green-100 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                                <item.icon size={20} />
                            </div>
                            <h3 className="font-black text-lg mb-2 text-slate-800 flex items-center gap-2 flex-wrap">
                                {item.title}
                                {item.free && <span className="text-[10px] font-black uppercase tracking-wider bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Gratis</span>}
                            </h3>
                            <p className="text-sm text-slate-500 leading-relaxed">{item.text}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* SPORT */}
            <section id="sport" className="bg-slate-900 text-white py-14 md:py-20">
                <div className="max-w-6xl mx-auto px-4 sm:px-6">
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8">
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Uno per ogni gioco.</h2>
                        <p className="text-slate-400 max-w-sm text-sm leading-relaxed">
                            Dal calcetto del martedì al padel del weekend, ogni sport ha la sua community.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                        {SPORTS.map(s => (
                            <span key={s.label} className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 transition-colors px-4 py-2.5 rounded-full text-sm font-bold">
                                <span>{s.icon}</span> {s.label}
                            </span>
                        ))}
                    </div>
                </div>
            </section>

            {/* COME FUNZIONA */}
            <section id="come-funziona" className="max-w-6xl mx-auto px-4 sm:px-6 py-14 md:py-20">
                <div className="grid sm:grid-cols-3 gap-8 sm:gap-6">
                    {HOW_IT_WORKS.map(step => (
                        <div key={step.n}>
                            <span className="text-3xl font-black text-blue-600">{step.n}</span>
                            <h3 className="font-black text-lg mt-3 mb-2 text-slate-800">{step.title}</h3>
                            <p className="text-sm text-slate-500 leading-relaxed">{step.text}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* SFIDA GIORNALIERA & CLASSIFICA */}
            <section className="bg-blue-50 py-14 md:py-20">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-10 md:gap-12 items-center">
                    <div>
                        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600 bg-white px-3 py-1.5 rounded-full mb-5">
                            <Trophy size={13} /> Sfida & Classifica
                        </span>
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">Non solo partite: una sfida al giorno.</h2>
                        <p className="text-slate-500 text-sm sm:text-base leading-relaxed mb-6 max-w-md">
                            Rispondi al quiz giornaliero, fai punti e scala la classifica. Ogni stagione riparte da zero: chi vince finisce nell'Albo d'Oro.
                        </p>
                        <div className="space-y-4">
                            {SEASON_FEATURES.map(item => (
                                <div key={item.title} className="flex items-start gap-4">
                                    <div className="w-10 h-10 flex items-center justify-center bg-blue-600 text-white rounded-xl flex-shrink-0">
                                        <item.icon size={18} />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-800 leading-tight">{item.title}</h3>
                                        <p className="text-sm text-slate-500 leading-relaxed">{item.text}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Mockup classifica (statico, illustrativo) */}
                    <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm max-w-sm mx-auto md:mx-0 md:justify-self-end w-full">
                        <div className="flex items-center justify-between mb-5">
                            <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                <Trophy size={14} className="text-blue-600" /> Classifica · Stagione
                            </span>
                            <span className="text-[10px] font-black uppercase bg-blue-600 text-white px-2 py-1 rounded-full">Live</span>
                        </div>
                        <div className="flex items-end gap-2 mb-4">
                            {[
                                { pos: 2, name: 'Giulia', pts: '1.240', h: 'h-16', bg: 'bg-slate-200', tx: 'text-slate-600' },
                                { pos: 1, name: 'Marco', pts: '1.580', h: 'h-24', bg: 'bg-blue-600', tx: 'text-white' },
                                { pos: 3, name: 'Luca', pts: '990', h: 'h-12', bg: 'bg-slate-300', tx: 'text-slate-600' },
                            ].map(c => (
                                <div key={c.pos} className="flex-1 flex flex-col items-center">
                                    <span className="text-xs font-black text-slate-800">{c.name}</span>
                                    <span className="text-[10px] font-bold text-slate-400 mb-1.5">{c.pts} pt</span>
                                    <div className={`w-full ${c.h} ${c.bg} rounded-t-xl flex items-start justify-center pt-2`}>
                                        <span className={`text-sm font-black ${c.tx}`}>{c.pos}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="bg-blue-50 text-blue-700 rounded-xl px-3 py-2.5 text-xs font-bold flex items-center gap-2">
                            <Flame size={14} /> Streak di 5 giorni · +50 punti bonus
                        </div>
                    </div>
                </div>
            </section>

            {/* SQUADRE E RECENSIONI */}
            <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-14 md:pb-20">
                <div className="mb-8">
                    <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">Squadra tua, partite su misura.</h2>
                    <p className="text-slate-500 text-sm sm:text-base leading-relaxed max-w-md">
                        Non solo match aperti a tutti: costruisci il tuo gruppo fisso e gioca con chi conosci.
                    </p>
                </div>
                <div className="grid sm:grid-cols-3 gap-6">
                    {TEAM_FEATURES.map(item => (
                        <div key={item.title}>
                            <div className="w-11 h-11 flex items-center justify-center bg-blue-50 text-blue-600 rounded-2xl mb-3">
                                <item.icon size={20} />
                            </div>
                            <h3 className="font-black text-lg mb-2 text-slate-800">{item.title}</h3>
                            <p className="text-sm text-slate-500 leading-relaxed">{item.text}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* LISTA D'ATTESA */}
            <section id="lista-attesa" className="bg-slate-900 text-white py-14 md:py-20">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-10 md:gap-12 items-center">
                    <div>
                        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-400/10 px-3 py-1.5 rounded-full mb-5">
                            ● Lista d'attesa
                        </span>
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">Nessuno resta fuori.</h2>
                        <p className="text-slate-400 text-sm sm:text-base leading-relaxed mb-6 max-w-md">
                            Partita al completo? Ti metti in coda. Appena un giocatore lascia, entra automaticamente il primo della lista — in ordine cronologico — con notifica immediata.
                        </p>
                        <div className="flex flex-wrap gap-x-6 gap-y-3 text-xs font-bold text-slate-300">
                            <span>01 Ti metti in coda</span>
                            <span>02 Si libera un posto</span>
                            <span>03 Entri + notifica</span>
                        </div>
                    </div>

                    {/* Mockup illustrativo lista d'attesa */}
                    <div className="bg-slate-800 border border-slate-700 rounded-3xl p-5 shadow-xl max-w-sm mx-auto md:mx-0 md:justify-self-end w-full">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                                <Clock size={14} /> Lista d'attesa
                            </span>
                            <span className="text-[10px] font-black uppercase bg-emerald-400 text-slate-900 px-2 py-1 rounded-full">3 in coda</span>
                        </div>
                        <div className="space-y-2 mb-4">
                            {[{ n: 1, name: 'Giulia', tag: 'Prossima' }, { n: 2, name: 'Davide' }, { n: 3, name: 'Antonio' }].map(p => (
                                <div key={p.n} className="flex items-center justify-between bg-slate-900/60 rounded-xl px-3 py-2.5">
                                    <span className="flex items-center gap-2 text-sm font-bold">
                                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${p.n === 1 ? 'bg-emerald-400 text-slate-900' : 'bg-slate-700 text-slate-300'}`}>{p.n}</span>
                                        {p.name}
                                    </span>
                                    {p.tag && <span className="text-[10px] font-black uppercase text-emerald-400">{p.tag}</span>}
                                </div>
                            ))}
                        </div>
                        <div className="bg-emerald-400 text-slate-900 rounded-xl px-3 py-2.5 text-xs font-bold flex items-center gap-2">
                            <Bell size={14} /> È il tuo turno! Sei entrato in Padel Collegi 5° Piano
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA FINALE */}
            <section className="bg-blue-600 text-white py-16 md:py-20 text-center">
                <div className="max-w-2xl mx-auto px-4 sm:px-6">
                    <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">Scendi in campo con L'ULTIMO.</h2>
                    <p className="text-blue-100 mb-8">Gratis. Il tuo prossimo match ti aspetta.</p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <ComingSoonPill dark large />
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="bg-slate-900 text-slate-400 py-8">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                    <span className="text-lg font-black text-white tracking-tighter">L'ULTIMO</span>
                    <div className="flex items-center gap-4">
                        <span>© {new Date().getFullYear()} L'ULTIMO</span>
                        <Link to="/privacy-policy" className="hover:text-white transition-colors">Privacy</Link>
                        <Link to="/terms-of-service" className="hover:text-white transition-colors">Termini</Link>
                        <a href="mailto:irace.dev@gmail.com" className="hover:text-white transition-colors">Contatti</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
