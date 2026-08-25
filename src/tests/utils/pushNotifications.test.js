import { jest } from '@jest/globals';

const mExpo = {
    chunkPushNotifications: jest.fn(),
    sendPushNotificationsAsync: jest.fn(),
    chunkPushNotificationReceiptIds: jest.fn(() => []),
    getPushNotificationReceiptsAsync: jest.fn(() => ({}))
};

const MockExpo = jest.fn(() => mExpo);
MockExpo.isExpoPushToken = jest.fn((token) => typeof token === 'string' && token.startsWith('ExponentPushToken'));

// Mock the module before importing the subject under test
jest.unstable_mockModule('expo-server-sdk', () => ({
    Expo: MockExpo
}));

// Use dynamic import after mocking
const { sendPushNotification } = await import('../../utils/pushNotifications.js');

describe('pushNotifications utility', () => {

    beforeEach(() => {
        jest.clearAllMocks();
        // Since the module instantiates it once, we just reset the mock functions on the instance
        mExpo.chunkPushNotifications.mockReturnValue([
            [{ to: 'ExponentPushToken[123]', title: 'Test', body: 'Test Body', sound: 'default', data: {} }]
        ]);
        mExpo.sendPushNotificationsAsync.mockResolvedValue([
            { status: 'ok', id: 'ticket-1' }
        ]);
    });

    it('debería ignorar tokens inválidos y procesar los válidos', async () => {
        const tokens = ['InvalidToken', 'ExponentPushToken[123]'];
        
        mExpo.chunkPushNotifications.mockReturnValue([
            [{ to: 'ExponentPushToken[123]', title: 'Test', body: 'Test Body', sound: 'default', data: {} }]
        ]);

        const tickets = await sendPushNotification(tokens, 'Test', 'Test Body');
        
        expect(mExpo.chunkPushNotifications).toHaveBeenCalledWith([
            {
                to: 'ExponentPushToken[123]',
                sound: 'default',
                title: 'Test',
                body: 'Test Body',
                data: {}
            }
        ]);
        expect(tickets.length).toBe(1);
        expect(tickets[0].id).toBe('ticket-1');
    });

    it('debería manejar errores al enviar asíncronamente (sin hacer crash)', async () => {
        mExpo.sendPushNotificationsAsync.mockRejectedValue(new Error('Network error'));
        const tokens = ['ExponentPushToken[123]'];
        
        const tickets = await sendPushNotification(tokens, 'Test', 'Test Body');
        
        expect(tickets.length).toBe(0); // tickets vacío porque falló el envío
    });
});
