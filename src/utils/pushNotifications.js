import { Expo } from 'expo-server-sdk';
import logger from '../config/logger.js';

// Inicializar el cliente de Expo
const expo = new Expo();

export const sendPushNotification = async (somePushTokens, title, body, data = {}) => {
  const messages = [];
  
  for (const pushToken of somePushTokens) {
    if (!Expo.isExpoPushToken(pushToken)) {
      logger.error(`Push token ${pushToken} is not a valid Expo push token`);
      continue;
    }

    messages.push({
      to: pushToken,
      sound: 'default',
      title: title,
      body: body,
      data: data,
    });
  }

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      logger.info(`Push: tickets recibidos de Expo: ${JSON.stringify(ticketChunk)}`);
      ticketChunk.forEach((t) => {
        if (t.status === 'error') {
          logger.error(`Push: ticket con error - ${t.message} (${t.details?.error || 'sin detalle'})`);
        }
      });
      tickets.push(...ticketChunk);
    } catch (error) {
      logger.error(`Error enviando push notifications: ${error.message}`);
    }
  }

  // El ticket solo confirma que Expo aceptó el envío, no que FCM/APNs lo haya
  // entregado de verdad. Comprobamos los recibos (con un pequeño margen, Expo
  // tarda un poco en procesarlos) para detectar fallos reales: credenciales de
  // FCM mal configuradas, token caducado, etc. Best-effort: no bloquea la respuesta.
  const receiptIds = tickets.filter((t) => t.status === 'ok' && t.id).map((t) => t.id);
  if (receiptIds.length > 0 && process.env.NODE_ENV !== 'test') {
    setTimeout(async () => {
      try {
        const receiptChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
        for (const chunk of receiptChunks) {
          const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
          for (const [id, receipt] of Object.entries(receipts)) {
            if (receipt.status === 'error') {
              logger.error(`Push: recibo con error para ${id} - ${receipt.message} (${receipt.details?.error || 'sin detalle'})`);
            } else {
              logger.info(`Push: recibo OK para ${id}`);
            }
          }
        }
      } catch (error) {
        logger.error(`Error comprobando recibos de push: ${error.message}`);
      }
    }, 15000);
  }

  return tickets;
};
