import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAlert } from '../components/AlertComponent';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import UserLocationInput from '../components/UserLocationInput';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const { alert, success, error } = useAlert();
  const [isSignUp, setIsSignUp] = useState(location.pathname === '/signup');
  const [gender, setGender] = useState('');
  const [dataConsent, setDataConsent] = useState(false);
  const [locationData, setLocationData] = useState({
    location: '',
    province: '',
    zip_code: '',
    location_lat: null,
    location_lng: null,
  });

  useEffect(() => {
    setIsSignUp(location.pathname === '/signup');
  }, [location.pathname]);

  useEffect(() => {
    const draft = sessionStorage.getItem('authFormDraft');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        setEmail(parsed.email || '');
        setPassword(parsed.password || '');
        setUsername(parsed.username || '');
        setGender(parsed.gender || '');
        setLocationData(parsed.locationData || {
          location: '',
          province: '',
          zip_code: '',
          location_lat: null,
          location_lng: null,
        });
        setDataConsent(parsed.dataConsent || false);
      } catch (error) {
        console.warn('Errore lettura bozza registrazione:', error);
      }
    }
  }, []);

  useEffect(() => {
    if (!isSignUp) return;
    sessionStorage.setItem(
      'authFormDraft',
      JSON.stringify({ email, password, username, gender, locationData, dataConsent })
    );
  }, [isSignUp, email, password, username, gender, locationData, dataConsent]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    const authData = isSignUp
      ? await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username,
            gender: gender,
            province: locationData.province || null,
            zip_code: locationData.zip_code || null,
            location: locationData.location || null,
            location_lat: locationData.location_lat || null,
            location_lng: locationData.location_lng || null,
            data_consent: dataConsent,
          }
        }
      })
      : await supabase.auth.signInWithPassword({ email, password });

    const { error: authError, data } = authData;

    if (authError) error(authError.message == 'Invalid login credentials' ? 'Credenziali non valide' : authError.message);
    else {
      if (isSignUp) {
        const userId = data?.user?.id;
        if (userId) {
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: userId,
              username: username,
              gender: gender,
              province: locationData.province || null,
              zip_code: locationData.zip_code || null,
              location: locationData.location || null,
              location_lat: locationData.location_lat || null,
              location_lng: locationData.location_lng || null,
            }, { onConflict: 'id' });
          if (profileError) console.warn('Errore salvataggio profilo:', profileError.message);
        }

        sessionStorage.removeItem('authFormDraft');
        // Salva un flag per mostrare l'alert di installazione app al primo accesso
        localStorage.setItem('newUserRegistered', 'true');
        success('Controlla la mail per confermare!');
        navigate('/');
      } else {
        success('Loggato con successo!');
        navigate('/');
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center py-10 px-4">
      <p className="text-6xl font-black text-blue-600 mb-6 text-center tracking-tight uppercase p-4 rounded-2xl">L'ultimo</p>
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-slate-100">
        <h2 className="text-3xl font-black text-blue-600 mb-6 text-center tracking-tight">
          {isSignUp ? 'CREA ACCOUNT' : 'BENTORNATO'}
        </h2>

        <form onSubmit={handleAuth} className="space-y-4">
          <input
            type="email"
            placeholder="La tua email"
            className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {!isSignUp && (
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="text-sm text-blue-600 hover:underline font-semibold"
            >
              Password dimenticata?
            </button>
          )}

          {isSignUp && (
            <>
              <input
                type="text"
                placeholder="Username"
                className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              <select
                className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                required
              >
                <option value="">Genere</option>
                <option value="M">Maschio</option>
                <option value="F">Femmina</option>
                <option value="Other">Altro</option>
              </select>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-bold text-slate-700 mb-2">Posizione di base (opzionale)</p>
                <UserLocationInput value={locationData} onChange={setLocationData} />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={dataConsent}
                    onChange={(e) => setDataConsent(e.target.checked)}
                    required
                  />
                  Accetto il trattamento dei dati personali
                </label>
                <p className="text-sm text-slate-500">
                  <Link to="/privacy-policy" className="text-blue-600 underline">
                    Leggi l'informativa sul trattamento dei dati
                  </Link>
                </p>
              </div>
            </>
          )}




          <button
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors"
          >
            {loading ? 'Caricamento...' : isSignUp ? 'Registrati' : 'Accedi'}
          </button>
        </form>

        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-slate-700">
          <p className="font-bold text-slate-900 mb-2">Per la migliore esperienza</p>
          <p>Installa l'app come Progressive Web App invece di usarla nel browser web. In questo modo avrai un accesso più rapido, notifiche migliori e un layout ottimizzato per il telefono.</p>
          <p className="mt-3 text-slate-600">Vuoi una guida step by step? <Link to="/install-guide" className="text-blue-600 underline">Vai alla guida di installazione</Link>.</p>
        </div>

        <button
          onClick={() => navigate(isSignUp ? '/login' : '/signup')}
          className="w-full mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-100 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {isSignUp ? 'Hai già un account? Accedi' : 'Nuovo su L\'Ultimo? Registrati'}
        </button>
      </div>
    </div>
  );
}