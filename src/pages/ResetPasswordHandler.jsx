import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ResetPasswordHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    // Cattura i parametri dal fragment (hash)
    const hash = window.location.hash.slice(1);
    
    if (hash) {
      // Converte l'hash in query string
      const params = new URLSearchParams(hash);
      const queryString = params.toString();
      
      // Reindirizza con query string invece di hash
      if (queryString) {
        navigate(`/reset-password?${queryString}`, { replace: true });
      } else {
        navigate('/reset-password', { replace: true });
      }
    }
  }, [navigate]);

  return null;
}
