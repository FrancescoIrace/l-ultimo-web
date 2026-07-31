import { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';

// Modale mostrata al click su "Unisciti": permette (o richiede) una breve nota
// di presentazione che verrà mostrata sotto lo username nel dettaglio partita.
// - prompt: testo/domanda personalizzata sopra la nota (se assente, default).
// - required: se true, la nota è obbligatoria (niente "Salta", "Unisciti"
//   disattivato finché è vuota).
// onConfirm(note) riceve la nota (stringa, '' se saltata).
export default function JoinNoteModal({ open, onClose, onConfirm, matchTitle, prompt, required }) {
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) setNote('');
  }, [open]);

  if (!open) return null;

  const canJoin = !required || note.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-4"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-black text-slate-800 mb-1">
          {required ? 'Presentati per entrare' : 'Presentati agli altri'}
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          {prompt
            ? prompt
            : `Scrivi due parole per farti riconoscere${matchTitle ? ` in "${matchTitle}"` : ''}.`}
          {' '}
          {required
            ? <span className="text-red-500 font-bold">Obbligatorio per iscriverti.</span>
            : 'È facoltativo, lo vedranno gli altri giocatori.'}
        </p>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          rows={3}
          autoFocus
          placeholder="Es. Sono Marco, gioco a centrocampo. Porto un amico!"
          className="w-full p-3 rounded-2xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
        />
        <div className="text-right text-[11px] text-slate-400 mb-4">{note.length}/200</div>

        <div className="flex gap-3">
          {!required && (
            <button
              type="button"
              onClick={() => onConfirm('')}
              className="flex-1 py-3 rounded-2xl font-bold text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              Salta
            </button>
          )}
          <button
            type="button"
            disabled={!canJoin}
            onClick={() => onConfirm(note.trim())}
            className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <UserPlus size={16} /> Unisciti
          </button>
        </div>
      </div>
    </div>
  );
}
