# TFG-EntrenamientoApp-Backend
Repositorio Backend TFG Desarrollo del sistema base y módulo de gestión de entrenamientos para una aplicación móvil de escalada.

## Tecnologías
- **Node.js**: Entorno de ejecución.
- **Express**: Framework web.
- **MongoDB**: Base de datos NoSQL.
- **Swagger**: Documentación de la API.
- **Jest & Supertest**: Pruebas unitarias y de integración.

## Configuración Local
1. Copia el archivo `.env.example` a `.env` y configura las variables necesarias.
2. Instala las dependencias:
   ```bash
   npm install
   ```

## Ejecución con Docker (Recomendado)
Para levantar el entorno de desarrollo:
```bash
docker-compose -f docker-compose.dev.yml up --build
```

## Pruebas
Para ejecutar los tests:
```bash
npm test
```

## Documentación API
Una vez iniciada la aplicación, puedes acceder a Swagger en:
[http://localhost:3000/api-docs](http://localhost:3000/api-docs)
