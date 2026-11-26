import { normalizeDni, isValidDni } from '../../utils/dni.js';

describe('normalizeDni', () => {
    it('pasa a mayúsculas y quita espacios y guiones', () => {
        expect(normalizeDni(' 12345678-z ')).toBe('12345678Z');
    });

    it('devuelve cadena vacía si el valor es null o undefined', () => {
        expect(normalizeDni(null)).toBe('');
        expect(normalizeDni(undefined)).toBe('');
    });
});

describe('isValidDni', () => {
    it('acepta un DNI con la letra de control correcta', () => {
        expect(isValidDni('12345678Z')).toBe(true);
    });

    it('acepta un NIE traduciendo el prefijo X/Y/Z', () => {
        expect(isValidDni('X1234567L')).toBe(true);
    });

    it('rechaza un DNI cuya letra de control no corresponde', () => {
        expect(isValidDni('12345678A')).toBe(false);
    });

    it('rechaza un NIE cuya letra de control no corresponde', () => {
        expect(isValidDni('Y0000000')).toBe(false);
    });

    it('rechaza valores que no siguen el formato', () => {
        expect(isValidDni('ABC')).toBe(false);
        expect(isValidDni('')).toBe(false);
        expect(isValidDni(null)).toBe(false);
    });
});
