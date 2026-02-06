import request from 'supertest';
import app from '../app.js';

describe('Endpoints de Salud (Health Checks)', () => {

    it('Debería retornar 200 y el mensaje de salud correcto', async () => {
        const res = await request(app).get('/');
        expect(res.statusCode).toEqual(200);
        expect(res.text).toBe('Backend funcionando');
    });

    it('Debería retornar 404 para rutas desconocidas', async () => {
        const res = await request(app).get('/ruta-que-no-existe');
        expect(res.statusCode).toEqual(404);
        expect(res.body).toHaveProperty('message', 'Ruta no encontrada');
    });
});
