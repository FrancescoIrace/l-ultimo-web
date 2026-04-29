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

export { GetSportStyle };