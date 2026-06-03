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

                // 1. Carichiamo le domande dal file JSON
                const response = await fetch('/questions.json');
                if (!response.ok) throw new Error("Impossibile caricare le domande");
                const allQuestions = await response.json();

                // 2. Check record su daily_game_attempts
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
                    const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
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

