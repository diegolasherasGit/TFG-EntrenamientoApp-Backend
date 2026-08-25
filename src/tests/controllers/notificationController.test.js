import request from 'supertest';
import mongoose from 'mongoose';
import Notification from '../../models/Notification.js';
import { setupTestEnv, teardownTestEnv } from '../helpers/setup.js';

describe('notificationController', () => {
    let app, athleteToken, athleteId;
    let notif1Id, notif2Id;

    beforeAll(async () => {
        const env = await setupTestEnv('test_notification_ctrl');
        ({ app, athleteToken, athleteId } = env);

        // Crear notificaciones de prueba
        const notif1 = await Notification.create({
            user: athleteId,
            type: 'system',
            title: 'Bienvenido',
            message: 'Hola Atleta',
            read: false
        });
        notif1Id = notif1._id;

        const notif2 = await Notification.create({
            user: athleteId,
            type: 'plan_assigned',
            title: 'Plan asignado',
            message: 'Tienes un nuevo plan',
            read: true
        });
        notif2Id = notif2._id;
    }, 60000);

    afterAll(async () => {
        await teardownTestEnv();
    });

    it('getNotifications: success', async () => {
        const res = await request(app)
            .get('/api/notifications')
            .set('Authorization', `Bearer ${athleteToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.count).toBe(2);
        expect(res.body.unreadCount).toBe(1);
    });

    it('markAsRead: success', async () => {
        const res = await request(app)
            .patch(`/api/notifications/${notif1Id}/read`)
            .set('Authorization', `Bearer ${athleteToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.read).toBe(true);
    });

    it('markAsRead: fail when notification not found', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .patch(`/api/notifications/${fakeId}/read`)
            .set('Authorization', `Bearer ${athleteToken}`);

        expect(res.status).toBe(404);
        expect(res.body.status).toBe('fail');
    });

    it('markAllAsRead: success', async () => {
        // Primero creamos otra no leída
        await Notification.create({
            user: athleteId,
            type: 'system',
            title: 'Alerta',
            message: 'Mensaje urgente',
            read: false
        });

        const res = await request(app)
            .patch('/api/notifications/read-all')
            .set('Authorization', `Bearer ${athleteToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        // Verificar que realmente están leídas
        const checkRes = await request(app)
            .get('/api/notifications')
            .set('Authorization', `Bearer ${athleteToken}`);
        expect(checkRes.body.unreadCount).toBe(0);
    });

    it('deleteNotification: fail when not found', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const res = await request(app)
            .delete(`/api/notifications/${fakeId}`)
            .set('Authorization', `Bearer ${athleteToken}`);

        expect(res.status).toBe(404);
        expect(res.body.status).toBe('fail');
    });

    it('deleteNotification: success', async () => {
        const res = await request(app)
            .delete(`/api/notifications/${notif2Id}`)
            .set('Authorization', `Bearer ${athleteToken}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);

        // Verificar eliminación
        const checkRes = await request(app)
            .get('/api/notifications')
            .set('Authorization', `Bearer ${athleteToken}`);
        // Eran 3 inicialmente, borramos 1 -> quedan 2
        expect(checkRes.body.count).toBe(2);
    });
});
