import User from '../models/User.js';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import sendEmail from '../utils/email.js';

const client = new OAuth2Client(process.env.GOOGLE_WEB_CLIENT_ID);

const signToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN
    });
};

export const register = catchAsync(async (req, res, next) => {
    const { name, email, password, role } = req.body;

    if (role === 'admin' || role === 'coach') {
        return next(new AppError('No permitido: No puedes registrar un usuario con rol de administrador o entrenador desde aquí.', 403));
    }

    const passRegex = /^(?=.*[A-Z])(?=.*\d).{7,}$/;
    if (!passRegex.test(password)) {
        return next(new AppError('La contraseña debe tener al menos 7 caracteres, una mayúscula y un número.', 400));
    }

    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return next(new AppError('El usuario ya existe', 400));
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    const newUser = new User({
        name,
        email,
        password,
        role: 'athlete', // Registro público siempre es athlete
        verificationCode: code,
        verificationCodeExpires: Date.now() + 10 * 60 * 1000 // 10 minutos
    });

    await newUser.save();

    try {
        await sendEmail({
            email: newUser.email,
            subject: 'Código de Verificación - BulderLand',
            message: `¡Hola ${newUser.name}!\n\nTu código de verificación de 6 dígitos es: ${code}\nIngrésalo en la app para activar tu cuenta.\n\nEste código caduca en 10 minutos.`
        });

        res.status(201).json({
            message: 'Usuario registrado con éxito. Por favor verifica tu correo.',
            requireVerification: true,
            user: {
                id: newUser._id,
                email: newUser.email
            }
        });
    } catch {
        await User.findByIdAndDelete(newUser._id);
        return next(new AppError('Hubo un error mandando el correo de verificación. Inténtalo de nuevo.', 500));
    }
});

const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{7,}$/;

const GENERIC_RESET_MSG =
    'Si el correo está registrado con contraseña, recibirás un código para restablecerla en unos minutos.';

/** Solicitar código de recuperación por email (no revela si el usuario existe) */
export const forgotPassword = catchAsync(async (req, res, next) => {
    const { email } = req.body;

    if (!email) {
        return next(new AppError('Introduce tu correo electrónico.', 400));
    }

    const user = await User.findOne({ email: email.toLowerCase().trim(), isDeleted: false });

    const canReset = user && !(user.googleId && !user.password);

    if (canReset) {
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        user.verificationCode = code;
        user.verificationCodeExpires = Date.now() + 15 * 60 * 1000; // 15 minutos
        await user.save({ validateBeforeSave: false });

        try {
            await sendEmail({
                email: user.email,
                subject: 'Recuperar contraseña - BulderLand',
                message: `¡Hola ${user.name}!\n\nHas solicitado restablecer tu contraseña en BulderLand.\n\nTu código de recuperación es: ${code}\n\nIntrodúcelo en la app junto con tu nueva contraseña. El código caduca en 15 minutos.\n\nSi no has sido tú, ignora este mensaje.`,
            });
        } catch {
            user.verificationCode = undefined;
            user.verificationCodeExpires = undefined;
            await user.save({ validateBeforeSave: false });
            return next(new AppError('No se pudo enviar el correo. Inténtalo más tarde.', 500));
        }
    }

    res.status(200).json({ message: GENERIC_RESET_MSG });
});

/** Restablecer contraseña con el código recibido por email */
export const resetPassword = catchAsync(async (req, res, next) => {
    const { email, code, password } = req.body;

    if (!email || !code || !password) {
        return next(new AppError('Correo, código y nueva contraseña son obligatorios.', 400));
    }

    if (!PASSWORD_REGEX.test(password)) {
        return next(
            new AppError('La contraseña debe tener al menos 7 caracteres, una mayúscula y un número.', 400)
        );
    }

    const user = await User.findOne({
        email: email.toLowerCase().trim(),
        verificationCode: code,
        verificationCodeExpires: { $gt: Date.now() },
        isDeleted: false,
    });

    if (!user) {
        return next(new AppError('El código es inválido o ha expirado.', 400));
    }

    if (user.googleId && !user.password) {
        return next(
            new AppError('Esta cuenta usa Google. Inicia sesión con el botón de Google.', 400)
        );
    }

    user.password = password;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    user.isVerified = true;
    await user.save();

    const token = signToken(user._id);

    res.status(200).json({
        message: 'Contraseña actualizada. Ya puedes iniciar sesión.',
        token,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
        },
    });
});

