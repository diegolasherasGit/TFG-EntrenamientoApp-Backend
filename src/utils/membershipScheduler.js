import cron from 'node-cron';
import logger from '../config/logger.js';
import { expireMemberships } from './expireMemberships.js';

// Expresión cron: todos los días a las 03:00. A esa hora hay poca actividad,
// así que es buen momento para caducar abonos vencidos. La zona horaria se fija
// explícitamente a la de Bulderland para no depender de la hora del servidor.
const DAILY_AT_3AM = '0 3 * * *';
const TIMEZONE = 'Europe/Madrid';

const runExpiry = async () => {
    try {
        const count = await expireMemberships();
        if (count > 0) {
            logger.info(`Abonos caducados automáticamente: ${count}`);
        }
    } catch (err) {
        logger.error(`Error caducando abonos: ${err.message}`);
    }
};

/**
 * Arranca el job diario que caduca los abonos vencidos. Se llama una sola vez al
 * iniciar el servidor (src/index.js), NO desde app.js, para no programar nada
 * durante los tests. Ejecuta también una pasada al arrancar por si el servidor
 * estuvo caído cuando tocaba caducar alguno.
 */
export const startMembershipScheduler = () => {
    runExpiry();
    cron.schedule(DAILY_AT_3AM, runExpiry, { timezone: TIMEZONE });
    logger.info(`Scheduler de caducidad de abonos activo (diario 03:00 ${TIMEZONE}).`);
};
