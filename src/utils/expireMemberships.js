import User from '../models/User.js';
import { MEMBERSHIP_STATUS } from '../constants/membership.js';
import { notifyAthletes } from './notifyAthletes.js';

/**
 * Caduca los abonos vencidos: busca los que están 'active' con validUntil en el
 * pasado, los pasa a 'expired' y avisa a cada usuario (in-app + push). A partir
 * de ese momento el gate requireActiveMembership les deniega el acceso.
 *
 * Es idempotente: si no hay abonos vencidos no hace nada. Se llama desde el
 * scheduler diario (utils/membershipScheduler.js) y es directamente testeable.
 *
 * @param {Date} [now=new Date()] - momento de referencia (inyectable en tests)
 * @returns {Promise<number>} número de abonos caducados
 */
export const expireMemberships = async (now = new Date()) => {
    const expired = await User.find({
        'membership.status': MEMBERSHIP_STATUS.ACTIVE,
        'membership.validUntil': { $ne: null, $lt: now }
    }).select('_id');

    if (expired.length === 0) {
        return 0;
    }

    const ids = expired.map(u => u._id);

    await User.updateMany(
        { _id: { $in: ids } },
        { $set: { 'membership.status': MEMBERSHIP_STATUS.EXPIRED } }
    );

    await notifyAthletes(ids, {
        type: 'system',
        title: 'Abono caducado',
        message: 'Tu abono de Bulderland ha caducado. Renuévalo en recepción para seguir accediendo a tus entrenamientos.'
    });

    return ids.length;
};
