/** Devuelve inicio (lunes 00:00) y fin (domingo 23:59) de la semana relativa a hoy. weeksAgo=0 → semana actual */
export function getWeekBounds(weeksAgo = 0) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = today.getDay() || 7; // 1=lun … 7=dom
    const monday = new Date(today);
    monday.setDate(today.getDate() - (day - 1) - weeksAgo * 7);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { start: monday, end: sunday };
}

export function getWeekLabel(weeksAgo) {
    if (weeksAgo === 0) {return 'Esta sem.';}
    return `-${weeksAgo} sem.`;
}

export function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

export function endOfDay(date) {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
}

/** Top N entradas de un mapa { clave: número } */
export function topCountsFromMap(countMap, limit = 5) {
    return Object.entries(countMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([label, value]) => ({ label, value }));
}
