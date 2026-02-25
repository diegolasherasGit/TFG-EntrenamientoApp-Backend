/**
 * Clase base para errores operacionales de la aplicación.
 * Permite centralizar la creación de errores con mensaje y status code.
 */
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);

        this.statusCode = statusCode;
        // 'fail' para errores 4xx (cliente), 'error' para 5xx (servidor)
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        // Indica que el error fue previsto/operacional y no un bug no controlado
        this.isOperational = true;

        // Captura la traza del error (stack trace) excluyendo este constructor de ella
        Error.captureStackTrace(this, this.constructor);
    }
}

export default AppError;
