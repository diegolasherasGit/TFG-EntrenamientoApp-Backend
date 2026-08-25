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
      logger.debug(`Ticket chunk: ${JSON.stringify(ticketChunk)}`);
      tickets.push(...ticketChunk);
    } catch (error) {
      logger.error(`Error enviando push notifications: ${error.message}`);
    }
  }

  return tickets;
};
