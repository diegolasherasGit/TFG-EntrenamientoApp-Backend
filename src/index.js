import app from './app.js';

const PORT = process.env.PORT || 3000;

// Escuchar en 0.0.0.0 para Docker
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
    console.log(`Swagger: http://localhost:${PORT}/api-docs`);
});