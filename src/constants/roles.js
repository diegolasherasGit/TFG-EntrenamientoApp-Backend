/**
 * Roles de usuario de la aplicación. Fuente única de verdad para evitar
 * "magic strings" repartidos por controllers, rutas, modelos y schemas.
 */
export const ROLES = {
    ATHLETE: 'athlete',
    COACH: 'coach',
    ADMIN: 'admin'
};

// Lista de todos los roles válidos (útil para enums de Mongoose/Zod)
export const ALL_ROLES = Object.values(ROLES);
