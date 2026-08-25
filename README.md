# TFG-EntrenamientoApp-Backend

Repositorio Backend para la aplicación móvil de gestión de entrenamientos. Este sistema proporciona una API robusta y segura para gestionar atletas, entrenadores y sus planes de entrenamiento.

## 🚀 Tecnologías
- **Node.js & Express**: Entorno de ejecución y framework web.
- **MongoDB & Mongoose**: Base de datos NoSQL y modelado de datos.
- **Socket.io**: WebSockets para comunicación en tiempo real (Chat).
- **Seguridad**:
    - **JWT (JSON Web Tokens)**: Autenticación basada en tokens.
    - **Bcryptjs**: Encriptación de contraseñas (hashing).
    - **Middleware de protección**: Control de acceso por roles (Admin, Coach, Athlete).
- **Swagger**: Documentación interactiva de la API.
- **Jest & Supertest**: Suite de pruebas unitarias y de integración.

---

## 🏛️ Arquitectura y Seguridad

El sistema sigue el patrón **MVC** y aplica una capa de seguridad estricta:

1.  **Autenticación**: Registro e inicio de sesión con emisión de tokens JWT.
2.  **Protección de Rutas**: Todas las rutas sensibles requieren el envío del token en la cabecera `Authorization: Bearer <token>`.
3.  **Autorización por Roles**:
    - **Admin**: Gestión total de usuarios y restauración de datos.
    - **Coach**: Creación y gestión de planes y sesiones de entrenamiento.
    - **Athlete**: Consulta de planes asignados, calendario y registro de resultados.

---

## 🛠️ Endpoints Principales

### Usuarios
- `POST /api/users/register`: Registro de atletas.
- `POST /api/users/login`: Inicio de sesión (devuelve JWT).
- `GET /api/users/profile/:id`: Perfil del usuario (Protegido).
- `POST /api/users/privileged`: Creación de coaches/admins (Solo Admin).

### Entrenamiento y Comunicación (Protegidos)
- `POST /api/training/plans`: Crear plan (Coach/Admin).
- `GET /api/training/workouts/calendar/my-calendar`: Obtener calendario personalizado del usuario autenticado.
- `POST /api/training/stats`: Seguimiento de PRs y volumen de entrenamiento.
- `GET /api/training/plans/:planId/chat`: Obtener historial de chat de un plan.
- **WebSockets**: Eventos `join_plan_room` y `send_message` para chat en vivo.

---

## 💻 Configuración Local
1. Copia el archivo `.env.example` a `.env`.
2. Configura `JWT_SECRET` y la `MONGO_URI`.
3. Instala las dependencias:
   ```bash
   pnpm install
   ```

## 🐳 Ejecución con Docker
```bash
docker-compose -f docker-compose.dev.yml up --build
```

## 🧪 Pruebas
```bash
pnpm test
```

### Seed para Maestro (E2E móvil)
Datos deterministas para pruebas con [Maestro](https://maestro.mobile.dev/):

```bash
pnpm run seed:maestro
```

Credenciales: `atleta.demo@bulderland.com`, `coach.demo@bulderland.com`, `admin@test.com` (contraseña `password123`). Ver README en `TFG-EntrenamientoApp-Mobile/.maestro/`.

## 📄 Documentación API
Swagger UI disponible en: `http://localhost:3000/api-docs`
