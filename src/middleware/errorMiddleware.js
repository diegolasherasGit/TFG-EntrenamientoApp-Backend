import AppError from '../utils/AppError.js';

// Manejo de errores de base de datos (Mongoose) - CastError (ID inválido)
const handleCastErrorDB = err => {
    const message = `Recurso no encontrado. ID inválido: ${err.value}.`;
    return new AppError(message, 400);
};

// Manejo de errores de base de datos (Mongoose) - Validación
const handleValidationErrorDB = err => {
    const errors = Object.values(err.errors).map(el => el.message);
    const message = `Datos de entrada inválidos. ${errors.join('. ')}`;
    return new AppError(message, 400);
};

// Manejo de errores de base de datos (MongoDB) - Claves duplicadas
const handleDuplicateFieldsDB = err => {
    // Busca el valor duplicado entre comillas en el mensaje de error de MongoDB
    const limitParams = err.errmsg ? err.errmsg.match(/(["'])(\\?.)*?\1/) : ["valor"];
    const value = limitParams ? limitParams[0] : "";
    const message = `El valor ${value} ya está en uso. Por favor, usa otro.`;
    return new AppError(message, 400);
};

// Errores JWT
const handleJWTError = () => new AppError('Token inválido. Por favor, inicia sesión de nuevo.', 401);
const handleJWTExpiredError = () => new AppError('Tu sesión ha expirado. Por favor, inicia sesión de nuevo.', 401);

const sendErrorDev = (err, res) => {
    res.status(err.statusCode).json({
        status: err.status,
        error: err,
        message: err.message,
        stack: err.stack
    });
};

const sendErrorProd = (err, res) => {
    // Errores operacionales (creados por nosotros, predecibles): enviamos mensaje al cliente
    if (err.isOperational) {
        res.status(err.statusCode).json({
            status: err.status,
            message: err.message
        });
    }
    // Errores de programación o desconocidos: no filtramos detalles técnicos al cliente
    else {
        // 1) Loggea el error para nosotros (en servidor)
        console.error('ERROR 💥', err);

        // 2) Envía un mensaje genérico
        res.status(500).json({
            status: 'error',
            message: 'Algo salió mal en el servidor.'
        });
    }
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    if (process.env.NODE_ENV === 'development') {
        sendErrorDev(err, res);
    } else {
        // Copiamos el error para no modificar el original al manipularlo en las funciones handler
        let error = { ...err };
        error.message = err.message;

        if (error.name === 'CastError') { error = handleCastErrorDB(error); }
        if (error.code === 11000) { error = handleDuplicateFieldsDB(error); } // MongoServerError code for duplicates
        if (error.name === 'ValidationError') { error = handleValidationErrorDB(error); }
        if (error.name === 'JsonWebTokenError') { error = handleJWTError(); }
        if (error.name === 'TokenExpiredError') { error = handleJWTExpiredError(); }

        sendErrorProd(error, res);
    }
};

export default errorHandler;
