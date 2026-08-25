import request from 'supertest';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { setupTestEnv, teardownTestEnv } from '../helpers/setup.js';

// PNG válido de 1x1 px para las subidas de prueba
const TINY_PNG_BASE64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('exercisePhotoController', () => {
    let app, adminToken, coachToken, athleteToken;
    let photoId;
    let createdImageUrl;

    beforeAll(async () => {
        const env = await setupTestEnv('test_exercise_photo_ctrl');
        ({ app, adminToken, coachToken, athleteToken } = env);
    }, 60000);

    afterAll(async () => {
        // Limpieza del fichero subido por el test de creación (si sobrevivió)
        if (createdImageUrl) {
            const filename = path.basename(createdImageUrl);
            const filePath = path.join('uploads', filename);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        await teardownTestEnv();
    });

    it('createPhoto: success by admin (guarda el fichero en /uploads)', async () => {
        const res = await request(app)
            .post('/api/exercise-photos')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                title: 'Postura de sentadilla',
                photoBase64: TINY_PNG_BASE64,
                mimeType: 'image/png',
                description: 'Espalda neutra y rodillas alineadas'
            });

        expect(res.status).toBe(201);
        expect(res.body.data.photo.title).toBe('Postura de sentadilla');
        expect(res.body.data.photo.imageUrl).toContain('/uploads/exercise-');
        photoId = res.body.data.photo._id;
        createdImageUrl = res.body.data.photo.imageUrl;

        // El fichero existe físicamente
        const filename = path.basename(createdImageUrl);
        expect(fs.existsSync(path.join('uploads', filename))).toBe(true);
    });

    it('createPhoto: fail by coach (403)', async () => {
        const res = await request(app)
            .post('/api/exercise-photos')
            .set('Authorization', `Bearer ${coachToken}`)
            .send({
                title: 'Press Banca',
                photoBase64: TINY_PNG_BASE64,
                mimeType: 'image/png'
            });

        expect(res.status).toBe(403);
    });

    it('createPhoto: fail validation without image (400)', async () => {
        const res = await request(app)
            .post('/api/exercise-photos')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ title: 'Sin imagen' });

        expect(res.status).toBe(400);
    });

    it('createPhoto: fail with unsupported mime (400)', async () => {
        const res = await request(app)
            .post('/api/exercise-photos')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                title: 'Un gif',
                photoBase64: TINY_PNG_BASE64,
                mimeType: 'image/gif'
            });

        expect(res.status).toBe(400);
    });

    it('getAllPhotos: success by any authenticated user (athlete)', async () => {
        const res = await request(app)
            .get('/api/exercise-photos')
            .set('Authorization', `Bearer ${athleteToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.photos.length).toBeGreaterThan(0);
        expect(res.body.data.photos[0].title).toBe('Postura de sentadilla');
    });

    it('getPhotoById: success by coach', async () => {
        const res = await request(app)
            .get(`/api/exercise-photos/${photoId}`)
            .set('Authorization', `Bearer ${coachToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.photo._id).toBe(photoId.toString());
    });

    it('getPhotoById: 404 for unknown ID', async () => {
        const res = await request(app)
            .get(`/api/exercise-photos/${new mongoose.Types.ObjectId()}`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(404);
    });

    it('updatePhoto: success by admin', async () => {
        const res = await request(app)
            .put(`/api/exercise-photos/${photoId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ title: 'Postura de sentadilla profunda' });

        expect(res.status).toBe(200);
        expect(res.body.data.photo.title).toBe('Postura de sentadilla profunda');
    });

    it('updatePhoto: fail by coach (403)', async () => {
        const res = await request(app)
            .put(`/api/exercise-photos/${photoId}`)
            .set('Authorization', `Bearer ${coachToken}`)
            .send({ title: 'Hacked' });

        expect(res.status).toBe(403);
    });

    it('deletePhoto: fail by athlete (403)', async () => {
        const res = await request(app)
            .delete(`/api/exercise-photos/${photoId}`)
            .set('Authorization', `Bearer ${athleteToken}`);

        expect(res.status).toBe(403);
    });

    it('deletePhoto: success by admin (borra también el fichero)', async () => {
        const filename = path.basename(createdImageUrl);
        const res = await request(app)
            .delete(`/api/exercise-photos/${photoId}`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(204);
        expect(fs.existsSync(path.join('uploads', filename))).toBe(false);
    });
});
