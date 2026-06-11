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
    // const [domande] = useState(questions); // Carica le domande dal JSON
    const [domande] = useState(questionsMondiali); // Carica le domande dal JSON dei mondiali


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

const questionsMondiali = [
  {
    "id": 1,
    "question": "Quale paese ha ospitato e vinto la prima edizione assoluta dei Mondiali nel 1930?",
    "options": [
      "Argentina",
      "Brasile",
      "Uruguay",
      "Italia"
    ],
    "correctIndex": 2
  },
  {
    "id": 2,
    "question": "Quale nazionale di calcio ha vinto il maggior numero di Mondiali nella storia?",
    "options": [
      "Germania",
      "Italia",
      "Argentina",
      "Brasile"
    ],
    "correctIndex": 3
  },
  {
    "id": 3,
    "question": "Chi è il miglior marcatore all-time nella storia delle fasi finali dei Mondiali?",
    "options": [
      "Pelé",
      "Miroslav Klose",
      "Ronaldo il Fenomeno",
      "Gerd Müller"
    ],
    "correctIndex": 1
  },
  {
    "id": 4,
    "question": "Chi è l'unico calciatore ad aver vinto tre campionati del mondo in carriera?",
    "options": [
      "Diego Maradona",
      "Pelé",
      "Cafu",
      "Franz Beckenbauer"
    ],
    "correctIndex": 1
  },
  {
    "id": 5,
    "question": "In quale edizione dei Mondiali è stato introdotto per la prima volta l'uso del VAR?",
    "options": [
      "Brasile 2014",
      "Russia 2018",
      "Qatar 2022",
      "Sudafrica 2010"
    ],
    "correctIndex": 1
  },
  {
    "id": 6,
    "question": "Quale nazione ha vinto lo storico Mondiale di Qatar 2022 guidata da Lionel Messi?",
    "options": [
      "Francia",
      "Brasile",
      "Croazia",
      "Argentina"
    ],
    "correctIndex": 3
  },
  {
    "id": 7,
    "question": "Quanti gol ha segnato Just Fontaine nel Mondiale del 1958, stabilendo un record per una singola edizione?",
    "options": [
      "10",
      "11",
      "13",
      "15"
    ],
    "correctIndex": 2
  },
  {
    "id": 8,
    "question": "Quale bizzarro animale è stato la mascotte ufficiale dei Mondiali di Italia '90?",
    "options": [
      "Un leone antropomorfo",
      "Un pupazzo a blocchi tricolore",
      "Un cane calciatore",
      "Un gallo"
    ],
    "correctIndex": 1
  },
  {
    "id": 9,
    "question": "In quale anno e paese si è disputato il primo Mondiale in assoluto nel continente africano?",
    "options": [
      "Egitto 2006",
      "Marocco 2010",
      "Sudafrica 2010",
      "Tunisia 1998"
    ],
    "correctIndex": 2
  },
  {
    "id": 10,
    "question": "Quale squadra detiene il record negativo di aver perso più finali dei Mondiali (ben 4 volte)?",
    "options": [
      "Argentina",
      "Olanda",
      "Germania",
      "Italia"
    ],
    "correctIndex": 2
  },
  {
    "id": 11,
    "question": "Chi ha segnato il gol lampo più veloce della storia dei Mondiali dopo soli 11 secondi nel 2002?",
    "options": [
      "Hakan Şükür",
      "Clint Dempsey",
      "Bryan Robson",
      "Bernard Lacombe"
    ],
    "correctIndex": 0
  },
  {
    "id": 12,
    "question": "Nel famoso 'Maracanazo' del 1950, quale nazionale sconfisse clamorosamente il Brasile in finale?",
    "options": [
      "Argentina",
      "Uruguay",
      "Italia",
      "Svezia"
    ],
    "correctIndex": 1
  },
  {
    "id": 13,
    "question": "Chi è stato il calciatore più anziano a scendere in campo in un Mondiale (45 anni e 161 giorni)?",
    "options": [
      "Roger Milla",
      "Dino Zoff",
      "Faryd Mondragón",
      "Essam El-Hadary"
    ],
    "correctIndex": 3
  },
  {
    "id": 14,
    "question": "Quale squadra vinse il Mondiale del 1954 nel match ribattezzato 'Il miracolo di Berna'?",
    "options": [
      "Ungheria",
      "Germania Ovest",
      "Austria",
      "Brasile"
    ],
    "correctIndex": 1
  },
  {
    "id": 15,
    "question": "In quale Mondiale è stato registrato il record assoluto di cartellini rossi (28 espulsioni)?",
    "options": [
      "Francia 1998",
      "Germania 2006",
      "Corea-Giappone 2002",
      "Sudafrica 2010"
    ],
    "correctIndex": 1
  },
  {
    "id": 16,
    "question": "Quale storico capitano ha alzato la coppa del mondo per l'Italia nel Mondiale del 1982?",
    "options": [
      "Dino Zoff",
      "Gaetano Scirea",
      "Giuseppe Bergomi",
      "Claudio Gentile"
    ],
    "correctIndex": 0
  },
  {
    "id": 17,
    "question": "Chi è l'unico ad aver vinto il Mondiale sia come calciatore (1974) che come allenatore (1990) con la Germania?",
    "options": [
      "Joachim Löw",
      "Franz Beckenbauer",
      "Gerd Müller",
      "Lothar Matthäus"
    ],
    "correctIndex": 1
  },
  {
    "id": 18,
    "question": "Quale nazionale africana è stata la prima in assoluto a raggiungere le semifinali di un Mondiale (nel 2022)?",
    "options": [
      "Camerun",
      "Senegal",
      "Ghana",
      "Marocco"
    ],
    "correctIndex": 3
  },
  {
    "id": 19,
    "question": "Nel Mondiale del 1994, quale giocatore americano segnò un autogol fatale e venne tragicamente ucciso al ritorno in patria?",
    "options": [
      "Andrés Escobar",
      "Carlos Valderrama",
      "René Higuita",
      "Faustino Asprilla"
    ],
    "correctIndex": 0
  },
  {
    "id": 20,
    "question": "Quale canzone ufficiale cantata da Shakira è diventata l'inno tormentone del Mondiale 2010?",
    "options": [
      "La Copa de la Vida",
      "Waka Waka (This Time for Africa)",
      "We Are One",
      "Wavin' Flag"
    ],
    "correctIndex": 1
  },
  {
    "id": 21,
    "question": "Chi ha segnato il gol decisivo nei tempi supplementari della finale del Mondiale 2010 tra Spagna e Olanda?",
    "options": [
      "Xavi",
      "Andrés Iniesta",
      "David Villa",
      "Fernando Torres"
    ],
    "correctIndex": 1
  },
  {
    "id": 22,
    "question": "Quale clamoroso risultato si registrò nella semifinale del 2014 tra Brasile e Germania (il 'Mineirazo')?",
    "options": [
      "1-5",
      "0-4",
      "1-7",
      "2-6"
    ],
    "correctIndex": 2
  },
  {
    "id": 23,
    "question": "Chi vinse il premio come Miglior Giovane del Mondiale 2018 a soli 19 anni, vincendo anche il titolo con la Francia?",
    "options": [
      "Antoine Griezmann",
      "Paul Pogba",
      "Kylian Mbappé",
      "Ousmane Dembélé"
    ],
    "correctIndex": 2
  },
  {
    "id": 24,
    "question": "Quale nazione ha disputato più edizioni dei Mondiali senza mai saltarne nemmeno una?",
    "options": [
      "Germania",
      "Italia",
      "Argentina",
      "Brasile"
    ],
    "correctIndex": 3
  },
  {
    "id": 25,
    "question": "Chi fu l'eroe inaspettato delle notti magiche di Italia '90, vincendo il titolo di capocannoniere?",
    "options": [
      "Roberto Baggio",
      "Gianluca Vialli",
      "Totò Schillaci",
      "Alessandro Altobelli"
    ],
    "correctIndex": 2
  },
  {
    "id": 26,
    "question": "In quale edizione dei Mondiali sono stati introdotti per la prima volta i cartellini gialli e rossi?",
    "options": [
      "Inghilterra 1966",
      "Messico 1970",
      "Germania 1974",
      "Argentina 1978"
    ],
    "correctIndex": 1
  },
  {
    "id": 27,
    "question": "Chi ha segnato una tripletta in una finale di un Mondiale prima di Mbappé nel 2022?",
    "options": [
      "Geoff Hurst (1966)",
      "Pelé (1958)",
      "Zinedine Zidane (1998)",
      "Ronaldo (2002)"
    ],
    "correctIndex": 0
  },
  {
    "id": 28,
    "question": "Quale bizzarro strumento musicale rumoroso è diventato il simbolo dei Mondiali in Sudafrica nel 2010?",
    "options": [
      "Caxixi",
      "Vuvuzela",
      "Maracas",
      "Tamburo djembe"
    ],
    "correctIndex": 1
  },
  {
    "id": 29,
    "question": "Quale accoppiata di paesi ha ospitato il primo Mondiale congiunto nella storia (2002)?",
    "options": [
      "Austria e Svizzera",
      "Belgio e Olanda",
      "Corea del Sud e Giappone",
      "USA e Canada"
    ],
    "correctIndex": 2
  },
  {
    "id": 30,
    "question": "Chi è stato il CT dell'Italia campione del mondo nel 2006?",
    "options": [
      "Giovanni Trapattoni",
      "Arrigo Sacchi",
      "Marcello Lippi",
      "Cesare Prandelli"
    ],
    "correctIndex": 2
  },
  {
    "id": 31,
    "question": "Quanto dura esattamente un tempo regolamentare in una partita di calcio a 11?",
    "options": [
      "40 minuti",
      "45 minuti",
      "50 minuti",
      "60 minuti"
    ],
    "correctIndex": 1
  },
  {
    "id": 32,
    "question": "A quale distanza millimetrica si trova il dischetto del rigore dalla linea di porta?",
    "options": [
      "9,15 metri",
      "10,5 metri",
      "11 metri",
      "12 metri"
    ],
    "correctIndex": 2
  },
  {
    "id": 33,
    "question": "Qual è il numero minimo di giocatori che una squadra deve avere in campo per non perdere a tavolino?",
    "options": [
      "5 giocatori",
      "6 giocatori",
      "7 giocatori",
      "8 giocatori"
    ],
    "correctIndex": 2
  },
  {
    "id": 34,
    "question": "Nel calcio a 11, un giocatore in fuorigioco può essere sanzionato se riceve palla direttamente da rimessa laterale?",
    "options": [
      "Sì, sempre",
      "No, mai",
      "Solo se è nella propria metà campo",
      "Solo se tocca la palla di mano"
    ],
    "correctIndex": 1
  },
  {
    "id": 35,
    "question": "Come viene sanzionato un portiere che tocca la palla con le mani su retropassaggio volontario di piede di un compagno?",
    "options": [
      "Calcio di rigore",
      "Calcio di punizione indiretto",
      "Espulsione immediata",
      "Ammonizione e rimessa laterale"
    ],
    "correctIndex": 1
  },
  {
    "id": 36,
    "question": "Quanti minuti durano complessivamente i due tempi supplementari in caso di parità nei match a eliminazione diretta?",
    "options": [
      "20 minuti",
      "25 minuti",
      "30 minuti",
      "40 minuti"
    ],
    "correctIndex": 2
  },
  {
    "id": 37,
    "question": "Se un giocatore riceve un secondo cartellino giallo durante la stessa partita, cosa succede?",
    "options": [
      "Viene espulso (cartellino rosso)",
      "Viene allontanato per 10 minuti",
      "La squadra subisce un rigore",
      "Nulla, serve il terzo giallo"
    ],
    "correctIndex": 0
  },
  {
    "id": 38,
    "question": "Qual è il raggio ufficiale del cerchio di centrocampo su un campo da calcio regolamentare?",
    "options": [
      "7,15 metri",
      "8,50 metri",
      "9,15 metri",
      "11,00 metri"
    ],
    "correctIndex": 2
  },
  {
    "id": 39,
    "question": "Cosa indica l'acronimo IFAB nel mondo del calcio?",
    "options": [
      "International Football Association Board",
      "International Federation of Association Football",
      "Interregional Football Advisory Bureau",
      "Independent Football Association Body"
    ],
    "correctIndex": 0
  },
  {
    "id": 40,
    "question": "Un gol può essere segnato direttamente da una rimessa dal fondo nella porta avversaria?",
    "options": [
      "Sì",
      "No",
      "Solo se la palla rimbalza prima",
      "Solo se viene toccata dal portiere avversario"
    ],
    "correctIndex": 0
  },
  {
    "id": 41,
    "question": "Da quanti arbitri principali e assistenti (escluso il VAR) è composta la squadra arbitrale in campo in Serie A?",
    "options": [
      "3",
      "4",
      "6",
      "5"
    ],
    "correctIndex": 2
  },
  {
    "id": 42,
    "question": "Se la palla colpisce l'arbitro in campo e favorisce un'azione d'attacco pericolosa, cosa prevede il regolamento?",
    "options": [
      "Il gioco prosegue regolarmente",
      "Si interrompe il gioco e si riprende con una rimessa dell'arbitro",
      "Viene fischiato un fallo",
      "Si ripete l'azione dall'inizio"
    ],
    "correctIndex": 1
  },
  {
    "id": 44,
    "question": "Nel calcio moderno, quante sostituzioni massime sono consentite nei tempi regolamentari di una gara ufficiale?",
    "options": [
      "3",
      "4",
      "5",
      "6"
    ],
    "correctIndex": 2
  },
  {
    "id": 45,
    "question": "Quali sono le dimensioni standard (altezza e larghezza) di una porta da calcio a 11 regolamentare?",
    "options": [
      "2,44 m x 7,32 m",
      "2,50 m x 7,50 m",
      "2,20 m x 7,00 m",
      "2,44 m x 7,50 m"
    ],
    "correctIndex": 0
  },
  {
    "id": 46,
    "question": "Cosa succede se un calcio di rigore batte sul palo, torna indietro e viene calciato nuovamente dallo stesso tiratore senza tocchi altrui?",
    "options": [
      "Il gol è valido",
      "Viene fischiato un calcio di punizione indiretto per gli avversari",
      "Il rigore si ripete",
      "Rimessa dal fondo"
    ],
    "correctIndex": 1
  },
  {
    "id": 47,
    "question": "Da dove deve essere eseguito un calcio di punizione indiretto all'interno dell'area di rigore piccola?",
    "options": [
      "Dal dischetto del rigore",
      "Dalla linea dell'area piccola parallela alla linea di porta, nel punto più vicino",
      "Dall'angolo dell'area grande",
      "In qualunque punto scelto dall'arbitro"
    ],
    "correctIndex": 1
  },
  {
    "id": 48,
    "question": "Un giocatore che si toglie la maglia per festeggiare un gol viene sanzionato con:",
    "options": [
      "Un richiamo verbale",
      "Un cartellino giallo",
      "Un cartellino rosso",
      "Nessuna sanzione se il gol è decisivo"
    ],
    "correctIndex": 1
  },
  {
    "id": 49,
    "question": "Cosa decide l'arbitro se un oggetto esterno (es. un secondo pallone) tocca la palla interrompendo un gol certo?",
    "options": [
      "Assegna comunque il gol",
      "Interrompe il gioco e concede una rimessa dell'arbitro",
      "Fa ripetere l'azione",
      "Assegna un calcio di rigore"
    ],
    "correctIndex": 1
  },
  {
    "id": 50,
    "question": "Quale sanzione è prevista per un calciatore che sputa contro un avversario?",
    "options": [
      "Cartellino giallo",
      "Sostituzione obbligatoria",
      "Espulsione diretta (cartellino rosso)",
      "Sospensione della partita"
    ],
    "correctIndex": 2
  },
  {
    "id": 51,
    "question": "Se un difensore tocca deliberatamente la palla con la mano nella propria area per evitare un gol, ma la palla entra ugualmente:",
    "options": [
      "Viene concesso il gol e il difensore viene ammonito",
      "Viene concesso il gol e il difensore viene espulso",
      "Si fischia il rigore ed espulsione",
      "Si annulla l'azione"
    ],
    "correctIndex": 0
  },
  {
    "id": 52,
    "question": "In quale anno è stata abolita la regola del 'Golden Gol' nei tempi supplementari?",
    "options": [
      "2000",
      "2002",
      "2004",
      "2006"
    ],
    "correctIndex": 2
  },
  {
    "id": 53,
    "question": "Che cosa misura la tecnologia della 'Goal-Line Technology'?",
    "options": [
      "Se il pallone ha superato interamente la linea di porta",
      "La velocità del tiro",
      "La posizione di fuorigioco",
      "Il tempo effettivo di gioco"
    ],
    "correctIndex": 0
  },
  {
    "id": 54,
    "question": "Se un portiere tiene il pallone tra le mani per più di quanti secondi commette infrazione?",
    "options": [
      "5 secondi",
      "6 secondi",
      "8 secondi",
      "10 secondi"
    ],
    "correctIndex": 1
  },
  {
    "id": 55,
    "question": "Nel calcio a 11, un gol può essere segnato direttamente da una rimessa laterale?",
    "options": [
      "Sì",
      "No, mai",
      "Solo se tocca il palo",
      "Solo se eseguita con i piedi"
    ],
    "correctIndex": 1
  },
  {
    "id": 56,
    "question": "Durante un calcio di rigore, dove devono posizionarsi tutti i giocatori oltre al tiratore e al portiere?",
    "options": [
      "Fuori dall'area di rigore e dietro la linea del dischetto",
      "Fuori dall'area, fuori dalla lunetta e dietro il dischetto",
      "Sulla linea di centrocampo",
      "Dentro l'area ma distanti 5 metri"
    ],
    "correctIndex": 1
  },
  {
    "id": 57,
    "question": "Quale parte del braccio non costituisce fallo di mano se tocca il pallone involontariamente?",
    "options": [
      "L'avambraccio",
      "La spalla (fino all'ascella)",
      "Il polso",
      "Il gomito"
    ],
    "correctIndex": 1
  },
  {
    "id": 58,
    "question": "Chi è l'unico giocatore in campo che può indossare i pantaloni lunghi della tuta in una gara ufficiale?",
    "options": [
      "Il capitano",
      "Il portiere",
      "Il trequartista",
      "Nessuno, sono vietati"
    ],
    "correctIndex": 1
  },
  {
    "id": 59,
    "question": "Cosa succede se un portiere calcia un rinvio dal fondo direttamente nella propria porta senza tocchi?",
    "options": [
      "È gol dell'avversario",
      "Si ripete il rinvio",
      "Viene assegnato un calcio d'angolo agli avversari",
      "Calcio di rigore contro"
    ],
    "correctIndex": 2
  },
  {
    "id": 60,
    "question": "Qual è il peso regolamentare standard di un pallone da calcio all'inizio della partita?",
    "options": [
      "310-360 grammi",
      "410-450 grammi",
      "500-550 grammi",
      "600 grammi"
    ],
    "correctIndex": 1
  },
  {
    "id": 61,
    "question": "Quanti giocatori compongono una squadra di calcetto (futsal) in campo durante il gioco?",
    "options": [
      "4",
      "5",
      "6",
      "7"
    ],
    "correctIndex": 1
  },
  {
    "id": 62,
    "question": "Nel calcio a 5 regolamentare (futsal FIFA), com'è gestito il tempo di gioco?",
    "options": [
      "Due tempi da 20 minuti effettivi",
      "Due tempi da 25 minuti non effettivi",
      "Due tempi da 30 minuti effettivi",
      "Un tempo unico da 40 minuti"
    ],
    "correctIndex": 0
  },
  {
    "id": 63,
    "question": "Nel futsal, come viene battuta la rimessa laterale quando la palla esce dal campo?",
    "options": [
      "Con le mani",
      "Con i piedi, posizionando la palla sulla linea",
      "Con la testa",
      "Esclusivamente dal portiere"
    ],
    "correctIndex": 1
  },
  {
    "id": 64,
    "question": "Quanti falli cumulativi può commettere una squadra in un tempo prima di concedere il tiro libero diretto senza barriera?",
    "options": [
      "4 falli",
      "5 falli",
      "6 falli",
      "7 falli"
    ],
    "correctIndex": 1
  },
  {
    "id": 65,
    "question": "Da quale distanza metrica viene calciato il 'tiro libero' nel calcio a 5 regolamentare?",
    "options": [
      "9 metri",
      "10 metri",
      "11 metri",
      "12 metri"
    ],
    "correctIndex": 1
  },
  {
    "id": 66,
    "question": "Se un giocatore viene espulso nel calcio a 5, dopo quanti minuti di penalità la squadra può reinserire un sostituto?",
    "options": [
      "1 minuto",
      "2 minuti (o subito se subisce gol)",
      "5 minuti",
      "Non può più inserire nessuno"
    ],
    "correctIndex": 1
  },
  {
    "id": 67,
    "question": "Nel futsal, quanti secondi massimi ha un giocatore per riprendere il gioco (punizioni, rimesse)?",
    "options": [
      "3 secondi",
      "4 secondi",
      "5 secondi",
      "6 secondi"
    ],
    "correctIndex": 1
  },
  {
    "id": 68,
    "question": "Nel calcio a 5, il portiere può raccogliere con le mani un passaggio volontario di piedi di un compagno?",
    "options": [
      "Sì, sempre",
      "No, mai",
      "Solo se è dentro l'area piccola",
      "Solo se la palla proviene dalla metà campo avversaria"
    ],
    "correctIndex": 1
  },
  {
    "id": 69,
    "question": "Nelle partite di calcetto amatoriale tra amici, chi è il giocatore che coordina la difesa e sta davanti al portiere?",
    "options": [
      "Il Pivot",
      "L'Ala",
      "Il Centrale (o Ultimo)",
      "Il Laterale"
    ],
    "correctIndex": 2
  },
  {
    "id": 70,
    "question": "Come viene chiamato il ruolo del giocatore d'attacco nel calcio a 5, corrispondente al centravanti?",
    "options": [
      "Centrale",
      "Laterale",
      "Pivot",
      "Boa"
    ],
    "correctIndex": 2
  },
  {
    "id": 71,
    "question": "Nel calcio a 5 regolamentare, quante sostituzioni massime si possono fare durante un match?",
    "options": [
      "5 sostituzioni",
      "7 sostituzioni",
      "9 sostituzioni",
      "Illimitate ('volanti')"
    ],
    "correctIndex": 3
  },
  {
    "id": 72,
    "question": "Quale tattica prevede l'avanzamento del portiere nella metà campo avversaria per creare superiorità numerica?",
    "options": [
      "Portiere di movimento",
      "Power play asimmetrico",
      "Falso portiere",
      "Tiki-taka futsal"
    ],
    "correctIndex": 0
  },
  {
    "id": 73,
    "question": "La rimessa dal fondo da parte del portiere nel futsal regolamentare deve essere effettuata:",
    "options": [
      "Con i piedi",
      "Con le mani lanciando la palla direttamente",
      "Sia con le mani che con i piedi",
      "Solo lasciando cadere la palla"
    ],
    "correctIndex": 1
  },
  {
    "id": 74,
    "question": "Quale nazione ha vinto il maggior numero di Mondiali di Futsal FIFA nella storia?",
    "options": [
      "Spagna",
      "Argentina",
      "Brasile",
      "Portogallo"
    ],
    "correctIndex": 2
  },
  {
    "id": 75,
    "question": "Un gol può essere segnato direttamente su calcio d'inizio nel calcio a 5?",
    "options": [
      "Sì, dal 2014",
      "No, mai",
      "Solo se la palla tocca un palo",
      "Solo nei campionati amatoriali"
    ],
    "correctIndex": 1
  },
  {
    "id": 76,
    "question": "Nel calcio a 5, la scivolata per contrastare un avversario che ha il possesso di palla è:",
    "options": [
      "Sempre regolare",
      "Vietata nel regolamento internazionale FIFA (falsa credenza, è concessa se pulita)",
      "Sempre sanzionata con rigore",
      "Consentita solo al portiere"
    ],
    "correctIndex": 0
  },
  {
    "id": 77,
    "question": "Quali sono le dimensioni standard delle porte da calcio a 5 regolamentari?",
    "options": [
      "2 metri d'altezza x 3 metri di larghezza",
      "2,44 metri x 5 metri",
      "1,80 metri x 3 metri",
      "2 metri x 4 metri"
    ],
    "correctIndex": 0
  },
  {
    "id": 78,
    "question": "Qual è la caratteristica principale del pallone da futsal a rimbalzo controllato?",
    "options": [
      "È più grande di quello da calcio a 11",
      "È riempito d'acqua",
      "Ha una camera d'aria contenente materiale che riduce il rimbalzo",
      "È fatto interamente di gomma piena"
    ],
    "correctIndex": 2
  },
  {
    "id": 79,
    "question": "Nel futsal, i timeout a disposizione per squadra sono:",
    "options": [
      "Uno per ogni tempo di gioco, della durata di 1 minuto",
      "Due per tempo",
      "Nessuno, decide tutto l'arbitro",
      "Uno solo per tutta la partita"
    ],
    "correctIndex": 0
  },
  {
    "id": 80,
    "question": "Chi è considerato il giocatore di futsal più forte di tutti i tempi, celebre per i suoi colpi impossibili col Portogallo e club?",
    "options": [
      "Falcão",
      "Ricardinho",
      "Ferrao",
      "Manoel Tobias"
    ],
    "correctIndex": 1
  },
  {
    "id": 81,
    "question": "Quale squadra di calcio italiana detiene il record di scudetti vinti nella storia della Serie A?",
    "options": [
      "Inter",
      "Milan",
      "Juventus",
      "Torino"
    ],
    "correctIndex": 2
  },
  {
    "id": 82,
    "question": "Quale club ha vinto la prima storica edizione della UEFA Conference League nel 2022 a Tirana?",
    "options": [
      "Feyenoord",
      "Fiorentina",
      "West Ham",
      "Roma"
    ],
    "correctIndex": 3
  },
  {
    "id": 83,
    "question": "Chi è l'allenatore con il record assoluto di UEFA Champions League vinte in carriera (ben 5 volte)?",
    "options": [
      "Pep Guardiola",
      "Carlo Ancelotti",
      "Zinedine Zidane",
      "Alex Ferguson"
    ],
    "correctIndex": 1
  },
  {
    "id": 84,
    "question": "In quale stadio inglese si gioca tradizionalmente la finale della FA Cup?",
    "options": [
      "Old Trafford",
      "Anfield",
      "Wembley",
      "Emirates Stadium"
    ],
    "correctIndex": 2
  },
  {
    "id": 85,
    "question": "Quale club inglese è soprannominato 'The Red Devils'?",
    "options": [
      "Liverpool",
      "Arsenal",
      "Manchester United",
      "Crawley Town"
    ],
    "correctIndex": 2
  },
  {
    "id": 86,
    "question": "Quale calciatore è soprannominato 'La Pulce' per via della sua statura e agilità devastante?",
    "options": [
      "Cristiano Ronaldo",
      "Lionel Messi",
      "Neymar Jr",
      "Paulo Dybala"
    ],
    "correctIndex": 1
  },
  {
    "id": 87,
    "question": "Nel 2004, quale squadra guidata da José Mourinho vinse incredibilmente la Champions League?",
    "options": [
      "Monaco",
      "Porto",
      "Chelsea",
      "Inter"
    ],
    "correctIndex": 1
  },
  {
    "id": 88,
    "question": "Quale giocatore detiene il record di gol segnati in un singolo anno solare (91 gol nel 2012)?",
    "options": [
      "Cristiano Ronaldo",
      "Robert Lewandowski",
      "Lionel Messi",
      "Erling Haaland"
    ],
    "correctIndex": 2
  },
  {
    "id": 89,
    "question": "Quale incredibile squadra inglese vinse la Premier League nel 2016 compiendo un miracolo quotato 5000 a 1?",
    "options": [
      "Tottenham",
      "Leicester City",
      "West Ham",
      "Southampton"
    ],
    "correctIndex": 1
  },
  {
    "id": 90,
    "question": "Quale portiere è famoso per aver parato un tiro eseguendo il leggendario 'colpo dello scorpione' nel 1995?",
    "options": [
      "René Higuita",
      "José Luis Chilavert",
      "Jorge Campos",
      "Claudio Taffarel"
    ],
    "correctIndex": 0
  },
  {
    "id": 91,
    "question": "Chi è il miglior marcatore all-time nella storia della UEFA Champions League?",
    "options": [
      "Lionel Messi",
      "Cristiano Ronaldo",
      "Robert Lewandowski",
      "Karim Benzema"
    ],
    "correctIndex": 1
  },
  {
    "id": 92,
    "question": "Quale bizzarro episodio vide protagonista Luis Suárez nei confronti di Giorgio Chiellini al Mondiale 2014?",
    "options": [
      "Gli diede una testata",
      "Gli diede un morso sulla spalla",
      "Gli rubò una scarpa",
      "Gli fece uno sgambetto vistoso"
    ],
    "correctIndex": 1
  },
  {
    "id": 93,
    "question": "Quale squadra italiana è conosciuta storicamente con il soprannome di 'I Mastini' o 'I Scaligeri'?",
    "options": [
      "Chievo Verona",
      "Hellas Verona",
      "Vicenza",
      "Venezia"
    ],
    "correctIndex": 1
  },
  {
    "id": 94,
    "question": "Quale calciatore italiano ha vinto il Pallone d'Oro nel 1993 trascinando anche la Juventus?",
    "options": [
      "Roberto Baggio",
      "Paolo Maldini",
      "Franco Baresi",
      "Alessandro Del Piero"
    ],
    "correctIndex": 0
  },
  {
    "id": 95,
    "question": "Nel 2010, quale squadra italiana ha conquistato lo storico 'Triplete' (Scudetto, Coppa Italia, Champions)?",
    "options": [
      "Milan",
      "Juventus",
      "Inter",
      "Roma"
    ],
    "correctIndex": 2
  },
  {
    "id": 96,
    "question": "Quale calciatore svedese è famoso per le sue citazioni stravaganti in terza persona e gol acrobatici pazzeschi?",
    "options": [
      "Henrik Larsson",
      "Zlatan Ibrahimović",
      "Alexander Isak",
      "Emil Forsberg"
    ],
    "correctIndex": 1
  },
  {
    "id": 97,
    "question": "In che anno la Nazionale Italiana ha vinto l'Europeo battendo l'Inghilterra ai rigori a Wembley?",
    "options": [
      "2018",
      "2019",
      "2021",
      "2022"
    ],
    "correctIndex": 2
  },
  {
    "id": 98,
    "question": "Quale leggendario difensore del Milan e della Nazionale ha indossato la maglia numero 3 per tutta la carriera?",
    "options": [
      "Franco Baresi",
      "Alessandro Costacurta",
      "Paolo Maldini",
      "Mauro Tassotti"
    ],
    "correctIndex": 2
  },
  {
    "id": 99,
    "question": "Quale bizzarra esultanza esegue Cristiano Ronaldo dopo ogni suo gol, gridando insieme al pubblico?",
    "options": [
      "The Robot",
      "Il 'Siuuu'",
      "La capriola all'indietro",
      "Il ballo della foca"
    ],
    "correctIndex": 1
  },
  {
    "id": 100,
    "question": "Chi è l'unico portiere nella storia del calcio ad aver vinto il Pallone d'Oro (nel 1963)?",
    "options": [
      "Gianluigi Buffon",
      "Lev Jašin",
      "Dino Zoff",
      "Iker Casillas"
    ],
    "correctIndex": 1
  },
  {
    "id": 101,
    "question": "Quale squadra spagnola gioca le sue partite casalinghe nello stadio 'San Mamés', soprannominato 'La Cattedrale'?",
    "options": [
      "Real Sociedad",
      "Athletic Bilbao",
      "Sevilla",
      "Valencia"
    ],
    "correctIndex": 1
  },
  {
    "id": 102,
    "question": "Chi è il miglior marcatore della storia della Nazionale Italiana di calcio maschile con 35 reti?",
    "options": [
      "Gigi Riva",
      "Giuseppe Meazza",
      "Roberto Baggio",
      "Alessandro Del Piero"
    ],
    "correctIndex": 0
  },
  {
    "id": 103,
    "question": "Nel 2006, quale giocatore subì la famosa testata di Zinedine Zidane durante la finale dei Mondiali?",
    "options": [
      "Fabio Cannavaro",
      "Marco Materazzi",
      "Gennaro Gattuso",
      "Gianluca Zambrotta"
    ],
    "correctIndex": 1
  },
  {
    "id": 104,
    "question": "Quale storico club scozzese condivide con il Celtic l'accesa rivalità calcistica di Glasgow denominata 'Old Firm'?",
    "options": [
      "Aberdeen",
      "Hearts",
      "Rangers",
      "Hibernian"
    ],
    "correctIndex": 2
  },
  {
    "id": 105,
    "question": "Quale calciatore brasiliano era soprannominato 'O Rei'?",
    "options": [
      "Ronaldo",
      "Garrincha",
      "Pelé",
      "Ronaldinho"
    ],
    "correctIndex": 2
  },
  {
    "id": 106,
    "question": "Quale squadra tedesca disputa il caldissimo 'Klassiker' contro il Bayern Monaco?",
    "options": [
      "Bayer Leverkusen",
      "Borussia Dortmund",
      "Schalke 04",
      "Eintracht Francoforte"
    ],
    "correctIndex": 1
  },
  {
    "id": 107,
    "question": "Quale ex calciatore inglese è diventato un'icona globale di stile ed è proprietario dell'Inter Miami?",
    "options": [
      "Wayne Rooney",
      "David Beckham",
      "Steven Gerrard",
      "Frank Lampard"
    ],
    "correctIndex": 1
  },
  {
    "id": 108,
    "question": "Quale club argentino è famoso per la sua rivalità infuocata con il River Plate nel 'Superclásico'?",
    "options": [
      "Racing Club",
      "Independiente",
      "Boca Juniors",
      "San Lorenzo"
    ],
    "correctIndex": 2
  },
  {
    "id": 109,
    "question": "Chi ha vinto il Pallone d'Oro 2024, coronando una stagione straordinaria tra club e nazionale?",
    "options": [
      "Vinícius Júnior",
      "Rodri",
      "Jude Bellingham",
      "Kylian Mbappé"
    ],
    "correctIndex": 1
  },
  {
    "id": 110,
    "question": "Quale giocatore è celebre per aver sbagliato l'ultimo rigore dell'Italia nella finale di Pasadena a USA '94?",
    "options": [
      "Franco Baresi",
      "Daniele Massaro",
      "Roberto Baggio",
      "Gianfranco Zola"
    ],
    "correctIndex": 2
  },
  {
    "id": 111,
    "question": "Nel basket regolamentare, quanti punti vale un canestro realizzato tirando da oltre la linea dei 6,75 metri (FIBA)?",
    "options": [
      "1 punto",
      "2 punti",
      "3 punti",
      "4 punti"
    ],
    "correctIndex": 2
  },
  {
    "id": 112,
    "question": "Quale leggendario giocatore dei Chicago Bulls ha vinto 6 anelli NBA ed è considerato un'icona planetaria?",
    "options": [
      "LeBron James",
      "Kobe Bryant",
      "Michael Jordan",
      "Magic Johnson"
    ],
    "correctIndex": 2
  },
  {
    "id": 113,
    "question": "Nel basket NBA, qual è il limite massimo di falli personali che un giocatore può commettere prima di essere espulso?",
    "options": [
      "4 falli",
      "5 falli",
      "6 falli",
      "7 falli"
    ],
    "correctIndex": 2
  },
  {
    "id": 114,
    "question": "Qual è l'altezza ufficiale millimetrica del canestro da basket rispetto al pavimento?",
    "options": [
      "2,90 metri",
      "3,00 metri",
      "3,05 metri",
      "3,15 metri"
    ],
    "correctIndex": 2
  },
  {
    "id": 115,
    "question": "Quale squadra NBA detiene (insieme ai Boston Celtics) il record storico di titoli vinti?",
    "options": [
      "Golden State Warriors",
      "Chicago Bulls",
      "Los Angeles Lakers",
      "Miami Heat"
    ],
    "correctIndex": 2
  },
  {
    "id": 116,
    "question": "Quale infrazione commette un giocatore di basket se cammina o corre muovendo i piedi senza palleggiare?",
    "options": [
      "Doppio palleggio",
      "Infrazione di passi",
      "Sfondamento",
      "Infrazione di campo"
    ],
    "correctIndex": 1
  },
  {
    "id": 117,
    "question": "Quanti secondi ha a disposizione una squadra per effettuare un tiro e toccare il ferro del canestro prima del fischio?",
    "options": [
      "14 secondi",
      "24 secondi",
      "30 secondi",
      "35 secondi"
    ],
    "correctIndex": 1
  },
  {
    "id": 118,
    "question": "Chi è lo straordinario tiratore dei Golden State Warriors che ha rivoluzionato il gioco con i suoi canestri da tre punti?",
    "options": [
      "Kevin Durant",
      "Stephen Curry",
      "Klay Thompson",
      "James Harden"
    ],
    "correctIndex": 1
  },
  {
    "id": 119,
    "question": "Quale giocatore, tragicamente scomparso nel 2020, era soprannominato 'The Black Mamba'?",
    "options": [
      "Shaquille O'Neal",
      "Kobe Bryant",
      "Allen Iverson",
      "Dwyane Wade"
    ],
    "correctIndex": 1
  },
  {
    "id": 120,
    "question": "Cosa si intende per 'Draft' nel sistema della NBA?",
    "options": [
      "Il tabellone dei playoff",
      "L'evento annuale in cui le squadre selezionano i migliori giovani giocatori provenienti dal college o dall'estero",
      "Il mercato delle riparazioni invernale",
      "La squalifica per doping"
    ],
    "correctIndex": 1
  },
  {
    "id": 121,
    "question": "Quanti tempi (quarti) si giocano in una partita di basket ufficiale NBA o FIBA?",
    "options": [
      "2 quarti",
      "3 quarti",
      "4 quarti",
      "5 quarti"
    ],
    "correctIndex": 2
  },
  {
    "id": 122,
    "question": "Quale squadra NBA ha stabilito il record assoluto di vittorie in una singola regular season (73-9) nel 2016?",
    "options": [
      "Chicago Bulls",
      "San Antonio Spurs",
      "Golden State Warriors",
      "Cleveland Cavaliers"
    ],
    "correctIndex": 2
  },
  {
    "id": 123,
    "question": "Quanti secondi massimi può rimanere un giocatore attaccante fermo nell'area colorata avversaria senza commettere infrazione?",
    "options": [
      "3 secondi",
      "5 secondi",
      "8 secondi",
      "10 secondi"
    ],
    "correctIndex": 0
  },
  {
    "id": 124,
    "question": "Chi è stato il primo storico giocatore italiano a vincere un anello NBA (con i San Antonio Spurs nel 2014)?",
    "options": [
      "Andrea Bargnani",
      "Danilo Gallinari",
      "Marco Belinelli",
      "Luigi Datome"
    ],
    "correctIndex": 2
  },
  {
    "id": 125,
    "question": "Nel basket, quanti falli cumulativi di squadra devono essere commessi in un quarto prima che scatti il 'Bonus' dei tiri liberi automatici?",
    "options": [
      "3 falli",
      "4 falli",
      "5 falli",
      "6 falli"
    ],
    "correctIndex": 1
  },
  {
    "id": 126,
    "question": "Chi è lo storico e pittoresco allenatore NBA famoso per i suoi metodi 'Zen' e i 11 anelli vinti in panchina?",
    "options": [
      "Gregg Popovich",
      "Pat Riley",
      "Phil Jackson",
      "Steve Kerr"
    ],
    "correctIndex": 2
  },
  {
    "id": 127,
    "question": "Quale fenomenale centro europeo, soprannominato 'The Joker', ha vinto molteplici MVP con i Denver Nuggets?",
    "options": [
      "Luka Dončić",
      "Giannis Antetokounmpo",
      "Nikola Jokić",
      "Joel Embiid"
    ],
    "correctIndex": 2
  },
  {
    "id": 128,
    "question": "Quale bizzarra e spettacolare squadra esibizione gira il mondo intrattenendo i fan con sketch e canestri impossibili?",
    "options": [
      "Washington Generals",
      "Harlem Globetrotters",
      "New York Knicks",
      "Boston Breakers"
    ],
    "correctIndex": 1
  },
  {
    "id": 129,
    "question": "Nel basket FIBA (regolamento internazionale), un quarto di gioco dura esattamente:",
    "options": [
      "8 minuti",
      "10 minuti",
      "12 minuti",
      "15 minuti"
    ],
    "correctIndex": 1
  },
  {
    "id": 130,
    "question": "Cosa deve fare un giocatore se interrompe il palleggio, blocca la palla e poi ricomincia a palleggiare?",
    "options": [
      "Nulla, il gioco prosegue",
      "Subisce un fallo tecnico",
      "Viene fischiata l'infrazione di 'doppio palleggio'",
      "La palla va contesa a centrocampo"
    ],
    "correctIndex": 2
  },
  {
    "id": 131,
    "question": "Quale leggenda NBA detiene il record imbattuto di aver segnato 100 punti in una sola partita nel 1962?",
    "options": [
      "Wilt Chamberlain",
      "Kareem Abdul-Jabbar",
      "Larry Bird",
      "Bill Russell"
    ],
    "correctIndex": 0
  },
  {
    "id": 132,
    "question": "Cosa succede se una partita di basket si trova in perfetto pareggio alla fine dei quattro quarti regolamentari?",
    "options": [
      "La partita finisce in pareggio",
      "Si gioca un tempo supplementare di 5 minuti",
      "Si fanno i tiri liberi a oltranza",
      "Vince chi ha commesso meno falli"
    ],
    "correctIndex": 1
  },
  {
    "id": 133,
    "question": "Come si chiama il trofeo ufficiale che viene sollevato dalla squadra vincitrice delle Finals NBA?",
    "options": [
      "Vince Lombardi Trophy",
      "Larry O'Brien Trophy",
      "Stanley Cup",
      "Larry Bird Cup"
    ],
    "correctIndex": 1
  },
  {
    "id": 134,
    "question": "Quanti secondi massimi ha una squadra di basket per far superare il pallone dalla propria metà campo a quella d'attacco?",
    "options": [
      "5 secondi",
      "8 secondi",
      "10 secondi",
      "12 secondi"
    ],
    "correctIndex": 1
  },
  {
    "id": 135,
    "question": "Quale spettacolare azione si compie quando un giocatore salta e spinge con violenza e forza la palla direttamente dentro il canestro?",
    "options": [
      "Un Layup",
      "Un Flaunt",
      "Una Schiacciata (Dunk)",
      "Un gancio"
    ],
    "correctIndex": 2
  },
  {
    "id": 136,
    "question": "Come viene denominato il punteggio iniziale di 0-0 all'interno di un game nel tennis?",
    "options": [
      "Zero-Zero",
      "Love-All",
      "Nil",
      "Blank"
    ],
    "correctIndex": 1
  },
  {
    "id": 137,
    "question": "Quale tennista italiano ha fatto la storia conquistando la vetta del ranking mondiale ATP nel 2024?",
    "options": [
      "Matteo Berrettini",
      "Jannik Sinner",
      "Lorenzo Musetti",
      "Fabio Fognini"
    ],
    "correctIndex": 1
  },
  {
    "id": 138,
    "question": "Su quale iconica superficie naturale si disputano gli storici incontri del torneo di Wimbledon a Londra?",
    "options": [
      "Terra battuta",
      "Cemento",
      "Erba",
      "Resina acrilica"
    ],
    "correctIndex": 2
  },
  {
    "id": 139,
    "question": "Chi detiene il record assoluto maschile per il maggior numero di titoli del Grande Slam vinti in carriera?",
    "options": [
      "Roger Federer",
      "Rafael Nadal",
      "Novak Djokovic",
      "Pete Sampras"
    ],
    "correctIndex": 2
  },
  {
    "id": 140,
    "question": "Cosa si intende per 'Ace' nel mondo del tennis?",
    "options": [
      "Un colpo che prende il nastro della rete ed esce",
      "Un servizio vincente nel quale l'avversario non riesce nemmeno a toccare la palla",
      "Un errore gratuito di dritto",
      "Il punto decisivo del match"
    ],
    "correctIndex": 1
  },
  {
    "id": 141,
    "question": "Nel tennis, cosa succede immediatamente se il punteggio di un game si attesta sul 40-40?",
    "options": [
      "Si gioca un tie-break",
      "Si va ai vantaggi ('Deuce')",
      "Chi fa il punto successivo vince il set",
      "Si cambia campo"
    ],
    "correctIndex": 1
  },
  {
    "id": 142,
    "question": "Quale leggendario tennista svizzero, ritiratosi nel 2022, è considerato l'emblema dell'eleganza stilistica in campo?",
    "options": [
      "Roger Federer",
      "Stan Wawrinka",
      "Stefan Edberg",
      "Björn Borg"
    ],
    "correctIndex": 0
  },
  {
    "id": 143,
    "question": "Quanti tornei compongono il prestigioso circuito del 'Grande Slam' ogni anno?",
    "options": [
      "3 tornei",
      "4 tornei",
      "5 tornei",
      "6 tornei"
    ],
    "correctIndex": 1
  },
  {
    "id": 144,
    "question": "Quale tennista spagnolo è soprannominato 'Il Re della Terra Battuta' per via dei suoi innumerevoli trionfi al Roland Garros?",
    "options": [
      "Carlos Alcaraz",
      "Rafael Nadal",
      "David Ferrer",
      "Juan Carlos Ferrero"
    ],
    "correctIndex": 1
  },
  {
    "id": 145,
    "question": "Quale celebre frase urlò furiosamente John McEnroe contro un arbitro di sedia a Wimbledon nel 1981, diventando un mito?",
    "options": [
      "You are crazy!",
      "You cannot be serious!",
      "Check the ball!",
      "I am the champion!"
    ],
    "correctIndex": 1
  },
  {
    "id": 146,
    "question": "Nel tennis, fino a quale punteggio minimo si gioca un classico 'Tie-break' per decretare il vincitore del set?",
    "options": [
      "Fino a 5 punti",
      "Fino a 7 punti (con scarto di 2)",
      "Fino a 10 punti",
      "Fino a 15 punti"
    ],
    "correctIndex": 1
  },
  {
    "id": 147,
    "question": "Quale straordinaria tennista americana ha dominato il circuito femminile vincendo 23 titoli del Grande Slam nell'era Open?",
    "options": [
      "Venus Williams",
      "Serena Williams",
      "Steffi Graf",
      "Maria Sharapova"
    ],
    "correctIndex": 1
  },
  {
    "id": 148,
    "question": "Quale bizzarro animale ha interrotto momentaneamente un match a Wimbledon, camminando sul rettangolo di gioco?",
    "options": [
      "Un piccione",
      "Uno scoiattolo",
      "Una volpe",
      "Un gatto randagio"
    ],
    "correctIndex": 0
  },
  {
    "id": 149,
    "question": "Quale prestigiosa competizione internazionale a squadre nel tennis maschile corrisponde al 'Mondiale per nazioni'?",
    "options": [
      "ATP Finals",
      "Laver Cup",
      "Coppa Davis",
      "United Cup"
    ],
    "correctIndex": 2
  },
  {
    "id": 150,
    "question": "Qual è l'altezza ufficiale millimetrica della rete da tennis misurata precisamente al centro del campo?",
    "options": [
      "0,914 metri",
      "1,00 metro",
      "1,05 metri",
      "1,10 metri"
    ],
    "correctIndex": 0
  }
]


