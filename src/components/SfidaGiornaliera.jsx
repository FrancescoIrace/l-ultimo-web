import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, CheckCircle2, XCircle, Trophy, Brain, ChevronLeft, Clock } from 'lucide-react';
import Loader from './Loader';
import { supabase } from '../lib/supabase';
import { useDailyQuizStatus } from '../hooks/useDailyQuizStatus';

export default function SfidaGiornaliera() {
    const navigate = useNavigate();
    const dailyQuizStatus = useDailyQuizStatus();
    const [status, setStatus] = useState('LOADING'); // LOADING, ALREADY_PLAYED, PLAYING, RESULTS, ERROR
    const [quizSet, setQuizSet] = useState([]);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [score, setScore] = useState(0);
    const [earnedPoints, setEarnedPoints] = useState(0);
    const [streakDays, setStreakDays] = useState(0);
    const [streakBonus, setStreakBonus] = useState(0);
    const [answers, setAnswers] = useState([]);
    const [timeLeft, setTimeLeft] = useState(30);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        const loadQuiz = async () => {
            if (dailyQuizStatus.status === 'LOADING') return;

            if (dailyQuizStatus.status === 'UNAUTHENTICATED') {
                navigate('/');
                return;
            }

            if (dailyQuizStatus.status === 'ALREADY_PLAYED') {
                setStatus('ALREADY_PLAYED');
                return;
            }

            if (dailyQuizStatus.status === 'ERROR') {
                setStatus('ERROR');
                return;
            }

            // AVAILABLE: le domande vivono nel DB (public.quiz_questions), il client riceve
            // solo id/domanda/opzioni, mai la risposta corretta (vedi migrazione
            // 20260715120000_quiz_questions_table.sql).
            try {
                const { data: pool, error: poolError } = await supabase
                    .from('quiz_questions')
                    .select('id, question, options');

                if (poolError) throw poolError;

                const shuffled = [...(pool || [])].sort(() => 0.5 - Math.random());
                setQuizSet(shuffled.slice(0, 3));
                setStatus('PLAYING');
            } catch (err) {
                console.error("Errore inizializzazione Sfida:", err);
                setStatus('ERROR');
            }
        };

        loadQuiz();
    }, [dailyQuizStatus.status, navigate]);

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

        const currentQuestion = quizSet[currentIdx];

        // La correttezza non e' nota lato client (correct_index non viene mai inviato
        // prima della risposta): si scopre solo dalla risposta della RPC a fine quiz.
        const newAnswers = [...answers, {
            questionId: currentQuestion.id,
            question: currentQuestion.question,
            options: currentQuestion.options,
            selectedIndex,
        }];
        setAnswers(newAnswers);

        // Passa alla prossima o finisci
        if (currentIdx < 2) {
            setCurrentIdx(prev => prev + 1);
            setTimeLeft(30); // Reset timer per la nuova domanda
        } else {
            // FINE DEL QUIZ - SALVATAGGIO
            await finalizeGame(newAnswers);
        }
    };

    const finalizeGame = async (finalAnswers) => {
        setIsProcessing(true);
        try {
            // Il server calcola il punteggio dalle risposte effettive (join con
            // quiz_questions.correct_index) e salva punti/tentativo in modo atomico
            // (vedi migrazione 20260715140000_secure_daily_quiz_answers_rpc.sql).
            const p_answers = finalAnswers.map(a => ({
                question_id: a.questionId,
                selected_index: a.selectedIndex,
            }));
            const { data, error } = await supabase.rpc('submit_daily_quiz_answers', { p_answers });
            if (error) throw error;

            const result = data?.[0];
            const resultsByQuestionId = new Map(
                (result?.results || []).map(r => [r.question_id, r])
            );
            const mergedAnswers = finalAnswers.map(a => {
                const r = resultsByQuestionId.get(a.questionId);
                return {
                    ...a,
                    correctIndex: r?.correct_index,
                    isCorrect: r?.is_correct ?? false,
                };
            });

            setAnswers(mergedAnswers);
            setScore(result?.score ?? 0);
            setEarnedPoints(result?.points_awarded ?? 0);
            setStreakDays(result?.streak_days ?? 0);
            setStreakBonus(result?.streak_bonus ?? 0);
            setStatus('RESULTS');
        } catch (err) {
            console.error("Errore salvataggio finale:", err);
            setStatus('ERROR');
        } finally {
            setIsProcessing(false);
        }
    };

    // ----- RENDER CONDITIONS ----- //

    if (status === 'LOADING') {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
                <Loader variant="inline" size={48} className="mb-4" />
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
                    <p className="text-slate-600 mb-4 font-medium px-4">
                        Hai già risposto alla sfida di oggi! Torna domani per sbloccare un nuovo quiz e accumulare altri punti.
                    </p>
                    {dailyQuizStatus.streakDays > 0 && (
                        <p className="text-amber-600 font-bold mb-4">
                            🔥 Streak di {dailyQuizStatus.streakDays} {dailyQuizStatus.streakDays === 1 ? 'giorno' : 'giorni'} consecutivi. Non fermarti!
                        </p>
                    )}
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
                        {streakBonus > 0 && (
                            <p className="text-amber-600 font-bold text-sm mt-2">
                                🔥 Streak di {streakDays} {streakDays === 1 ? 'giorno' : 'giorni'} consecutivi: +{streakBonus} punti bonus!
                            </p>
                        )}
                    </div>

                    {isPerfect && (
                        <p className="text-emerald-600 font-bold mb-6 animate-bounce">🔥 Campione del Giorno! 🔥</p>
                    )}

                    <div className="w-full text-left mb-8 space-y-3">
                        {answers.map((a, i) => (
                            <div key={i} className={`bg-white rounded-2xl p-4 shadow-sm border ${a.isCorrect ? 'border-emerald-100' : 'border-red-100'}`}>
                                <div className="flex items-start gap-2 mb-2">
                                    {a.isCorrect ? (
                                        <CheckCircle2 className="text-emerald-500 flex-shrink-0 mt-0.5" size={18} />
                                    ) : (
                                        <XCircle className="text-red-500 flex-shrink-0 mt-0.5" size={18} />
                                    )}
                                    <p className="text-sm font-bold text-slate-800 leading-snug">{a.question}</p>
                                </div>
                                <p className="text-xs text-slate-500 pl-6">
                                    Risposta corretta: <span className="font-bold text-emerald-600">{a.options[a.correctIndex]}</span>
                                </p>
                                {!a.isCorrect && a.selectedIndex >= 0 && (
                                    <p className="text-xs text-slate-500 pl-6 mt-0.5">
                                        La tua risposta: <span className="font-bold text-red-500">{a.options[a.selectedIndex]}</span>
                                    </p>
                                )}
                                {!a.isCorrect && a.selectedIndex === -1 && (
                                    <p className="text-xs text-slate-500 pl-6 mt-0.5">Tempo scaduto, nessuna risposta data.</p>
                                )}
                            </div>
                        ))}
                    </div>

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
                <div className="w-6" />
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

