import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [gender, setGender] = useState('');
  const [province, setProvince] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [dataConsent, setDataConsent] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { error } = isSignUp
      ? await supabase.auth.signUp({
        email, password, options: {
          data: {
            username: username, // dallo stato del form
            gender: gender,     // "M", "F", "Other"
            province: province, // es. "Milano" o "MI"
            zip_code: zipCode,
            data_consent: dataConsent  // obbligatorio per procedere
          }
        }
      })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) alert(error.message);
    else {
      if (isSignUp) {
        // Salva un flag per mostrare l'alert di installazione app al primo accesso
        localStorage.setItem('newUserRegistered', 'true');
        alert('Controlla la mail per confermare!');
        navigate('/dashboard');
      } else {
        alert('Loggato con successo!');
        navigate('/dashboard');
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
              <input
                type="text"
                placeholder="Provincia"
                className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                required
              />
              <input
                type="text"
                placeholder="CAP"
                maxLength={5}
                className="w-full p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                required
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={dataConsent}
                  onChange={(e) => setDataConsent(e.target.checked)}
                  required
                />
                Accetto il trattamento dei dati personali
              </label>

            </>
          )}




          <button
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors"
          >
            {loading ? 'Caricamento...' : isSignUp ? 'Registrati' : 'Accedi'}
          </button>
        </form>

        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="w-full mt-4 text-sm text-slate-500 hover:underline"
        >
          {isSignUp ? 'Hai già un account? Accedi' : 'Nuovo su L\'Ultimo? Registrati'}
        </button>
      </div>
    </div>
  );
}