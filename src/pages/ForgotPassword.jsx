import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useAlert } from '../components/AlertComponent';
import { ArrowLeft } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const navigate = useNavigate();
  const { success, error } = useAlert();

  const handleResetRequest = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        error('Errore: ' + resetError.message);
      } else {
        setEmailSent(true);
        success('Se l\'email esiste nel nostro database, riceverai un link a breve!');
        
        // Dopo 3 secondi, torna al login
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    } catch (err) {
      error('Errore durante la richiesta: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white min-h-screen flex flex-col">
      {/* Header con back button */}
      <button
        onClick={() => navigate('/login')}
        type="button"
        className="w-12 h-12 text-sm cursor-pointer flex items-center justify-center bg-slate-100 text-slate-600 mb-6 rounded-full font-bold hover:bg-slate-200 transition-all active:scale-95"
      >
        <ArrowLeft size={20} />
      </button>

      <div className="flex-1 flex flex-col justify-center">
        <h1 className="text-3xl font-black text-slate-800 mb-2">
          Password Dimenticata?
        </h1>
        <p className="text-sm text-slate-500 mb-8">
          Inserisci il tuo indirizzo email e ti invieremo un link per resettare la password.
        </p>

        {!emailSent ? (
          <form onSubmit={handleResetRequest} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                Email
              </label>
              <input
                type="email"
                required
                placeholder="esempio@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full mt-6 cursor-pointer bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Invio in corso...' : 'Invia Link Reset'}
            </button>
          </form>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <p className="text-green-700 font-semibold mb-2">✓ Email inviata!</p>
            <p className="text-sm text-green-600">
              Controlla la tua email per il link di reset. Verrai reindirizzato al login tra pochi secondi...
            </p>
          </div>
        )}

        <div className="mt-8 text-center">
          <p className="text-sm text-slate-500">
            Ricordi la password?{' '}
            <button
              onClick={() => navigate('/login')}
              className="text-blue-600 font-bold hover:underline"
            >
              Torna al login
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
