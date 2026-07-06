export default function GetSportStyle(sport) {
    switch (sport?.toLowerCase()) {
        case 'calcio a 5':
        case 'calcio a 7':
        case 'calcio':
            return {
                bg: 'bg-green-600',
                pattern: 'repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(255,255,255,0.1) 20px, rgba(255,255,255,0.1) 40px)',
                borderColor: 'border-green-700',
                type: 'soccer'
            };
        case 'padel':
            return {
                bg: 'bg-blue-500',
                pattern: 'radial-gradient(circle, rgba(255,255,255,0.2) 1px, transparent 1px)',
                borderColor: 'border-blue-600',
                type: 'padel'
            };
        case 'basket':
            return {
                bg: 'bg-orange-400', // Colore gomma/parquet
                pattern: 'linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)',
                borderColor: 'border-orange-600',
                type: 'basket'
            };
        case 'tennis':
            return {
                bg: 'bg-[#c25a3c]', // Colore Terra Battuta
                pattern: 'none',
                borderColor: 'border-[#8e3e28]',
                type: 'tennis'
            };
        default:
            return { bg: 'bg-slate-500', pattern: '', borderColor: 'border-slate-600', type: 'default' };
    }
}

/**
 * Mappa lo sport scelto in partita (13 valori, es. "Basket (3vs3)") a una
 * categoria grossolana compatibile con GetSportStyle(court.sport_type).type
 * (che invece bucketizza i soli 4 valori reali di sports_courts.sport_type:
 * "Calcio a 5"/"Padel"/"Basket"/"Tennis"). I due elenchi non coincidono 1:1,
 * quindi qui NON si filtra mai un campo per sport — si usa solo per ordinare
 * mettendo prima i campi della categoria corrispondente.
 */
function getSportCategoryForMatch(sport) {
    switch (sport) {
        case 'Calcetto':
        case 'Calcio a 7':
        case 'Calcio a 11':
            return 'soccer';
        case 'Padel':
            return 'padel';
        case 'Basket (allenamento)':
        case 'Basket (3vs3)':
        case 'Basket (5vs5)':
            return 'basket';
        case 'Tennis singolo':
        case 'Tennis doppio':
            return 'tennis';
        default:
            return null; // Volley, Corsa, Palestra, Personalizzato: nessun bucket
    }
}

/**
 * Verifica se un orario è valido per un determinato centro sportivo
 */
export const validateBookingTime = async (supabase, dateTimeString, centerId) => {
    if (!centerId) return { isValid: true };

    // Creiamo l'oggetto data. dateTimeString è quello che arriva dal picker
    const selectedDate = new Date(dateTimeString);

    // Day of week e orario estratti in LOCALE (quello che l'utente ha scelto)
    const dayOfWeek = selectedDate.getDay();
    const hours = String(selectedDate.getHours()).padStart(2, '0');
    const minutes = String(selectedDate.getMinutes()).padStart(2, '0');
    const selectedTime = `${hours}:${minutes}`;

    console.log("Check orario locale scelto dall'utente:", selectedTime);

    const { data: hoursData } = await supabase
        .from('business_hours')
        .select('*')
        .eq('center_id', centerId)
        .eq('day_of_week', dayOfWeek)
        .single();

    if (!hoursData || hoursData.is_closed) {
        return { isValid: false, isClosed: true, message: "Il centro è chiuso o non ha orari definiti." };
    }

    const open = hoursData.open_time.slice(0, 5);
    const close = hoursData.close_time.slice(0, 5);

    // Ora il confronto è coerente: Locale vs Locale
    if (selectedTime < open || selectedTime > close) {
        return {
            isValid: false,
            isClosed: false,
            message: `Il centro è aperto dalle ${open} alle ${close}.`
        };
    }

    return { isValid: true, isClosed: false };
};

export { GetSportStyle, getSportCategoryForMatch };