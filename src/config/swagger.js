import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TFG API - Entrenamiento Móvil',
      version: '1.0.0',
      description: 'Documentación de la API para el sistema de gestión de entrenamientos de escalada (TFG).'
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Servidor de desarrollo local'
      }
    ],
  },
  apis: ['./src/routes/*.js', './src/app.js'],
};

const specs = swaggerJsdoc(options);

export const setupSwagger = (app) => {
  try {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
    console.log("Swagger decorado y listo en /api-docs");
  } catch (error) {
    console.error("Error al configurar Swagger:", error.message);
  }
};