import fs from 'fs';

/**
 * URI de MongoDB según dónde se ejecuta el script.
 * - Dentro de Docker Compose: mongodb://mongo:27017/...
 * - En el host (pnpm run seed): reemplaza mongo → localhost (puerto 27017 expuesto)
 */
export function resolveMongoUri() {
    const uri = process.env.MONGO_URI || 'mongodb://mongo:27017/entrenamiento_db';
    const isDocker = fs.existsSync('/.dockerenv');

    if (!isDocker && (uri.includes('://mongo:') || uri.includes('//@mongo'))) {
        const hostUri = uri.replace('://mongo:', '://localhost:').replace('//@mongo', '://localhost');
        console.log(`[MongoDB] Ejecutando en el host (fuera de Docker) → ${hostUri}`);
        return hostUri;
    }
    console.log(`[MongoDB] Conectando → ${uri}`);
    return uri;
}
