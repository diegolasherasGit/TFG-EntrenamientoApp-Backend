import AppError from '../utils/AppError.js';

/**
 * Middleware genérico para validar endpoints usando Zod
 * @param {import('zod').AnyZodObject} schema 
 */
export const validate = (schema) => async (req, res, next) => {
    try {
        await schema.parseAsync({
            body: req.body ?? {},
            query: req.query ?? {},
            params: req.params ?? {},
        });
        return next();
    } catch (error) {
        // Formatear los errores de Zod en un solo mensaje (Zod v4 usa .issues)
        const issues = error.issues ?? error.errors;
        if (!issues) {return next(error);}
        const errorMessages = issues.map(err => err.message).join('. ');
        return next(new AppError(`Datos inválidos: ${errorMessages}`, 400));
    }
};
