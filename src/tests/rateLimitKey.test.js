import jwt from 'jsonwebtoken';
import { userOrIpKey } from '../app.js';

// El rate limiter clava el cubo por usuario autenticado (para no penalizar IPs
// compartidas: proxy inverso, WiFi del rocódromo) y cae a la IP si no hay token.
describe('userOrIpKey (clave del rate limiter)', () => {
    it('usa el id del usuario cuando hay un JWT válido en el header', () => {
        const token = jwt.sign({ id: 'user123' }, process.env.JWT_SECRET);
        const req = { headers: { authorization: `Bearer ${token}` }, ip: '1.2.3.4' };
        expect(userOrIpKey(req)).toBe('u:user123');
    });

    it('cae a la IP si no hay token', () => {
        const req = { headers: {}, ip: '1.2.3.4' };
        expect(userOrIpKey(req)).not.toBe('u:user123');
        expect(typeof userOrIpKey(req)).toBe('string');
    });

    it('cae a la IP si el token es inválido', () => {
        const req = { headers: { authorization: 'Bearer no-es-un-jwt' }, ip: '5.6.7.8' };
        expect(userOrIpKey(req).startsWith('u:')).toBe(false);
    });

    it('dos usuarios distintos producen claves distintas (misma IP)', () => {
        const t1 = jwt.sign({ id: 'a' }, process.env.JWT_SECRET);
        const t2 = jwt.sign({ id: 'b' }, process.env.JWT_SECRET);
        const k1 = userOrIpKey({ headers: { authorization: `Bearer ${t1}` }, ip: '9.9.9.9' });
        const k2 = userOrIpKey({ headers: { authorization: `Bearer ${t2}` }, ip: '9.9.9.9' });
        expect(k1).not.toBe(k2);
    });
});
