import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { sendPushNotification } from './pushNotifications.js';

/**
 * Notifica a un conjunto de atletas: crea notificaciones in-app y envía push
 * a los que tengan token. Filtra automáticamente a quienes desactivaron las
 * notificaciones (notificationsEnabled === false).
 *
 * @param {Array<string|import('mongoose').Types.ObjectId>} athleteIds - IDs de los atletas a notificar
 * @param {Object} options
 * @param {string} options.type - Tipo de notificación (ej: 'plan_assigned', 'workout_updated', 'system')
 * @param {string} options.title - Título mostrado
 * @param {string} options.message - Cuerpo del mensaje
 * @param {string|import('mongoose').Types.ObjectId} [options.relatedId] - ID del recurso relacionado (plan/workout)
 * @returns {Promise<void>}
 */
export const notifyAthletes = async (athleteIds, { type, title, message, relatedId }) => {
    if (!athleteIds || athleteIds.length === 0) {
        return;
    }

    const athletesToNotify = await User.find({
        _id: { $in: athleteIds },
        notificationsEnabled: { $ne: false }
    });

    if (athletesToNotify.length === 0) {
        return;
    }

    const notifications = athletesToNotify.map(a => ({
        user: a._id,
        type,
        title,
        message,
        relatedId
    }));
    await Notification.insertMany(notifications);

    const pushTokens = athletesToNotify
        .filter(a => a.expoPushToken)
        .map(a => a.expoPushToken);

    if (pushTokens.length > 0) {
        await sendPushNotification(pushTokens, title, message, { path: '/notifications' });
    }
};
