import { z } from 'zod';

export const registerSchema = z.object({
    body: z.object({
        name: z.string({
            required_error: "El nombre es requerido",
        }).min(2, "El nombre debe tener al menos 2 caracteres"),

        email: z.string({
            required_error: "El email es requerido",
        }).email("Email no válido"),

        password: z.string({
            required_error: "La contraseña es requerida",
        }).min(6, "La contraseña debe tener al menos 6 caracteres"),

        role: z.enum(['athlete', 'coach'], {
            errorMap: () => ({ message: "El rol debe ser 'athlete' o 'coach'" })
        }).default('athlete')
    })
});

export const loginSchema = z.object({
    body: z.object({
        email: z.string({
            required_error: "El email es requerido",
        }).email("Email no válido"),

        password: z.string({
            required_error: "La contraseña es requerida",
        })
    })
});
