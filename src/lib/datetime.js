// Arrotonda una stringa datetime-local (YYYY-MM-DDTHH:mm) al blocco di
// 30 minuti più vicino (00 o 30), per allinearla allo step nativo degli
// input datetime-local usati in tutta l'app.
export function roundToHalfHour(dateTimeString) {
    if (!dateTimeString) return '';

    // Il formato nativo è YYYY-MM-DDTHH:MM
    const [date, time] = dateTimeString.split('T');
    if (!time) return dateTimeString;

    let [hours, minutes] = time.split(':');
    let mins = parseInt(minutes, 10);

    if (mins < 15) {
        mins = 0;
    } else if (mins >= 15 && mins < 45) {
        mins = 30;
    } else {
        mins = 0;
        // Se va a 60, aumentiamo l'ora di 1
        let hrs = parseInt(hours, 10) + 1;
        hours = hrs < 10 ? `0${hrs}` : `${hrs}`;
    }

    const finalMinutes = mins === 0 ? '00' : '30';
    return `${date}T${hours}:${finalMinutes}`;
}

// Valore minimo (inizio dell'ora corrente) da passare all'attributo `min`
// di un input datetime-local, per non sballare lo step dei 30 minuti e
// non permettere di scegliere un orario già passato.
export function getMinDatetimeLocal() {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    const offset = now.getTimezoneOffset() * 60000;
    return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}

// Converte una stringa datetime-local (YYYY-MM-DDTHH:mm) nel formato
// atteso dalle colonne `timestamp` (senza timezone) su Supabase.
export function formatDatetimeForTimestamp(dateTimeString) {
    if (!dateTimeString) return null;
    return dateTimeString.replace('T', ' ') + ':00';
}
