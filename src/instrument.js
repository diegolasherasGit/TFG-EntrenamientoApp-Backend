// Cargamos las variables de entorno ANTES de leer SENTRY_DSN: este módulo se
// importa el primero de todos (index.js), antes de que app.js ejecute dotenv.
import 'dotenv/config';
import * as Sentry from '@sentry/node';

/**
 * Inicialización de Sentry. Debe importarse ANTES que el resto de la app
 * (ver index.js) para que la instrumentación capture todo.
 *
 * Solo se activa si SENTRY_DSN está definido, de modo que en desarrollo y
 * en los tests Sentry permanece inactivo y no añade ruido ni latencia.
 */
if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        // Muestreo de trazas de rendimiento (0.1 = 10%); ajustable por env
        tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1)
    });
}

export default Sentry;
