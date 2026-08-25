/**
 * Validación y normalización de DNI/NIE españoles.
 * - DNI: 8 dígitos + letra de control.
 * - NIE: prefijo X/Y/Z (equivalente a 0/1/2) + 7 dígitos + letra de control.
 * La letra se calcula como LETTERS[number % 23].
 */
const CONTROL_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';
const NIE_PREFIX = { X: '0', Y: '1', Z: '2' };

/** Normaliza: mayúsculas y sin espacios ni guiones. */
export const normalizeDni = (value) =>
    String(value ?? '').toUpperCase().replace(/[\s-]/g, '');

/** Indica si el valor es un DNI o NIE español válido (incluye letra de control). */
export const isValidDni = (value) => {
    const dni = normalizeDni(value);
    const normalized = dni.replace(/^[XYZ]/, (m) => NIE_PREFIX[m]);
    const match = normalized.match(/^(\d{8})([A-Z])$/);
    if (!match) { return false; }
    const number = parseInt(match[1], 10);
    return CONTROL_LETTERS[number % 23] === match[2];
};