export const verifyEmail = catchAsync(async (req, res, next) => {
    const { email, code } = req.body;

    if (!email || !code) {
        return next(new AppError('Proporciona el correo y el código de verificación.', 400));
    }

    const user = await User.findOne({
        email,
        verificationCode: code,
        verificationCodeExpires: { $gt: Date.now() }
    });

    if (!user) {
        return next(new AppError('El código es inválido o ha expirado.', 400));
    }

    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save({ validateBeforeSave: false });

    // Login tras validar código
    const token = signToken(user._id);

    res.status(200).json({
        message: 'Email verificado con éxito',
        token,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        }
    });
});

export const createPrivilegedUser = catchAsync(async (req, res, next) => {
    const { name, email, password, role } = req.body;

    // El middleware restrictTo('admin') ya garantiza que req.user.role === 'admin'

    if (role !== 'admin' && role !== 'coach') {
        return next(new AppError('Rol inválido param esta operación. Debe ser admin o coach.', 400));
    }

    const passRegex = /^(?=.*[A-Z])(?=.*\d).{7,}$/;
    if (!passRegex.test(password)) {
        return next(new AppError('La contraseña debe tener al menos 7 caracteres, una mayúscula y un número.', 400));
    }

    // Verificar si el usuario ya existe
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return next(new AppError('El usuario ya existe', 400));
    }

    const newUser = new User({
        name,
        email,
        password,
        role // Puede ser 'admin' o 'coach'
    });

    await newUser.save();

    res.status(201).json({
        message: 'Usuario privilegiado creado con éxito',
        user: {
            id: newUser._id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role
        }
    });
});

export const restoreUser = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    // El middleware restrictTo('admin') ya garantiza que req.user.role === 'admin'

    const user = await User.findByIdAndUpdate(id, { isDeleted: false }, { new: true });

    if (!user) {
        return next(new AppError('No hemos encontrado al usuario para restaurar la cuenta.', 404));
    }

    res.status(200).json({ message: 'La cuenta ha sido restaurada con éxito.', user });
});

export const getDeletedUsers = catchAsync(async (req, res) => {
    // El middleware restrictTo('admin') ya garantiza que req.user.role === 'admin'
    const deletedUsers = await User.find({ isDeleted: true }).select('name email role');
    res.status(200).json(deletedUsers);
});

export const login = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || user.isDeleted || !(await user.comparePassword(password))) {
        return next(new AppError('Email o contraseña incorrectos', 401));
    }

    if (!user.isVerified && !user.googleId) {
        return next(new AppError('Por favor verifica tu correo electrónico antes de iniciar sesión.', 403));
    }

    const token = signToken(user._id);

    res.status(200).json({
        message: 'Login exitoso',
        token,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        }
    });
});

export const getProfile = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    // IDOR Protection: solo el propio usuario, admins o coaches pueden ver perfiles
    if (req.user._id.toString() !== id && req.user.role !== 'admin' && req.user.role !== 'coach') {
        return next(new AppError('No tienes permiso para ver este perfil', 403));
    }

    const user = await User.findById(id).select('-password');

    if (!user || user.isDeleted) {
        return next(new AppError('No hemos podido encontrar este perfil. ¡Vuelve a intentarlo!', 404));
    }

    res.status(200).json(user);
});

export const updateUser = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { name, email, password, role, oldPassword } = req.body;

    const user = await User.findById(id);
    if (!user) {
        return next(new AppError('Usuario no encontrado', 404));
    }

    // Verificar permiso: solo el propio usuario o un admin
    if (req.user._id.toString() !== id && req.user.role !== 'admin') {
        return next(new AppError('No tienes permiso para actualizar este perfil', 403));
    }

    if (name) {
        user.name = name;
    }
    if (role && req.user.role === 'admin') {
        user.role = role;
    }
    if (email) {
        user.email = email;
    }
    if (req.body.notificationsEnabled !== undefined) {
        user.notificationsEnabled = req.body.notificationsEnabled;
    }
    if (req.body.expoPushToken !== undefined) {
        user.expoPushToken = req.body.expoPushToken;
    }

    if (password) {
        if (!(await user.comparePassword(oldPassword))) {
            return next(new AppError('La contraseña actual es incorrecta', 401));
        }
        const passRegex = /^(?=.*[A-Z])(?=.*\d).{7,}$/;
        if (!passRegex.test(password)) {
            return next(new AppError('La nueva contraseña debe tener más de 6 caracteres, una mayúscula y un número.', 400));
        }
        user.password = password;
    }

    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({ message: 'Usuario actualizado con éxito', user: userResponse });
});

