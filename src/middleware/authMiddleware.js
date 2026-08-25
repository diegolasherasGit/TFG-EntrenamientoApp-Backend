import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import logger from '../config/logger.js';
import { ROLES } from '../constants/roles.js';

// Middleware para verificar si el usuario está autenticado
export const protect = async (req, res, next) => {
    let token;

    // 1) Obtener token del header Authorization
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    // 2) Obtener token de la cookie
    else if (req.cookies && req.cookies.jwt) {
        token = req.cookies.jwt;
    }

    if (token) {
        try {
            // Decodificar el token y obtener el ID del usuario
            if (!process.env.JWT_SECRET) {
                return res.status(500).json({ message: 'Error de configuración del servidor' });
            }
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Buscar al usuario por ID y excluir la contraseña
            req.user = await User.findById(decoded.id).select('-password');

            if (!req.user || req.user.isDeleted) {
                return res.status(401).json({ message: 'No autorizado, usuario no encontrado o inactivo' });
            }

            // Invalidar tokens emitidos antes del último cambio de contraseña
            if (req.user.changedPasswordAfter(decoded.iat)) {
                return res.status(401).json({ message: 'Contraseña cambiada recientemente. Inicia sesión de nuevo.' });
            }

            next();
        } catch (error) {
            logger.error('Error al verificar el token:', error.message);
            res.status(401).json({ message: 'No autorizado, token fallido o expirado' });
        }
    } else {
        res.status(401).json({ message: 'No autorizado, no hay token' });
    }
};

// Middleware para exigir un abono activo en Bulderland.
// DEBE ir después de `protect` (necesita req.user). Coaches y admins quedan
// exentos: gestionan o imparten el entrenamiento, no necesitan cuota.
// Devuelve un código 'NO_ACTIVE_MEMBERSHIP' para que el móvil distinga este 403
// de uno de permisos y muestre la pantalla de "contacta con recepción".
export const requireActiveMembership = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'No autorizado, no hay sesión' });
    }

    if (req.user.role === ROLES.ADMIN || req.user.role === ROLES.COACH) {
        return next();
    }

    if (!req.user.hasActiveMembership()) {
        return res.status(403).json({
            code: 'NO_ACTIVE_MEMBERSHIP',
            message: 'Necesitas un abono activo en Bulderland para acceder. Contacta con recepción o tu entrenador.'
        });
    }

    next();
};

// Middleware para autorizar roles específicos (ej: 'coach')
export const restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                message: `Rol '${req.user ? req.user.role : 'desconocido'}' no autorizado para acceder a esta ruta`
            });
        }
        next();
    };
};
