import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Centralizza lo stato della stagione classifica corrente (annuncio/in corso/
// in scadenza), derivato dalle date di quiz_seasons invece che hardcodato nei
// componenti - cosi' la prossima stagione basta inserirla in DB.
export function useCurrentSeason() {
    const [season, setSeason] = useState(null);
    const [status, setStatus] = useState('loading'); // loading | upcoming | active | active-urgent | none
    const [daysLeft, setDaysLeft] = useState(null);

    useEffect(() => {
        let cancelled = false;

        async function fetchSeason() {
            const todayStr = new Date().toISOString().split('T')[0];
            const { data, error } = await supabase
                .from('quiz_seasons')
                .select('id, name, starts_on, ends_on')
                .gte('ends_on', todayStr)
                .order('starts_on', { ascending: true })
                .limit(1)
                .maybeSingle();

            if (cancelled) return;

            if (error || !data) {
                setSeason(null);
                setStatus('none');
                return;
            }

            setSeason(data);

            const now = new Date();
            const start = new Date(`${data.starts_on}T00:00:00`);
            const end = new Date(`${data.ends_on}T23:59:59`);

            if (now < start) {
                setStatus('upcoming');
                setDaysLeft(null);
            } else if (now <= end) {
                const days = Math.ceil((end.getTime() - now.getTime()) / MS_PER_DAY);
                setDaysLeft(days);
                setStatus(days <= 2 ? 'active-urgent' : 'active');
            } else {
                setStatus('none');
            }
        }

        fetchSeason();
        return () => { cancelled = true; };
    }, []);

    return { season, status, daysLeft };
}
