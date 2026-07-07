import { useState } from 'react';
import { X, Megaphone, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAlert } from './AlertComponent';

const TYPE_CONFIG = {
    advertising: {
        icon: Megaphone,
        title: 'In cerca di Pubblicità?',
        subtitle: 'Raccontaci la tua attività: ti ricontattiamo per parlare di sponsorizzazioni.',
        placeholder: 'Descrivi la tua attività e cosa vorresti sponsorizzare...',
    },
    suggestion: {
        icon: MessageCircle,
        title: 'Hai dei suggerimenti?',
        subtitle: 'Facci sapere cosa ne pensi della nostra app e come possiamo migliorare.',
        placeholder: 'Scrivi qui il tuo suggerimento...',
    },
};

/**
 * Modale di contatto (pubblicità o suggerimenti) usata dalla PWADashboard.
 * Al submit inserisce in contact_requests: un trigger DB si occupa di
 * inviare l'email di alert, niente chiamata diretta alla Edge Function qui.
 */
export default function ContactRequestModal({ isOpen, onClose, type, userId, defaultEmail }) {
    const [email, setEmail] = useState(defaultEmail || '');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const { success, error: showError } = useAlert();

    function handleClose() {
        setMessage('');
        onClose();
    }

    if (!isOpen || !type) return null;

    const config = TYPE_CONFIG[type];

    async function handleSubmit() {
        if (!email.trim() || !message.trim()) {
            showError('Compila email e messaggio');
            return;
        }

        setSubmitting(true);
        const { error } = await supabase
            .from('contact_requests')
            .insert({
                user_id: userId,
                type,
                email: email.trim(),
                message: message.trim(),
            });
        setSubmitting(false);

        if (error) {
            console.error('Errore invio richiesta di contatto:', error.message);
            showError('Impossibile inviare la richiesta');
            return;
        }

        success('Richiesta inviata, ti risponderemo via email!');
        handleClose();
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onClick={handleClose}>
            <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full mx-auto relative" onClick={e => e.stopPropagation()}>
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl flex-shrink-0">
                            <config.icon size={20} />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-base font-black text-slate-800">{config.title}</h3>
                            <p className="text-xs text-slate-400 leading-snug">{config.subtitle}</p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="p-2 bg-slate-100 text-slate-400 rounded-full hover:bg-slate-200 flex-shrink-0">
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-3">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="La tua email"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={config.placeholder}
                        rows={4}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                    />
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="w-full mt-5 py-3 bg-blue-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                    {submitting ? 'Invio...' : 'Invia richiesta'}
                </button>
            </div>
        </div>
    );
}
