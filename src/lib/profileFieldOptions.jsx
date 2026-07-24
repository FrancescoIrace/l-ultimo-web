import {
    SproutIcon, DumbbellIcon, FlameIcon, StarIcon, TrophyIcon, CrownIcon,
    MaleIcon, FemaleIcon, SparkleIcon,
    SoccerBallIcon, PadelIcon, BasketballIcon, TennisRacketIcon, VolleyballIcon, RunningIcon,
} from '../components/pickerIcons';

// Valori identici a quelli dei vecchi <select> (stessa colonna DB, stesso
// testo salvato) - qui aggiungiamo solo icona/colore/descrizione per il
// CardOptionPicker.
export const LEVEL_OPTIONS = [
    { value: 'Principiante', label: 'Principiante', description: 'Hai appena iniziato o giochi per divertimento', icon: <SproutIcon />, fg: '#17A34A', bg: '#E7F8EE' },
    { value: 'Amatoriale', label: 'Amatoriale', description: 'Giochi con regolarità, buone basi tecniche', icon: <DumbbellIcon />, fg: '#0284C7', bg: '#E6F5FC' },
    { value: 'Intermedio', label: 'Intermedio', description: 'Conosci bene regole e tattica di base', icon: <FlameIcon />, fg: '#6249E8', bg: '#EFEBFD' },
    { value: 'Esperto', label: 'Esperto', description: 'Gioco di alto livello, tecnica solida', icon: <StarIcon />, fg: '#D97706', bg: '#FCF1DE' },
    { value: 'Professionista', label: 'Professionista', description: 'Hai giocato a livello agonistico organizzato', icon: <TrophyIcon />, fg: '#E11D48', bg: '#FCE7EB' },
    { value: 'Veterano', label: 'Veterano', description: 'Anni di campo, un punto di riferimento', icon: <CrownIcon />, fg: '#A16207', bg: '#FBF1D6' },
];

export const GENDER_OPTIONS = [
    { value: 'M', label: 'Uomo', icon: <MaleIcon />, fg: '#2563EB', bg: '#E7EEFE' },
    { value: 'F', label: 'Donna', icon: <FemaleIcon />, fg: '#DB2777', bg: '#FCE7F3' },
    { value: 'Other', label: 'Altro', icon: <SparkleIcon />, fg: '#0D9488', bg: '#E1F5F2' },
];

const SOCCER = { icon: <SoccerBallIcon />, fg: '#16A34A', bg: '#E8F8EE' };
const BASKET = { icon: <BasketballIcon />, fg: '#EA580C', bg: '#FDECDF' };
const TENNIS = { icon: <TennisRacketIcon />, fg: '#65A30D', bg: '#EEF6DC' };

export const SPORT_OPTIONS = [
    { value: 'Calcetto', label: 'Calcetto', ...SOCCER },
    { value: 'Calcio a 7', label: 'Calcio a 7', ...SOCCER },
    { value: 'Calcio a 11', label: 'Calcio a 11', ...SOCCER },
    { value: 'Padel', label: 'Padel', icon: <PadelIcon />, fg: '#0891B2', bg: '#E3F6F8' },
    { value: 'Basket (3vs3)', label: 'Basket (3vs3)', ...BASKET },
    { value: 'Basket (5vs5)', label: 'Basket (5vs5)', ...BASKET },
    { value: 'Tennis singolo', label: 'Tennis singolo', ...TENNIS },
    { value: 'Tennis doppio', label: 'Tennis doppio', ...TENNIS },
    { value: 'Volley', label: 'Volley', icon: <VolleyballIcon />, fg: '#4F46E5', bg: '#EBEAFD' },
    { value: 'Corsa', label: 'Corsa', icon: <RunningIcon />, fg: '#E11D48', bg: '#FCE7EB' },
    { value: 'Palestra', label: 'Palestra', icon: <DumbbellIcon />, fg: '#7C3AED', bg: '#F1EBFD' },
];
