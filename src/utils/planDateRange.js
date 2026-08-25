/**
 * Utilidades para validar que la fecha de una sesión (workout) cae dentro del
 * rango de fechas de su plan. La comparación se hace a nivel de día en UTC,
 * ignorando la hora, porque tanto las fechas del plan como las de las sesiones
 * se originan a partir de cadenas 'YYYY-MM-DD' (medianoche UTC).
 */

// Normaliza una fecha a la medianoche UTC de su día (en milisegundos).
const toUtcDay = (value) => {
    const d = new Date(value);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

/**
 * Indica si `date` está dentro del rango [startDate, endDate] del plan,
 * comparando solo el día. Si la fecha no es válida, devuelve false.
 */
export const isWorkoutDateWithinPlan = (date, plan) => {
    const day = toUtcDay(date);
    if (Number.isNaN(day)) return false;
    return day >= toUtcDay(plan.startDate) && day <= toUtcDay(plan.endDate);
};

/** Mensaje de error consistente con las fechas del plan en formato YYYY-MM-DD. */
export const planDateRangeMessage = (plan) => {
    const fmt = (d) => new Date(d).toISOString().slice(0, 10);
    return `La fecha de la sesión debe estar dentro del rango del plan (${fmt(plan.startDate)} a ${fmt(plan.endDate)}).`;
};

/**
 * Un plan debe abarcar al menos un día: la fecha de fin debe ser un día
 * posterior a la de inicio (no pueden coincidir ni estar invertidas).
 * Comparación a nivel de día UTC. Fechas inválidas → false.
 */
export const isValidPlanRange = (startDate, endDate) => {
    const start = toUtcDay(startDate);
    const end = toUtcDay(endDate);
    if (Number.isNaN(start) || Number.isNaN(end)) return false;
    return start < end;
};

/** Mensaje de error para un rango de plan inválido (inicio == fin o invertido). */
export const planRangeOrderMessage = 'La fecha de fin debe ser posterior a la de inicio (no pueden ser el mismo día).';
