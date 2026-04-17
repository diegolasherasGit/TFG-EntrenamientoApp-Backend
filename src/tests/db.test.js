import { connectDB } from '../config/db.js';
import mongoose from 'mongoose';
import { jest } from '@jest/globals';

describe('Database Connection', () => {
    let originalSetTimeout;

    beforeAll(() => {
        originalSetTimeout = global.setTimeout;
        global.setTimeout = (fn) => fn(); // Acelerar los retries a 0ms
    });

    afterAll(() => {
        global.setTimeout = originalSetTimeout;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('Debe conectar exitosamente a la DB', async () => {
        const mockLog = jest.spyOn(console, 'log').mockImplementation(() => { });
        const mockConnect = jest.spyOn(mongoose, 'connect').mockResolvedValue({
            connection: { host: 'test.host.com' }
        });

        await connectDB();

        expect(mockConnect).toHaveBeenCalled();
        expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('MongoDB conectado:'));
    });

    it('Debe devolver error y terminar proceso si falla tras retries', async () => {
        const mockLog = jest.spyOn(console, 'log').mockImplementation(() => { });
        const mockError = jest.spyOn(console, 'error').mockImplementation(() => { });
        const mockExit = jest.spyOn(process, 'exit').mockImplementation((code) => {
            throw new Error(`process.exit: ${code}`); // Lanzamos error para detener ejecución y testear exit
        });

        const mockConnect = jest.spyOn(mongoose, 'connect').mockRejectedValue(new Error('Connection Failed'));

        await expect(connectDB()).rejects.toThrow('process.exit: 1');

        expect(mockConnect).toHaveBeenCalledTimes(10); // Debe iterar 10 maxRetries
        expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Reintentando...'));
        expect(mockError).toHaveBeenCalledWith(expect.stringContaining('No se pudo conectar a MongoDB.'));
        expect(mockExit).toHaveBeenCalledWith(1);
    });
});
