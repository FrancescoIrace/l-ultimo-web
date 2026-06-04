import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader, Lock, CheckCircle2, XCircle, Trophy, Brain, ChevronLeft, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function SfidaGiornaliera() {
    const navigate = useNavigate();
    const [status, setStatus] = useState('LOADING'); // LOADING, ALREADY_PLAYED, PLAYING, RESULTS, ERROR
    const [quizSet, setQuizSet] = useState([]);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [score, setScore] = useState(0);
    const [earnedPoints, setEarnedPoints] = useState(0);
    const [timeLeft, setTimeLeft] = useState(30);
    const [isProcessing, setIsProcessing] = useState(false);
    const [domande] = useState(questions); // Carica le domande dal JSON


    // Helper per la data locale (Formato YYYY-MM-DD)
    const getCurrentDate = () => new Date().toISOString().split('T')[0];

    useEffect(() => {
        const initGame = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    navigate('/');
                    return;
                }

                const todayDateStr = getCurrentDate();

                // 1. Check record su daily_game_attempts
                const { data: attempt, error: attemptError } = await supabase
                    .from('daily_game_attempts')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('played_at', todayDateStr)
                    .maybeSingle();

                if (attemptError) throw attemptError;

                if (attempt) {
                    setStatus('ALREADY_PLAYED');
                } else {
                    // Seleziona 3 domande casuali uniche dal pool completo
                    const shuffled = [...domande].sort(() => 0.5 - Math.random());
                    setQuizSet(shuffled.slice(0, 3));
                    setStatus('PLAYING');
                }
            } catch (err) {
                console.error("Errore inizializzazione Sfida:", err);
                setStatus('ERROR');
            }
        };


        initGame();
    }, [navigate]);

    // Gestione Timer
    useEffect(() => {
        let timerId;
        if (status === 'PLAYING' && timeLeft > 0) {
            timerId = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (status === 'PLAYING' && timeLeft === 0 && !isProcessing) {
            // Tempo Scaduto per questa domanda
            handleAnswer(-1);
        }

        return () => {
            if (timerId) clearInterval(timerId);
        };
    }, [status, timeLeft, isProcessing]);

    const handleAnswer = async (selectedIndex) => {
        if (isProcessing) return;

        const isCorrect = selectedIndex === quizSet[currentIdx].correctIndex;
        let newScore = score;
        let newPoints = earnedPoints;

        if (isCorrect) {
            newScore += 1;
            newPoints += 20;
            setScore(newScore);
            setEarnedPoints(newPoints);
        }

        // Passa alla prossima o finisci
        if (currentIdx < 2) {
            setCurrentIdx(prev => prev + 1);
            setTimeLeft(30); // Reset timer per la nuova domanda
        } else {
            // FINE DEL QUIZ - SALVATAGGIO
            await finalizeGame(newScore, newPoints);
        }
    };

    const finalizeGame = async (finalScore, finalPoints) => {
        setIsProcessing(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const todayDateStr = getCurrentDate();

            // 1. Blocca il tentativo giornaliero
            const { error: attemptError } = await supabase
                .from('daily_game_attempts')
                .insert({ user_id: user.id, played_at: todayDateStr });

            if (attemptError) console.error("Errore registrazione tentativo:", attemptError);

            // 2. Salva i punti solo se guadagnati
            if (finalPoints > 0) {
                // Recupero user profile
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('total_points')
                    .eq('id', user.id)
                    .single();

                const currentPoints = profile?.total_points || 0;

                await Promise.all([
                    supabase.from('profiles').update({ total_points: currentPoints + finalPoints }).eq('id', user.id),
                    supabase.from('leaderboard_history').insert({
                        user_id: user.id,
                        points: finalPoints,
                        reason: `Quiz del Giorno: ${finalScore}/3 risposte esatte`
                    })
                ]);
                console.log("Punti salvati con successo:", finalPoints);
            }

            setStatus('RESULTS');
        } catch (err) {
            console.error("Errore salvataggio finale:", err);
            setStatus('RESULTS'); // Mostriamo comunque i risultati all'utente
        } finally {
            setIsProcessing(false);
        }
    };

    // ----- RENDER CONDITIONS ----- //

    if (status === 'LOADING') {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
                <Loader className="animate-spin text-emerald-500 mb-4" size={48} />
                <p className="text-slate-500 font-medium animate-pulse">Preparazione della sfida...</p>
            </div>
        );
    }

    if (status === 'ERROR') {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
                <XCircle className="text-red-500 mb-4" size={64} />
                <h2 className="text-2xl font-black text-slate-800 mb-2">Ops!</h2>
                <p className="text-slate-500 mb-6">C'è stato un problema nel caricare la sfida. Riprova più tardi.</p>
                <button onClick={() => navigate(-1)} className="w-full max-w-xs bg-slate-200 text-slate-700 py-3 rounded-xl font-bold active:scale-95 transition-all">
                    Torna Indietro
                </button>
            </div>
        );
    }

    if (status === 'ALREADY_PLAYED') {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col p-4 relative">
                <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
                    <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
                        <Lock className="text-blue-500" size={40} />
                    </div>
                    <h2 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">Sfida Completata!</h2>
                    <p className="text-slate-600 mb-8 font-medium px-4">
                        Hai già risposto alla sfida di oggi! Torna domani per sbloccare un nuovo quiz e accumulare altri punti.
                    </p>
                    <button onClick={() => navigate('/leaderboard')} className="w-full my-2 bg-red-600 text-white py-3.5 rounded-2xl font-bold active:scale-95 transition-all">
                        Vai alla Classifica
                    </button>
                    <button onClick={() => navigate(-1)} className="w-full bg-slate-800 text-white py-3.5 rounded-2xl font-bold active:scale-95 transition-all">
                        Torna alla Dashboard
                    </button>
                </div>
            </div>
        );
    }

    if (status === 'RESULTS') {
        const isPerfect = score === 3;
        return (
            <div className={`min-h-screen ${isPerfect ? 'bg-emerald-50' : 'bg-slate-50'} flex flex-col p-4`}>
                <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm mx-auto w-full">
                    <div className={`w-28 h-28 rounded-full flex items-center justify-center mb-6 shadow-xl ${isPerfect ? 'bg-white' : 'bg-white'}`}>
                        {score > 0 ? <Trophy className="text-emerald-500" size={56} /> : <XCircle className="text-red-500" size={56} />}
                    </div>

                    <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">
                        {isPerfect ? "Incredibile! 🏆" : "Sfida Completata!"}
                    </h2>

                    <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-slate-200/50 mb-8 w-full border border-slate-100">
                        <p className="text-slate-500 font-bold uppercase text-xs tracking-widest mb-2">Risulato Finale</p>
                        <p className="text-4xl font-black text-slate-800 mb-4">{score} / 3</p>
                        <div className="h-px bg-slate-100 w-full mb-4" />
                        <p className="text-slate-600 font-medium">
                            Ti sei aggiudicato <span className="text-emerald-500 font-black">+{earnedPoints} punti</span> per il tuo profilo!
                        </p>
                    </div>

                    {isPerfect && (
                        <p className="text-emerald-600 font-bold mb-6 animate-bounce">🔥 Campione del Giorno! 🔥</p>
                    )}

                    <button onClick={() => navigate(-1)} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black shadow-lg active:scale-95 transition-all uppercase tracking-wider">
                        Continua
                    </button>
                </div>
            </div>
        );
    }

    // --- PLAYING STATE --- //
    const currentQuestion = quizSet[currentIdx];
    const progressPercentage = (timeLeft / 30) * 100;

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col relative pb-4">
            {/* Header */}
            <div className="bg-white px-4 py-3 border-b border-slate-200 sticky top-0 z-10 flex items-center justify-between">
                <button onClick={() => navigate(-1)} className="text-slate-400 active:scale-90 transition-transform">
                    <ChevronLeft size={24} />
                </button>
                <div className="flex items-center flex-col">
                    <span className="font-black text-slate-800 tracking-tight">SFIDA {currentIdx + 1}/3</span>
                    <div className="flex gap-1 mt-1">
                        {[0, 1, 2].map(i => (
                            <div key={i} className={`h-1 w-6 rounded-full ${i <= currentIdx ? 'bg-blue-500' : 'bg-slate-200'}`} />
                        ))}
                    </div>
                </div>
                <div className="text-xs font-black bg-blue-100 text-blue-600 px-2 py-1 rounded-lg">
                    +{earnedPoints} PT
                </div>
            </div>

            <div className="px-4 pt-4 flex-1 flex flex-col max-w-md mx-auto w-full overflow-hidden">
                {/* Timer Bar */}
                <div className="mb-4">
                    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-1000 ease-linear rounded-full ${timeLeft > 15 ? 'bg-emerald-500' : timeLeft > 7 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                            style={{ width: `${progressPercentage}%` }}
                        />
                    </div>
                    <div className="flex justify-between mt-1 px-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tempo Rimasto</span>
                        <span className={`text-[10px] font-black ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-slate-600'}`}>{timeLeft}s</span>
                    </div>
                </div>

                {/* Question Card */}
                <div className="bg-white rounded-[1.5rem] p-5 shadow-lg shadow-slate-200/50 mb-4 border border-white relative overflow-hidden flex-shrink-0 min-h-[110px] flex items-center">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />
                    <h2 className="text-xl font-black text-slate-800 leading-tight">
                        {currentQuestion?.question}
                    </h2>
                </div>

                {/* Options */}
                <div className="space-y-2.5 flex-1 flex flex-col justify-start pb-4">
                    {currentQuestion?.options.map((opt, idx) => (
                        <button
                            key={idx}
                            disabled={isProcessing}
                            onClick={() => handleAnswer(idx)}
                            className="w-full bg-white border-2 border-slate-100 hover:border-blue-500 text-left px-5 py-3.5 rounded-xl shadow-sm text-slate-700 font-bold active:scale-[0.98] transition-all flex items-center justify-between group disabled:opacity-50"
                        >
                            <span className="text-sm">{opt}</span>
                            <div className="w-5 h-5 rounded-full border-2 border-slate-200 group-hover:border-blue-500 flex-shrink-0 transition-colors" />
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

const questions = [
  { "id": 1, "question": "Quanto dura un tempo in una partita di calcio a 11 regolamentare?", "options": ["40 minuti", "45 minuti", "50 minuti", "60 minuti"], "correctIndex": 1 },
  { "id": 2, "question": "Nel basket, quanti punti vale un tiro libero?", "options": ["1 punto", "2 punti", "3 punti", "Nessun punto"], "correctIndex": 0 },
  { "id": 3, "question": "Chi detiene il record di punti all-time nella regular season NBA?", "options": ["Michael Jordan", "Kobe Bryant", "LeBron James", "Kareem Abdul-Jabbar"], "correctIndex": 2 },
  { "id": 4, "question": "Quanti giocatori ci sono in una squadra di calcetto (futsal) in campo?", "options": ["5", "6", "7", "8"], "correctIndex": 0 },
  { "id": 5, "question": "Nel padel, chi serve per primo nel tie-break?", "options": ["Chi ha risposto nel game precedente", "Chi ha servito nel game precedente", "Si sorteggia di nuovo", "Sempre il giocatore di destra"], "correctIndex": 0 },
  { "id": 6, "question": "Quale pilota di F1 ha vinto 7 mondiali come Michael Schumacher?", "options": ["Sebastian Vettel", "Max Verstappen", "Lewis Hamilton", "Fernando Alonso"], "correctIndex": 2 },
  { "id": 7, "question": "Quanti set deve vincere un uomo per aggiudicarsi un match in un torneo del Grande Slam?", "options": ["2", "3", "4", "5"], "correctIndex": 1 },
  { "id": 8, "question": "In quale città si sono svolte le prime Olimpiadi moderne del 1896?", "options": ["Parigi", "Londra", "Roma", "Atene"], "correctIndex": 3 },
  { "id": 9, "question": "Quale nazionale ha vinto più Mondiali di calcio?", "options": ["Italia", "Germania", "Brasile", "Argentina"], "correctIndex": 2 },
  { "id": 10, "question": "Come si chiama il punteggio di 0-0 nel tennis?", "options": ["Zero", "Love", "Nil", "Niente"], "correctIndex": 1 },
  { "id": 11, "question": "Nel calcetto, se il pallone esce lateralmente, come viene effettuata la rimessa?", "options": ["Con le mani", "Con i piedi", "Indifferente", "Con un lancio del portiere"], "correctIndex": 1 },
  { "id": 12, "question": "Quale calciatore ha segnato il celebre gol di mano soprannominato 'Mano de Dios'?", "options": ["Pelé", "Diego Armando Maradona", "Lionel Messi", "Ronaldo il Fenomeno"], "correctIndex": 1 },
  { "id": 13, "question": "In quale sport si usa il termine 'strike'?", "options": ["Baseball", "Tennis", "Pallavolo", "Scherma"], "correctIndex": 0 },
  { "id": 14, "question": "Qual è la distanza ufficiale di una maratona?", "options": ["21,097 km", "42,195 km", "45,000 km", "38,500 km"], "correctIndex": 1 },
  { "id": 15, "question": "Quanti tempi si giocano in una partita di basket NBA?", "options": ["2", "3", "4", "1"], "correctIndex": 2 },
  { "id": 16, "question": "Nel volley, qual è il numero massimo di tocchi per squadra prima di rinviare la palla?", "options": ["2", "3", "4", "1"], "correctIndex": 1 },
  { "id": 17, "question": "Chi è il pugile soprannominato 'The Greatest'?", "options": ["Mike Tyson", "Rocky Marciano", "Muhammad Ali", "Floyd Mayweather"], "correctIndex": 2 },
  { "id": 18, "question": "Quale nazione ospiterà i Mondiali di calcio 2026 insieme a USA e Messico?", "options": ["Brasile", "Canada", "Argentina", "Cile"], "correctIndex": 1 },
  { "id": 19, "question": "Quale clamoroso scherzo ha subito la squadra dei Washington Generals per decenni?", "options": ["Perdere sempre contro gli Harlem Globetrotters", "Giocare bendati", "Usare un pallone sgonfio", "Giocare in 4 contro 5"], "correctIndex": 0 },
  { "id": 20, "question": "Quanti giocatori compongono una squadra di pallanuoto in acqua durante il gioco?", "options": ["5", "6", "7", "11"], "correctIndex": 2 },
  { "id": 21, "question": "Chi ha vinto l'oro nei 100 metri piani a Tokyo 2020?", "options": ["Usain Bolt", "Marcell Jacobs", "Fred Kerley", "Andre De Grasse"], "correctIndex": 1 },
  { "id": 22, "question": "In che anno l'Italia ha vinto il suo quarto mondiale di calcio?", "options": ["1982", "1990", "2006", "2010"], "correctIndex": 2 },
  { "id": 23, "question": "Quale squadra NBA ha vinto più titoli nella storia?", "options": ["Lakers", "Celtics", "Bulls", "Warriors"], "correctIndex": 1 },
  { "id": 24, "question": "Nel baseball, quante basi deve toccare un giocatore per fare un punto?", "options": ["3", "4", "5", "2"], "correctIndex": 1 },
  { "id": 25, "question": "Come viene chiamato il fallo di mano intenzionale fuori area del portiere?", "options": ["Punizione semplice", "Espulsione", "Ammonizione", "Nessun fallo"], "correctIndex": 1 },
  { "id": 26, "question": "Quale tennista italiano ha conquistato il primo posto nel ranking ATP nel 2024?", "options": ["Matteo Berrettini", "Jannik Sinner", "Lorenzo Musetti", "Fabio Fognini"], "correctIndex": 1 },
  { "id": 27, "question": "Chi detiene il record mondiale dei 100 e 200 metri piani?", "options": ["Carl Lewis", "Tyson Gay", "Usain Bolt", "Yohan Blake"], "correctIndex": 2 },
  { "id": 28, "question": "Nel tennis, cosa succede dopo il 'Deuce' (parità sul 40-40)?", "options": ["Tie-break", "Vittoria del set", "Vantaggio", "Cambio campo"], "correctIndex": 2 },
  { "id": 29, "question": "In F1, cosa indica la bandiera a scacchi?", "options": ["Incidente", "Ultimo giro", "Fine gara", "Pit stop obbligatorio"], "correctIndex": 2 },
  { "id": 30, "question": "Quanti arbitri ci sono in campo in una partita di calcio a 11?", "options": ["1", "2", "3", "4"], "correctIndex": 0 },
  { "id": 31, "question": "Quale tennista ha vinto più volte il Roland Garros?", "options": ["Roger Federer", "Novak Djokovic", "Rafael Nadal", "Bjorn Borg"], "correctIndex": 2 },
  { "id": 32, "question": "Nel basket, quanti falli di squadra servono in un quarto per far scattare il 'bonus'?", "options": ["4", "5", "6", "3"], "correctIndex": 1 },
  { "id": 33, "question": "Chi è il pilota di MotoGP con il maggior numero di titoli mondiali in classe regina?", "options": ["Marc Marquez", "Casey Stoner", "Valentino Rossi", "Giacomo Agostini"], "correctIndex": 3 },
  { "id": 34, "question": "Chi è l'unico giocatore nella storia del calcio ad aver vinto 3 Mondiali?", "options": ["Diego Maradona", "Pelé", "Ronaldo", "Zinedine Zidane"], "correctIndex": 1 },
  { "id": 35, "question": "Quante corsie ha solitamente una pista di atletica regolamentare?", "options": ["6", "8", "10", "12"], "correctIndex": 1 },
  { "id": 36, "question": "Quale città ha ospitato le Olimpiadi estive del 2024?", "options": ["Los Angeles", "Parigi", "Brisbane", "Madrid"], "correctIndex": 1 },
  { "id": 37, "question": "Chi è soprannominato 'La Pulce' nel calcio?", "options": ["Cristiano Ronaldo", "Lionel Messi", "Neymar", "Dybala"], "correctIndex": 1 },
  { "id": 38, "question": "Nel volley, il 'Libero' può schiacciare?", "options": ["Sì", "Solo dalla seconda linea", "No", "Solo se è il capitano"], "correctIndex": 2 },
  { "id": 39, "question": "Quale storico allenatore della NBA è famoso per i suoi 'Zen' e i 11 anelli vinti tra Bulls e Lakers?", "options": ["Gregg Popovich", "Phil Jackson", "Steve Kerr", "Pat Riley"], "correctIndex": 1 },
  { "id": 40, "question": "Quale giocatore della NBA ha segnato ben 100 punti in una singola partita nel 1962?", "options": ["Kobe Bryant", "Wilt Chamberlain", "Michael Jordan", "Larry Bird"], "correctIndex": 1 },
  { "id": 41, "question": "Chi ha vinto più titoli mondiali costruttori in F1?", "options": ["McLaren", "Ferrari", "Mercedes", "Red Bull"], "correctIndex": 1 },
  { "id": 42, "question": "In che anno si è ritirato ufficialmente Roger Federer dal tennis?", "options": ["2020", "2021", "2022", "2023"], "correctIndex": 2 },
  { "id": 43, "question": "Nel nuoto, qual è lo stile più lento?", "options": ["Dorso", "Farfalla", "Rana", "Stile libero"], "correctIndex": 2 },
  { "id": 44, "question": "Quanti periodi ci sono in una partita di Hockey su ghiaccio?", "options": ["2", "3", "4", "1"], "correctIndex": 1 },
  { "id": 45, "question": "Che cosa fa un giocatore di basket se commette una 'violazione di doppio palleggio'?", "options": ["Riprende a palleggiare dopo essersi fermato", "Palleggia con i piedi", "Tira fuori campo", "Passa la palla all'arbitro"], "correctIndex": 0 },
  { "id": 46, "question": "Chi è l'allenatore con più Champions League vinte nella storia del calcio?", "options": ["Guardiola", "Ancelotti", "Zidane", "Mourinho"], "correctIndex": 1 },
  { "id": 47, "question": "Nel calcetto (futsal), quanti falli cumulativi per tempo può fare una squadra prima del tiro libero diretto?", "options": ["3", "4", "5", "6"], "correctIndex": 2 },
  { "id": 48, "question": "Quale paese ha vinto la prima Coppa del Mondo di calcio nel 1930?", "options": ["Argentina", "Uruguay", "Brasile", "Italia"], "correctIndex": 1 },
  { "id": 49, "question": "Nel basket, quanti secondi ha una squadra per superare la metà campo?", "options": ["5", "8", "10", "24"], "correctIndex": 1 },
  { "id": 50, "question": "Cosa significa l'acronimo VAR nel calcio?", "options": ["Video Assistant Referee", "Visual Aid Record", "Virtual Assistant Referee", "Video Auto Review"], "correctIndex": 0 },
  { "id": 51, "question": "Quante sono le stelle sulla bandiera olimpica?", "options": ["3", "4", "5", "6"], "correctIndex": 2 },
  { "id": 52, "question": "Quale bizzarro animale interruppe una partita di Wimbledon nel 2022, costringendo i giocatori a fermarsi?", "options": ["Uno scoiattolo", "Una volpe", "Un piccione", "Un cane"], "correctIndex": 2 },
  { "id": 53, "question": "Chi ha vinto il Pallone d'Oro nel 2023?", "options": ["Haaland", "Mbappé", "Messi", "Benzema"], "correctIndex": 2 },
  { "id": 54, "options": ["Terra battuta", "Cemento", "Erba", "Sintetico"], "question": "Nel tennis, su quale superficie si gioca Wimbledon?", "correctIndex": 2 },
  { "id": 55, "question": "Quanti minuti dura un 'round' nel pugilato professionistico maschile?", "options": ["2", "3", "5", "10"], "correctIndex": 1 },
  { "id": 56, "question": "In quale città giocano i Lakers?", "options": ["Chicago", "New York", "Los Angeles", "Miami"], "correctIndex": 2 },
  { "id": 57, "question": "Quale atleta detiene il record assoluto di medaglie d'oro olimpiche?", "options": ["Usain Bolt", "Michael Phelps", "Carl Lewis", "Larisa Latynina"], "correctIndex": 1 },
  { "id": 58, "question": "Nel padel, se la palla tocca la griglia dopo il rimbalzo a terra è valida?", "options": ["Sì", "No", "Solo nel servizio", "Dipende dall'arbitro"], "correctIndex": 0 },
  { "id": 59, "question": "Chi è il miglior marcatore della storia della Nazionale Italiana di calcio?", "options": ["Riva", "Meazza", "Piola", "Del Piero"], "correctIndex": 0 },
  { "id": 60, "question": "Nel calcetto, il portiere può raccogliere con le mani un passaggio volontario di piedi di un compagno?", "options": ["Sì", "No", "Solo fuori area", "Solo se colpito di ginocchio"], "correctIndex": 1 },
  { "id": 61, "question": "Quanti sono i giocatori di una squadra di pallavolo in campo?", "options": ["5", "6", "7", "4"], "correctIndex": 1 },
  { "id": 62, "question": "Come si chiama il trofeo consegnato ai campioni della NBA?", "options": ["Larry O'Brien Trophy", "Vince Lombardi Trophy", "Stanley Cup", "World Series Trophy"], "correctIndex": 0 },
  { "id": 63, "question": "Quale tennista ha urlato la famosa frase 'You cannot be serious!' contro l'arbitro di Wimbledon?", "options": ["John McEnroe", "Bjorn Borg", "Jimmy Connors", "Andre Agassi"], "correctIndex": 0 },
  { "id": 64, "question": "Quale nazionale ha vinto l'Europeo di calcio nel 2021?", "options": ["Inghilterra", "Francia", "Spagna", "Italia"], "correctIndex": 3 },
  { "id": 65, "question": "Nel basket, che cosa si intende per 'infrazione di passi'?", "options": ["Camminare senza palleggiare", "Correre troppo velocemente", "Palleggiare con due mani", "Saltare a canestro"], "correctIndex": 0 },
  { "id": 66, "question": "Quanto è alta la rete da tennis al centro?", "options": ["0.914 m", "1.00 m", "1.10 m", "0.85 m"], "correctIndex": 0 },
  { "id": 67, "question": "Qual è il tempo massimo per tirare nel basket NBA/FIBA?", "options": ["20 secondi", "24 secondi", "30 secondi", "35 secondi"], "correctIndex": 1 },
  { "id": 68, "question": "Chi è lo 'Special One' del calcio?", "options": ["Pep Guardiola", "Jurgen Klopp", "José Mourinho", "Carlo Ancelotti"], "correctIndex": 2 },
  { "id": 69, "question": "Nel calcio, quanti cartellini gialli nello stesso match determinano l'espulsione?", "options": ["1", "2", "3", "Nessuno"], "correctIndex": 1 },
  { "id": 70, "question": "In quale città si trova il circuito automobilistico di Interlagos?", "options": ["Città del Messico", "San Paolo", "Barcellona", "Monaco"], "correctIndex": 1 },
  { "id": 71, "question": "Nel salto in alto, come si chiama la tecnica a pancia in su usata oggi?", "options": ["Ventrale", "Fosbury", "A forbice", "Tuffo"], "correctIndex": 1 },
  { "id": 72, "question": "Chi ha vinto il mondiale di F1 nel 2021 in un finale all'ultimo giro?", "options": ["Hamilton", "Verstappen", "Perez", "Bottas"], "correctIndex": 1 },
  { "id": 73, "question": "Nel calcio, a che distanza si trova il dischetto del rigore dalla linea di porta?", "options": ["9 metri", "11 metri", "12 metri", "10 metri"], "correctIndex": 1 },
  { "id": 74, "question": "Qual è il limite di falli personali prima dell'espulsione per un giocatore in una partita NBA?", "options": ["4", "5", "6", "7"], "correctIndex": 2 },
  { "id": 75, "question": "Nel calcetto, quanto dura un tempo di gioco regolamentare?", "options": ["20 minuti", "25 minuti", "30 minuti", "45 minuti"], "correctIndex": 0 },
  { "id": 76, "question": "Quale tennista italiana ha vinto lo storico Roland Garros 2010?", "options": ["Pennetta", "Schiavone", "Errani", "Vinci"], "correctIndex": 1 },
  { "id": 77, "question": "Quanti punti vale un canestro realizzato da oltre la linea dei 6.75m nel basket FIBA?", "options": ["2", "3", "4", "1"], "correctIndex": 1 },
  { "id": 78, "question": "Nel calcio, come viene sanzionato un retropassaggio di piede controllato con le mani dal portiere nella propria area?", "options": ["Calcio di rigore", "Calcio di punizione indiretto", "Espulsione", "Calcio di rinvio"], "correctIndex": 1 },
  { "id": 79, "question": "Chi è il detentore del record assoluto di presenze in Serie A?", "options": ["Del Piero", "Buffon", "Maldini", "Totti"], "correctIndex": 1 },
  { "id": 80, "question": "Quanti sono i cerchi sulla bandiera olimpica?", "options": ["4", "5", "6", "7"], "correctIndex": 1 },
  { "id": 81, "question": "Quale squadra di calcio inglese gioca le partite in casa all'Old Trafford?", "options": ["Liverpool", "Manchester City", "Manchester United", "Arsenal"], "correctIndex": 2 },
  { "id": 82, "question": "In che anno è scomparso il mitico Ayrton Senna?", "options": ["1992", "1993", "1994", "1995"], "correctIndex": 2 },
  { "id": 83, "question": "Quale tennista detiene il record per il servizio più veloce mai registrato (263.4 km/h)?", "options": ["John Isner", "Samuel Groth", "Andy Roddick", "Ivo Karlovic"], "correctIndex": 1 },
  { "id": 84, "question": "Quale nazione ha inventato le regole del calcio moderno?", "options": ["Brasile", "Italia", "Inghilterra", "Francia"], "correctIndex": 2 },
  { "id": 85, "question": "Nel tennis, cos'è un 'Ace'?", "options": ["Un fallo", "Un servizio vincente senza tocco dell'avversario", "Un colpo a rete", "Il cambio campo"], "correctIndex": 1 },
  { "id": 86, "question": "Nel basket, quale infrazione si commette interrompendo il palleggio e riprendendolo subito dopo?", "options": ["Passi", "Doppio palleggio", "Sfondamento", "Infrazione di campo"], "correctIndex": 1 },
  { "id": 87, "question": "In quale sport da combattimento si usa il termine 'ippon' per indicare la vittoria immediata?", "options": ["Karate", "Judo", "Sumo", "Scherma"], "correctIndex": 1 },
  { "id": 88, "question": "Quale città ospita le Olimpiadi invernali del 2026?", "options": ["Torino", "Milano-Cortina", "Roma", "Chamonix"], "correctIndex": 1 },
  { "id": 89, "question": "Cosa significa l'acronimo NBA?", "options": ["National Basketball Association", "National Basket Alliance", "North Basketball Association", "National Basket Academy"], "correctIndex": 0 },
  { "id": 90, "question": "Nel calcetto a 5 regolamentare, il tempo di gioco è effettivo (cronometro stoppato a palla ferma)?", "options": ["Sì", "No", "Solo negli ultimi due minuti", "Solo se lo decide l'arbitro"], "correctIndex": 0 },
  { "id": 91, "question": "Nel calcio, chi ha vinto la prima storica edizione della UEFA Conference League?", "options": ["Feyenoord", "Roma", "West Ham", "Fiorentina"], "correctIndex": 1 },
  { "id": 92, "question": "In quale anno si sono tenute le celebri Olimpiadi di Roma?", "options": ["1956", "1960", "1964", "1968"], "correctIndex": 1 },
  { "id": 93, "question": "Nel basket, qual è l'altezza ufficiale del canestro da terra?", "options": ["2.90 metri", "3.00 metri", "3.05 metri", "3.15 metri"], "correctIndex": 2 },
  { "id": 94, "question": "Chi è il tennista con più titoli del Grande Slam vinti nella storia del tennis maschile?", "options": ["Nadal", "Federer", "Djokovic", "Sampras"], "correctIndex": 2 },
  { "id": 95, "question": "In F1, qual è il punteggio assegnato al primo classificato?", "options": ["10", "15", "20", "25"], "correctIndex": 3 },
  { "id": 96, "question": "Quale squadra di basket ha il record di vittorie in una stagione regolare NBA (73-9)?", "options": ["Bulls", "Lakers", "Warriors", "Celtics"], "correctIndex": 2 },
  { "id": 97, "question": "Nel volley, si può toccare la rete con il corpo mentre la palla è in gioco?", "options": ["Sì", "No", "Solo se non intenzionale", "Solo il Libero"], "correctIndex": 1 },
  { "id": 98, "question": "Nel calcio, quanti minuti durano complessivamente i due tempi supplementari?", "options": ["20Doc minuti", "30 minuti", "40Doc minuti", "15 minuti"], "correctIndex": 1 },
  { "id": 99, "question": "Nel basket, quanti secondi può rimanere al massimo un giocatore attaccante nell'area dei tre secondi avversaria?", "options": ["3", "5", "8", "24"], "correctIndex": 0 },
  { "id": 100, "question": "Nel calcetto, da dove si calcia il tiro libero diretto concesso per il superamento del limite dei falli cumulativi?", "options": ["Dal dischetto del rigore", "Da una linea posta a 10 metri dalla porta", "Dalla metà campo", "Da dove è stato commesso il fallo"], "correctIndex": 1 }
]


