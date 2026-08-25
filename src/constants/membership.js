/**
 * Estados del abono/cuota de un usuario en Bulderland. Fuente única de verdad
 * para evitar "magic strings" repartidos por modelos, schemas y middleware.
 *
 * La gestión es manual: un admin marca el estado (no hay API externa del
 * rocódromo). El acceso al contenido de entrenamiento exige estado 'active'
 * (ver requireActiveMembership / User.hasActiveMembership).
 */
export const MEMBERSHIP_STATUS = {
    NONE: 'none',       // nunca ha tenido abono o se desconoce
    PENDING: 'pending', // el usuario ha solicitado activación; falta que el admin la apruebe
    ACTIVE: 'active',   // abono vigente -> puede acceder
    EXPIRED: 'expired'  // tuvo abono pero caducó/se dio de baja
};

// Lista de todos los estados válidos (útil para enums de Mongoose/Zod)
export const ALL_MEMBERSHIP_STATUS = Object.values(MEMBERSHIP_STATUS);

/**
 * Tipos de abono que ofrece Bulderland, con su duración en días. Al activar un
 * abono el admin elige el tipo y la fecha de caducidad (validUntil) se calcula
 * automáticamente, evitando errores al teclear fechas.
 */
export const MEMBERSHIP_PLANS = {
    mensual:    { label: 'Mensual',    days: 30 },
    trimestral: { label: 'Trimestral', days: 90 },
    anual:      { label: 'Anual',      days: 365 }
};

// Claves válidas de plan (para enums de Zod y validación en el controlador)
export const ALL_MEMBERSHIP_PLANS = Object.keys(MEMBERSHIP_PLANS);

/**
 * Calcula la fecha de caducidad de un abono a partir del tipo de plan.
 * @param {string} plan - clave de MEMBERSHIP_PLANS (mensual/trimestral/anual)
 * @param {Date} [from=new Date()] - fecha de inicio del abono
 * @returns {Date|undefined} validUntil, o undefined si el plan no existe
 */
export const computeValidUntil = (plan, from = new Date()) => {
    const def = MEMBERSHIP_PLANS[plan];
    if (!def) {
        return undefined;
    }
    const validUntil = new Date(from);
    validUntil.setDate(validUntil.getDate() + def.days);
    return validUntil;
};