export const deleteUser = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    // Verificar permiso: solo el propio usuario o un admin
    if (req.user._id.toString() !== id && req.user.role !== 'admin') {
        return next(new AppError('No tienes permiso para desactivar esta cuenta', 403));
    }

    const user = await User.findByIdAndUpdate(id, { isDeleted: true }, { new: true });

    if (!user) {
        return next(new AppError('No hemos encontrado al usuario para desactivar la cuenta.', 404));
    }

    res.status(200).json({ message: 'Tu cuenta ha sido desactivada. ¡Esperamos verte pronto de vuelta!' });
});

export const googleLogin = catchAsync(async (req, res, next) => {
    const { idToken } = req.body;

    if (!idToken) {
        return next(new AppError('Token de Google no proporcionado', 400));
    }

    // Verificar el token con Google
    const ticket = await client.verifyIdToken({
        idToken: idToken,
        audience: process.env.GOOGLE_WEB_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture: photo } = payload;

    // Buscar si ya existe el usuario
    let user = await User.findOne({
        $or: [
            { googleId: googleId },
            { email: email }
        ]
    });

    if (user) {
        if (!user.googleId) {
            user.googleId = googleId;
            if (photo && !user.photo) {
                user.photo = photo;
            }
            await user.save();
        }
    } else {
        user = new User({
            name,
            email,
            googleId,
            photo,
            role: 'athlete'
        });
        await user.save();
    }

    const token = signToken(user._id);

    res.status(200).json({
        message: 'Login con Google exitoso',
        token,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            photo: user.photo
        }
    });
});

export const uploadPhoto = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { photoBase64, mimeType } = req.body;

    // Verificar permiso: solo el propio usuario o un admin
    if (req.user._id.toString() !== id && req.user.role !== 'admin') {
        return next(new AppError('No tienes permiso para modificar esta foto de perfil', 403));
    }

    if (!photoBase64) {
        return next(new AppError('No se ha proporcionado imagen (photoBase64 vacío).', 400));
    }

    // A3: Validar MIME type contra allowlist
    const allowedMimes = ['image/jpeg', 'image/png'];
    if (!allowedMimes.includes(mimeType)) {
        return next(new AppError('Solo se permiten imágenes JPEG o PNG', 400));
    }

    const user = await User.findById(id);
    if (!user) {
        return next(new AppError('Usuario no encontrado', 404));
    }

    // Eliminar foto antigua si es local (A1: sanitizar filename)
    if (user.photo && user.photo.includes('/uploads/')) {
        const oldFilename = path.basename(user.photo);
        if (!oldFilename.includes('..')) {
            const oldPath = path.join('uploads', oldFilename);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }
    }

    // Guardar la imagen base64 como archivo
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir);
    }

    const ext = mimeType === 'image/png' ? '.png' : '.jpeg';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = `profile-${uniqueSuffix}${ext}`;
    const filePath = path.join(uploadDir, filename);

    // Decodificar base64 y guardar (C2: límite de tamaño)
    const buffer = Buffer.from(photoBase64, 'base64');
    if (buffer.length > 500 * 1024) {
        return next(new AppError('La imagen no puede superar los 500KB', 400));
    }
    fs.writeFileSync(filePath, buffer);

    // URL accesible desde el exterior (Mobile)
    const forwardedHost = req.get('X-Forwarded-Host') || req.get('host');
    const forwardedProto = req.get('X-Forwarded-Proto') || req.protocol;
    const photoUrl = `${forwardedProto}://${forwardedHost}/uploads/${filename}`;

    user.photo = photoUrl;
    await user.save();

    res.status(200).json({
        message: 'Foto de perfil actualizada con éxito',
        photo: photoUrl,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            photo: user.photo
        }
    });
});

export const removePhoto = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    // Verificar permiso: solo el propio usuario o un admin
    if (req.user._id.toString() !== id && req.user.role !== 'admin') {
        return next(new AppError('No tienes permiso para eliminar esta foto de perfil', 403));
    }

    const user = await User.findById(id);

    if (!user) {
        return next(new AppError('Usuario no encontrado', 404));
    }

    // Eliminar archivo si es local
    // A1: sanitizar filename para evitar path traversal
    if (user.photo && user.photo.includes('/uploads/')) {
        const filename = path.basename(user.photo);
        if (!filename.includes('..')) {
            const filePath = path.join('uploads', filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
    }

    user.photo = undefined;
    await user.save();

    res.status(200).json({
        message: 'Foto de perfil eliminada con éxito',
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            photo: null
        }
    });
});
