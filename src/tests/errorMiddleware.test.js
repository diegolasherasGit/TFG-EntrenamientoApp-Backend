import { jest } from '@jest/globals';
import errorHandler from '../middleware/errorMiddleware.js';
import AppError from '../utils/AppError.js';

describe('Error Middleware', () => {
    let req;
    let res;
    let next;

    beforeEach(() => {
        req = {};
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        next = jest.fn();
        process.env.NODE_ENV = 'production';
    });

    afterAll(() => {
        process.env.NODE_ENV = 'test';
    });

    it('should use default statusCode and status if not provided', () => {
        const error = new Error('Test Error');
        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            status: 'error',
            message: 'Algo salió mal en el servidor.'
        }));
    });

    it('should handle operational AppError correctly in production', () => {
        const error = new AppError('Custom operational error', 404);
        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            status: 'fail',
            message: 'Custom operational error'
        });
    });

    it('should handle unexpected errors with a generic message in production', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
        const error = new Error('Programmatic fail');
        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            status: 'error',
            message: 'Algo salió mal en el servidor.'
        });

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it('should send details in development environment', () => {
        process.env.NODE_ENV = 'development';
        const error = new AppError('Dev err', 400);
        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            status: 'fail',
            error: error,
            message: 'Dev err',
            stack: error.stack
        });
    });

    it('should handle MongoDB CastError', () => {
        const error = {
            name: 'CastError',
            value: 'invalidId123',
            message: 'Cast to ObjectId failed'
        };
        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: 'Recurso no encontrado. ID inválido: invalidId123.'
        }));
    });

    it('should handle MongoDB duplicate key error', () => {
        const error = {
            code: 11000,
            errmsg: 'E11000 duplicate key error collection: test.users index: email_1 dup key: { email: "test@test.com" }',
            message: 'Duplicate key'
        };
        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: 'El valor "test@test.com" ya está en uso. Por favor, usa otro.'
        }));
    });

    it('should handle MongoDB ValidationError', () => {
        const error = {
            name: 'ValidationError',
            errors: {
                name: { message: 'Name is required' },
                age: { message: 'Age must be >= 18' }
            },
            message: 'Validation failed'
        };
        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: 'Datos de entrada inválidos. Name is required. Age must be >= 18'
        }));
    });

    it('should handle JsonWebTokenError', () => {
        const error = {
            name: 'JsonWebTokenError',
            message: 'invalid token'
        };
        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: 'Token inválido. Por favor, inicia sesión de nuevo.'
        }));
    });

    it('should handle TokenExpiredError', () => {
        const error = {
            name: 'TokenExpiredError',
            message: 'jwt expired'
        };
        errorHandler(error, req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: 'Tu sesión ha expirado. Por favor, inicia sesión de nuevo.'
        }));
    });
});
