// Pittogrammi semplici usati da CardOptionPicker (livello, sesso, sport
// preferito). Disegnati a mano con poche primitive SVG invece di path
// complessi, cosi' restano leggeri e coerenti in stile con lucide-react.

const base = { width: 20, height: 20, viewBox: '0 0 24 24' };

export function SproutIcon() {
    return (
        <svg {...base} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12,12 C7,12 5,8 5,4 C10,4 12,7 12,12 Z" />
            <path d="M12,12 C17,12 19,8 19,4 C14,4 12,7 12,12 Z" />
            <line x1="12" y1="21" x2="12" y2="11" />
        </svg>
    );
}

export function DumbbellIcon() {
    return (
        <svg {...base} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="9" width="4" height="6" rx="1" />
            <rect x="18" y="9" width="4" height="6" rx="1" />
            <line x1="6" y1="12" x2="18" y2="12" />
        </svg>
    );
}

export function FlameIcon() {
    return (
        <svg {...base} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12,2 C14,6 18,8 18,13 C18,17.5 15.5,21 12,21 C8.5,21 6,17.5 6,13 C6,10 7.5,8.5 8.5,10 C9,7 9,4 12,2 Z" />
        </svg>
    );
}

export function StarIcon() {
    return (
        <svg {...base} fill="currentColor" stroke="none">
            <polygon points="12,3 14.23,8.93 20.56,9.22 15.61,13.17 17.29,19.28 12,15.8 6.71,19.28 8.39,13.17 3.44,9.22 9.77,8.93" />
        </svg>
    );
}

export function TrophyIcon() {
    return (
        <svg {...base} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6,4 H18 L16,12 Q12,15.5 8,12 Z" />
            <path d="M6,5 C2,5 2,10 6,10" />
            <path d="M18,5 C22,5 22,10 18,10" />
            <line x1="12" y1="15.5" x2="12" y2="19" />
            <rect x="9" y="19.5" width="6" height="2" rx="1" fill="currentColor" stroke="none" />
        </svg>
    );
}

export function CrownIcon() {
    return (
        <svg {...base} fill="currentColor" stroke="none">
            <polygon points="3,19 3,10 7,14 12,6 17,14 21,10 21,19" />
            <rect x="3" y="19" width="18" height="2.5" rx="1" />
        </svg>
    );
}

export function MaleIcon() {
    return (
        <svg {...base} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="10" cy="14" r="6" />
            <line x1="14.5" y1="9.5" x2="20" y2="4" />
            <polyline points="14,4 20,4 20,10" />
        </svg>
    );
}

export function FemaleIcon() {
    return (
        <svg {...base} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="9" r="6" />
            <line x1="12" y1="15" x2="12" y2="21" />
            <line x1="9" y1="18" x2="15" y2="18" />
        </svg>
    );
}

export function SparkleIcon() {
    return (
        <svg {...base} fill="currentColor" stroke="none">
            <path d="M12,2 Q13,10 20,12 Q13,14 12,22 Q11,14 4,12 Q11,10 12,2 Z" />
        </svg>
    );
}

export function SoccerBallIcon() {
    return (
        <svg {...base} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <polygon points="12,9 14.85,11.07 13.76,14.43 10.24,14.43 9.15,11.07" fill="currentColor" stroke="none" />
            <line x1="12" y1="9" x2="12" y2="3" />
            <line x1="14.85" y1="11.07" x2="20.56" y2="9.22" />
            <line x1="13.76" y1="14.43" x2="17.29" y2="19.28" />
            <line x1="10.24" y1="14.43" x2="6.71" y2="19.28" />
            <line x1="9.15" y1="11.07" x2="3.44" y2="9.22" />
        </svg>
    );
}

export function PadelIcon() {
    return (
        <svg {...base} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="8.5" rx="6" ry="7" />
            <line x1="12" y1="15" x2="12" y2="21" />
            <line x1="9" y1="21" x2="15" y2="21" />
        </svg>
    );
}

export function BasketballIcon() {
    return (
        <svg {...base} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <line x1="12" y1="3" x2="12" y2="21" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <path d="M4.5,7 Q11,12 4.5,17" />
            <path d="M19.5,7 Q13,12 19.5,17" />
        </svg>
    );
}

export function TennisRacketIcon() {
    return (
        <svg {...base} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="8.5" rx="5" ry="6.5" />
            <line x1="9.3" y1="3.5" x2="9.3" y2="13.5" />
            <line x1="14.7" y1="3.5" x2="14.7" y2="13.5" />
            <line x1="7.3" y1="6.5" x2="16.7" y2="6.5" />
            <line x1="7.3" y1="10.5" x2="16.7" y2="10.5" />
            <line x1="12" y1="15" x2="12" y2="20.5" />
            <rect x="10.5" y="20" width="3" height="1.6" rx="0.7" />
        </svg>
    );
}

export function VolleyballIcon() {
    return (
        <svg {...base} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M4,9 Q12,4.5 20,9" />
            <path d="M4,15 Q12,19.5 20,15" />
            <path d="M8.5,4 Q12,12 8.5,20" />
        </svg>
    );
}

export function RunningIcon() {
    return (
        <svg {...base} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="15.5" cy="4.5" r="1.6" fill="currentColor" stroke="none" />
            <polyline points="9,20 12,14 10,10 14,9 16,13 20,10" />
        </svg>
    );
}
