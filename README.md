# TFG-EntrenamientoApp-Backend
Repositorio Backend TFG Desarrollo del sistema base y módulo de gestión de entrenamientos para una aplicación móvil de escalada.

## 🚀 Tecnologías
- **Node.js**: Entorno de ejecución.
- **Express**: Framework web.
- **MongoDB**: Base de datos NoSQL.
- **Swagger**: Documentación de la API.
- **Jest & Supertest**: Pruebas unitarias y de integración.

---

## 🏛️ Arquitectura del Sistema
El sistema sigue un patrón MVC (Modelo-Vista-Controlador) adaptado para una API RESTful con Node.js y Express.

```mermaid
graph TD
    Client[Cliente: Mobile/Web] -->|HTTP/JSON| API[API Gateway: src/routes/index.js]
    
    subgraph "Nivel de Rutas"
        API --> UR[userRoutes]
        API --> PR[planRoutes]
        API --> WR[workoutRoutes]
        API --> LR[logRoutes]
        API --> SR[statsRoutes]
    end

    subgraph "Nivel de Controladores"
        UR --> UC[userController]
        PR --> PC[planController]
        WR --> WC[workoutController]
        LR --> LC[logController]
        SR --> SR_C[statsController]
    end

    subgraph "Nivel de Modelos (Mongoose)"
        UC --> UM[User Model]
        PR --> TPM[TrainingPlan Model]
        WR --> WM[Workout Template Model]
        LR --> WLM[WorkoutLog Model]
        SR --> SM[TrainingStats Model]
    end

    UM & TPM & WM & WLM & SM --> DB[(MongoDB Database)]
    
    subgraph "Documentación"
        SW[Swagger UI] -.-> API
    end
```

---

## 📊 Modelo de Datos (ERD)
El modelo de datos utiliza MongoDB para almacenar planes de entrenamiento maestros y los registros de ejecución de los atletas.

```mermaid
erDiagram
    USER ||--o{ TRAINING-PLAN : "crea (coach)"
    USER ||--o{ TRAINING-PLAN : "sigue (athlete)"
    USER ||--|| TRAINING-STATS : "tiene"
    
    TRAINING-PLAN ||--o{ WORKOUT-TEMPLATE : "contiene"
    
    WORKOUT-TEMPLATE ||--o{ WORKOUT-LOG : "es base de"
    USER ||--o{ WORKOUT-LOG : "registra (athlete)"
    
    USER {
        ObjectId _id
        String name
        String email
        String role "coach | athlete"
    }

    TRAINING-PLAN {
        ObjectId _id
        String name
        ObjectId coach
        ObjectId[] athletes
        Date startDate
        Date endDate
    }

    WORKOUT-TEMPLATE {
        ObjectId _id
        ObjectId plan
        String name
        Exercise[] exercises
    }

    WORKOUT-LOG {
        ObjectId _id
        ObjectId athlete
        ObjectId workout
        ExerciseResult[] exercises
        Boolean completed
    }

    TRAINING-STATS {
        ObjectId _id
        ObjectId user
        Number totalWorkouts
        Object[] bestLifts
    }
```

---

## 🛠️ Funcionalidades y Vistas de la API

### A. Gestión de Usuarios y Autenticación
*   **Registro**: `POST /api/users/register` - Permite crear nuevos perfiles (Coach o Atleta).
*   **Perfil**: `GET /api/users/profile/:id` - Obtiene la información detallada del usuario.
*   **Actualización**: `PUT /api/users/profile/:id` - Permite modificar datos del perfil.

### B. Vista del Entrenador (Planificación)
*   **Crear Plan**: `POST /api/training/plans` - Define un nuevo ciclo de entrenamiento.
*   **Gestionar Sesiones**: `POST /api/training/workouts` - Crea plantillas de sesiones dentro de un plan.
*   **Listar Planes**: `GET /api/training/plans/coach/:coachId` - Muestra todos los planes diseñados por un coach.

### C. Vista del Atleta (Ejecución)
*   **Mis Planes**: `GET /api/training/plans/athlete/:athleteId` - Lista los planes asignados al atleta.
*   **Registrar Entrenamiento**: `POST /api/training/logs` - El atleta guarda los resultados reales (peso, series, reps) de una sesión.
*   **Historial**: `GET /api/training/logs/athlete/:athleteId` - Consulta sesiones pasadas.

### D. Vista de Análisis y Estadística
*   **Dashboard**: `GET /api/training/stats/user/:userId` - Resumen de entrenamientos totales y mejores marcas (PRs).
*   **Progreso de Ejercicio**: `GET /api/training/stats/progress/:userId?exercise=Nombre` - Datos históricos para generar gráficas de evolución.

---

## 💻 Configuración Local
1. Copia el archivo `.env.example` a `.env` y configura las variables necesarias.
2. Instala las dependencias:
   ```bash
   npm install
   ```

## 🐳 Ejecución con Docker (Recomendado)
Para levantar el entorno de desarrollo:
```bash
docker-compose -f docker-compose.dev.yml up --build
```

## 🧪 Pruebas
Para ejecutar los tests:
```bash
npm test
```

## 📄 Documentación API
Una vez iniciada la aplicación, puedes acceder a Swagger en:
[http://localhost:3000/api-docs](http://localhost:3000/api-docs)

> [!NOTE]
> Todos los borrados en el sistema se realizan mediante **Soft Delete** (marcado de `isActive: false`) para preservar la integridad referencial y el historial de datos.
