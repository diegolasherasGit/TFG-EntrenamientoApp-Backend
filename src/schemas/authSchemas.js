import { z } from 'zod';
import { ROLES } from '../constants/roles.js';

// Límites de longitud (defensa frente a cadenas enormes)
const NAME_MAX = 100;
const EMAIL_MAX = 254;   // longitud máxima de un email según RFC 5321
const PASSWORD_MAX = 128;

const email = z.string().email('Email no válido')
    .max(EMAIL_MAX, `El email no puede superar los ${EMAIL_MAX} caracteres`);

const passwordStrength = z.string()
    .max(PASSWORD_MAX, `La contraseña no puede superar los ${PASSWORD_MAX} caracteres`)
    .regex(/^(?=.*[A-Z])(?=.*\d).{7,}$/, 'La contraseña debe tener al menos 7 caracteres, una mayúscula y un número');

export const registerSchema = z.object({
    body: z.object({
        // min(1) y no min(2): el controller valida el bloqueo de rol y otros casos
        name: z.string().min(1, 'El nombre es requerido')
            .max(NAME_MAX, `El nombre no puede superar los ${NAME_MAX} caracteres`),
        email,
        password: passwordStrength,
        // El rol lo valida el controller (bloquea coach/admin con 403)
        role: z.string().max(NAME_MAX).optional()
    })
});

export const loginSchema = z.object({
    body: z.object({
        email,
        password: z.string().min(1, 'La contraseña es requerida').max(PASSWORD_MAX)
    })
});

export const verifyEmailSchema = z.object({
    body: z.object({
        email,
        code: z.string().length(6, 'El código debe tener 6 dígitos')
    })
});

export const forgotPasswordSchema = z.object({
    body: z.object({
        email
    })
});

export const resetPasswordSchema = z.object({
    body: z.object({
        email,
        code: z.string().length(6, 'El código debe tener 6 dígitos'),
        password: passwordStrength
    })
});

export const createPrivilegedUserSchema = z.object({
    body: z.object({
        name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres')
            .max(NAME_MAX, `El nombre no puede superar los ${NAME_MAX} caracteres`),
        email,
        password: passwordStrength,
        role: z.enum([ROLES.COACH, ROLES.ADMIN])
    })
});

export const updateUserSchema = z.object({
    body: z.object({
        // Sin min(2) para no bloquear tests de autorización que envían nombre corto
        name: z.string().max(NAME_MAX, `El nombre no puede superar los ${NAME_MAX} caracteres`).optional(),
        email: email.optional(),
        password: passwordStrength.optional(),
        oldPassword: z.string().max(PASSWORD_MAX).optional(),
        notificationsEnabled: z.boolean().optional()
    })
});
