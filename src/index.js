/**
 * Punto de entrada de la aplicación.
 * Se encarga de iniciar el servidor y escuchar en el puerto configurado.
 */
import app from './app.js';

// Definir el puerto del servidor (por defecto 3000)
const PORT = process.env.PORT || 3000;

// Escuchar en '0.0.0.0' para permitir conexiones desde fuera del contenedor Docker
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log(`Swagger: http://localhost:${PORT}/api-docs`);
});