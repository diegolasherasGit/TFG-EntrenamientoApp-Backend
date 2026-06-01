import app from './app.js';
import logger from './config/logger.js';

import { createServer } from 'http';
import { initializeSocket } from './config/socket.js';

const PORT = process.env.PORT || 3000;

const httpServer = createServer(app);

// Inicializar Socket.io
initializeSocket(httpServer);

// Escuchar en 0.0.0.0 para Docker
httpServer.listen(PORT, '0.0.0.0', () => {
    logger.info(`Servidor corriendo en http://localhost:${PORT}`);
    logger.info(`Swagger: http://localhost:${PORT}/api-docs`);
});