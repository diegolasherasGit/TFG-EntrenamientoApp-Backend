import { z } from 'zod';

export const createMessageSchema = z.object({
    body: z.object({
        text: z.string({ required_error: 'El texto del mensaje es requerido' })
            .min(1, 'El mensaje no puede estar vacío')
            .max(2000, 'El mensaje no puede superar los 2000 caracteres')
    })
});
