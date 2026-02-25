import { jest } from '@jest/globals';
import { validate } from '../middleware/validateMiddleware.js';
import AppError from '../utils/AppError.js';

describe('Validate Middleware', () => {
    let req;
    let res;
    let next;
    let schemaMock;

    beforeEach(() => {
        req = {
            body: {},
            query: {},
            params: {}
        };
        res = {};
        next = jest.fn();
        schemaMock = {
            parseAsync: jest.fn()
        };
    });

    it('should call next if validation passes', async () => {
        schemaMock.parseAsync.mockResolvedValue({});

        await validate(schemaMock)(req, res, next);

        expect(schemaMock.parseAsync).toHaveBeenCalledWith({
            body: req.body,
            query: req.query,
            params: req.params
        });
        expect(next).toHaveBeenCalledWith();
        expect(next).toHaveBeenCalledTimes(1);
    });

    it('should call next with AppError if validation fails', async () => {
        const zodError = {
            errors: [
                { message: 'Title is required' },
                { message: 'Age must be a number' }
            ]
        };
        schemaMock.parseAsync.mockRejectedValue(zodError);

        await validate(schemaMock)(req, res, next);

        expect(next).toHaveBeenCalledWith(expect.any(AppError));
        const errorArg = next.mock.calls[0][0];
        expect(errorArg.message).toBe('Datos inválidos: Title is required. Age must be a number');
        expect(errorArg.statusCode).toBe(400);
    });
});
