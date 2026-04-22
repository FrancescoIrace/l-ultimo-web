import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAlert } from '../components/AlertComponent';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [canReset, setCanReset] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { success, error } = useAlert();

  // Converte hash in query string se necessario
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    
    if (hash && !searchParams.get('access_token')) {
      // Se c'è un hash ma non ci sono query params, converte l'hash
      const params = new URLSearchParams(hash);
      
      // Usa la nuova URL con query string
      const newUrl = `/reset-password?${params.toString()}`;
      window.history.replaceState({}, '', newUrl);
      setSearchParams(params);
    }
  }, [searchParams, setSearchParams]);

  // Controlla se l'utente è arrivato dal link dell'email
  useEffect(() => {
    const checkSession = async () => {
      try {
        // Supabase dovrebbe aver già autenticato l'utente dal link email
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          // Controlla se c'è un codice nell'URL
          const code = searchParams.get('code');
          if (!code) {
            error('Sessione non valida. Riprova dal link nell\'email.');
            setTimeout(() => navigate('/login'), 2000);
            return;
          }
        }
        
        setCanReset(true);
      } catch (err) {
        console.error('Errore validazione sessione:', err);
        error('Errore durante la validazione');
        setTimeout(() => navigate('/login'), 2000);
      } finally {
        setIsValidating(false);
      }
    };
    
    checkSession();
  }, [navigate, error, searchParams]);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      error('Le password non coincidono!');
      return;
    }

    if (password.length < 6) {
      error('La password deve essere almeno 6 caratteri');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) {
        error('Errore: ' + updateError.message);
      } else {
        success('Password aggiornata con successo! Reindirizzamento al login...');
        
        // Log out e torna al login dopo 2 secondi
        setTimeout(async () => {
          await supabase.auth.signOut();
          navigate('/login');
        }, 2000);
      }
    } catch (err) {
      error('Errore durante l\'aggiornamento: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!canReset || isValidating) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white min-h-screen flex flex-col items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">Validazione in corso...</p>
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

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
          Nuova Password
        </h1>
        <p className="text-sm text-slate-500 mb-8">
          Inserisci la tua nuova password. Assicurati che sia sicura e di facile ricordo.
        </p>

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          {/* Password Input */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
              Nuova Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Almeno 6 caratteri"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 pr-12 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* Confirm Password Input */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
              Conferma Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                placeholder="Ripeti la password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-3 pr-12 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* Password Requirements */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-6">
            <p className="text-xs text-blue-700 font-semibold mb-2">Requisiti:</p>
            <ul className="text-xs text-blue-600 space-y-1">
              <li className={password.length >= 6 ? 'text-green-600' : ''}>
                {password.length >= 6 ? '✓' : '○'} Almeno 6 caratteri
              </li>
              <li className={password === confirmPassword && password ? 'text-green-600' : ''}>
                {password === confirmPassword && password ? '✓' : '○'} Password coincidono
              </li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={loading || !password || !confirmPassword}
            className="w-full mt-8 cursor-pointer bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Aggiornamento in corso...' : 'Aggiorna Password'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            Problemi? Contatta il supporto per assistenza.
          </p>
        </div>
      </div>
    </div>
  );
}
