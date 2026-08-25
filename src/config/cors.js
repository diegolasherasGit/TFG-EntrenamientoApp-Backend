// Orígenes locales habituales en desarrollo (web en :3000, Expo Web en :8081).
const devOrigins = ['http://localhost:3000', 'http://localhost:8081'];

/**
 * Orígenes permitidos para CORS (Express y Socket.io comparten esta política).
 *
 * - Si CORS_ORIGIN está definida → lista separada por comas (uso recomendado en prod).
 * - Si NO está definida y estamos en producción → `false`: no se permite ningún
 *   origen de navegador. Las apps móviles nativas no usan CORS, así que siguen
 *   funcionando; solo se bloquearían clientes web no declarados.
 * - En desarrollo/test → se permiten los hosts locales por comodidad.
 *
 * Se evalúa en cada llamada (no a nivel de módulo) para leer las variables de
 * entorno después de que dotenv las haya cargado.
 */
export function getCorsOrigins() {
    if (process.env.CORS_ORIGIN) {
        return process.env.CORS_ORIGIN.split(',');
    }
    return process.env.NODE_ENV === 'production' ? false : devOrigins;
}
