import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Middleware para verificar si el usuario está autenticado
export const protect = async (req, res, next) => {
    // Leer el JWT de la cookie 'jwt'
    const token = req.cookies.jwt;

    if (token) {
        try {
            // Decodificar el token y obtener el ID del usuario
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key_temporal');

            // Buscar al usuario por ID y excluir la contraseña
            req.user = await User.findById(decoded.id).select('-password');

            if (!req.user || !req.user.isActive) {
                return res.status(401).json({ message: 'No autorizado, usuario no encontrado o inactivo' });
            }

            next();
        } catch (error) {
            console.error('Error al verificar el token:', error.message);
            res.status(401).json({ message: 'No autorizado, token fallido o expirado' });
        }
    } else {
        res.status(401).json({ message: 'No autorizado, no hay token' });
    }
};

// Middleware para autorizar roles específicos (ej: 'coach')
export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                message: `Rol '${req.user ? req.user.role : 'desconocido'}' no autorizado para acceder a esta ruta`
            });
        }
        next();
    };
};
