import { jest } from '@jest/globals';
import ApiFeatures from '../../utils/ApiFeatures.js';

describe('ApiFeatures Utility', () => {
    let mockQuery;

    beforeEach(() => {
        mockQuery = {
            find: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis()
        };
    });

    it('filter: debería filtrar campos básicos y transformar operadores (gte, lte, etc.)', () => {
        const queryString = { name: 'Diego', age: { gte: '20' }, sort: 'name' };
        const features = new ApiFeatures(mockQuery, queryString).filter();

        expect(mockQuery.find).toHaveBeenCalledWith({
            name: 'Diego',
            age: { $gte: '20' }
        });
        expect(features.query).toBe(mockQuery);
    });

    it('sort: debería ordenar por múltiples campos si se proporcionan', () => {
        const queryString = { sort: 'price,duration' };
        new ApiFeatures(mockQuery, queryString).sort();

        expect(mockQuery.sort).toHaveBeenCalledWith('price duration');
    });

    it('sort: debería usar el orden por defecto si no se proporciona sort', () => {
        const queryString = {};
        new ApiFeatures(mockQuery, queryString).sort();

        expect(mockQuery.sort).toHaveBeenCalledWith('-createdAt');
    });

    it('limitFields: debería seleccionar campos específicos', () => {
        const queryString = { fields: 'name,email' };
        new ApiFeatures(mockQuery, queryString).limitFields();

        expect(mockQuery.select).toHaveBeenCalledWith('name email');
    });

    it('limitFields: debería excluir __v por defecto', () => {
        const queryString = {};
        new ApiFeatures(mockQuery, queryString).limitFields();

        expect(mockQuery.select).toHaveBeenCalledWith('-__v');
    });

    it('paginate: debería calcular skip y limit correctamente', () => {
        const queryString = { page: '2', limit: '5' };
        new ApiFeatures(mockQuery, queryString).paginate();

        expect(mockQuery.skip).toHaveBeenCalledWith(5);
        expect(mockQuery.limit).toHaveBeenCalledWith(5);
    });

    it('paginate: debería usar valores por defecto para paginación', () => {
        const queryString = {};
        new ApiFeatures(mockQuery, queryString).paginate();

        expect(mockQuery.skip).toHaveBeenCalledWith(0);
        expect(mockQuery.limit).toHaveBeenCalledWith(10);
    });
});
