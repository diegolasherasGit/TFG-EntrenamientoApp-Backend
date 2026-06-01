import request from 'supertest';
import mongoose from 'mongoose';
import { setupTestEnv, teardownTestEnv } from '../helpers/setup.js';

describe('techniqueVideoController', () => {
    let app, adminToken, coachToken, athleteToken;
    let videoId;

    beforeAll(async () => {
        const env = await setupTestEnv('test_technique_video_ctrl');
        ({ app, adminToken, coachToken, athleteToken } = env);
    }, 60000);

    afterAll(async () => {
        await teardownTestEnv();
    });

    it('createVideo: success by admin', async () => {
        const res = await request(app)
            .post('/api/technique-videos')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                title: 'Sentadilla Libre',
                videoUrl: 'https://youtube.com/watch?v=123',
                description: 'Aprende a hacer sentadillas'
            });

        expect(res.status).toBe(201);
        expect(res.body.data.video.title).toBe('Sentadilla Libre');
        videoId = res.body.data.video._id;
    });

    it('createVideo: fail by coach (403)', async () => {
        const res = await request(app)
            .post('/api/technique-videos')
            .set('Authorization', `Bearer ${coachToken}`)
            .send({
                title: 'Press Banca',
                videoUrl: 'https://youtube.com/watch?v=456'
            });

        expect(res.status).toBe(403);
    });

    it('createVideo: fail by athlete (403)', async () => {
        const res = await request(app)
            .post('/api/technique-videos')
            .set('Authorization', `Bearer ${athleteToken}`)
            .send({
                title: 'Peso Muerto',
                videoUrl: 'https://youtube.com/watch?v=789'
            });

        expect(res.status).toBe(403);
    });

    it('getAllVideos: success by any authenticated user (athlete)', async () => {
        const res = await request(app)
            .get('/api/technique-videos')
            .set('Authorization', `Bearer ${athleteToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.videos.length).toBeGreaterThan(0);
        expect(res.body.data.videos[0].title).toBe('Sentadilla Libre');
    });

    it('getVideoById: success', async () => {
        const res = await request(app)
            .get(`/api/technique-videos/${videoId}`)
            .set('Authorization', `Bearer ${coachToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.video._id).toBe(videoId.toString());
    });

    it('getVideoById: 404 for invalid ID format', async () => {
        // Asumiendo que el middleware de mongoose falla o el controlador retorna 404
        const res = await request(app)
            .get(`/api/technique-videos/${new mongoose.Types.ObjectId()}`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(404);
    });

    it('updateVideo: success by admin', async () => {
        const res = await request(app)
            .put(`/api/technique-videos/${videoId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
                title: 'Sentadilla Profunda'
            });

        expect(res.status).toBe(200);
        expect(res.body.data.video.title).toBe('Sentadilla Profunda');
    });

    it('updateVideo: fail by coach (403)', async () => {
        const res = await request(app)
            .put(`/api/technique-videos/${videoId}`)
            .set('Authorization', `Bearer ${coachToken}`)
            .send({
                title: 'Hacked'
            });

        expect(res.status).toBe(403);
    });

    it('deleteVideo: fail by athlete (403)', async () => {
        const res = await request(app)
            .delete(`/api/technique-videos/${videoId}`)
            .set('Authorization', `Bearer ${athleteToken}`);

        expect(res.status).toBe(403);
    });

    it('deleteVideo: success by admin', async () => {
        const res = await request(app)
            .delete(`/api/technique-videos/${videoId}`)
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(204);

        // Verificar que realmente se borró
        const checkRes = await request(app)
            .get(`/api/technique-videos/${videoId}`)
            .set('Authorization', `Bearer ${adminToken}`);
        expect(checkRes.status).toBe(404);
    });
});
