import User from '../models/User.js';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import sendEmail from '../utils/email.js';
import { saveBase64Image, buildUploadUrl, removeLocalImage } from '../utils/imageUpload.js';
import { ROLES } from '../constants/roles.js';
import { MEMBERSHIP_STATUS, MEMBERSHIP_PLANS, computeValidUntil } from '../constants/membership.js';
import { notifyAthletes } from '../utils/notifyAthletes.js';
import { normalizeDni } from '../utils/dni.js';
import logger from '../config/logger.js';

const client = new OAuth2Client(process.env.GOOGLE_WEB_CLIENT_ID);

const signToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN
    });
};

export const register = catchAsync(async (req, res, next) => {
    const { name, email, password, role } = req.body;

    if (role === ROLES.ADMIN || role === ROLES.COACH) {
        return next(new AppError('No permitido: No puedes registrar un usuario con rol de administrador o entrenador desde aquí.', 403));
    }

    // La fuerza de la contraseña ya la valida registerSchema (validate middleware).

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
        role: ROLES.ATHLETE, // Registro público siempre es athlete
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

    // La fuerza de la contraseña ya la valida resetPasswordSchema (validate middleware).

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
    // Al validar el correo dejamos las notificaciones activadas por defecto
    // (el usuario puede desactivarlas luego en Ajustes).
    user.notificationsEnabled = true;
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
            role: user.role,
            notificationsEnabled: user.notificationsEnabled
        }
    });
});

export const createPrivilegedUser = catchAsync(async (req, res, next) => {
    const { name, email, password, role } = req.body;

    // El middleware restrictTo(ROLES.ADMIN) ya garantiza que req.user.role === ROLES.ADMIN

    if (role !== ROLES.ADMIN && role !== ROLES.COACH) {
        return next(new AppError('Rol inválido para esta operación. Debe ser admin o coach.', 400));
    }

    // La fuerza de la contraseña ya la valida createPrivilegedUserSchema (validate middleware).

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

    // El middleware restrictTo(ROLES.ADMIN) ya garantiza que req.user.role === ROLES.ADMIN

    const user = await User.findByIdAndUpdate(id, { isDeleted: false }, { new: true });

    if (!user) {
        return next(new AppError('No hemos encontrado al usuario para restaurar la cuenta.', 404));
    }

    res.status(200).json({ message: 'La cuenta ha sido restaurada con éxito.', user });
});

// Devuelve el abono del usuario autenticado. Lo usa la pantalla de bloqueo del
// móvil para saber si ya hay una solicitud pendiente o si debe pedir activación.
export const getMyMembership = catchAsync(async (req, res) => {
    // `protect` ya cargó al usuario, así que no hace falta otra consulta. Devolvemos
    // además `active` (acceso EFECTIVO según hasActiveMembership: contempla validUntil
    // caducado aunque el estado siga 'active' hasta que el cron lo marque 'expired').
    // El móvil debe decidir el acceso por `active`, no por el status crudo.
    res.status(200).json({
        membership: req.user.membership ?? { status: MEMBERSHIP_STATUS.NONE },
        active: req.user.hasActiveMembership()
    });
});

// El usuario autenticado solicita la activación de su abono aportando su DNI/NIE.
// El DNI se guarda en su cuenta (único) y se envía a los administradores para que
// verifiquen contra los registros de Bulderland que es quien pagó. Marca el abono
// como 'pending'; la aprobación la hace un admin desde updateMembership.
export const requestMembership = catchAsync(async (req, res, next) => {
    const dni = normalizeDni(req.body.dni);

    if (req.user.hasActiveMembership()) {
        return next(new AppError('Ya tienes un abono activo.', 400));
    }

    // Si el DNI ya está registrado en OTRA cuenta, lo rechazamos con un mensaje claro
    // (además del índice único, para no depender solo del error 11000).
    const dniOwner = await User.findOne({ dni });
    if (dniOwner && dniOwner._id.toString() !== req.user._id.toString()) {
        return next(new AppError('Ese DNI ya está registrado en otra cuenta.', 400));
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            dni,
            membership: {
                status: MEMBERSHIP_STATUS.PENDING,
                requestedAt: new Date()
            }
        },
        { new: true, runValidators: true }
    ).select('name email dni membership');

    // Avisar a los administradores. notifyAthletes es genérico (crea notificación
    // in-app + push y respeta notificationsEnabled), así que sirve para admins.
    const admins = await User.find({ role: ROLES.ADMIN, isDeleted: { $ne: true } }).select('_id');
    await notifyAthletes(admins.map(a => a._id), {
        type: 'system',
        title: 'Solicitud de abono',
        message: `${user.name} (${user.email}) solicita activar su abono. DNI: ${dni}`
    });

    // Acuse de recibo para el propio atleta: deja constancia en su bandeja
    // (no solo el toast efímero) de que la solicitud llegó y está en revisión.
    await notifyAthletes([user._id], {
        type: 'system',
        title: 'Solicitud recibida',
        message: 'Hemos recibido tu solicitud de abono. Un administrador la revisará y activará tu acceso en breve.'
    });

    res.status(200).json({
        message: 'Solicitud enviada. Un administrador revisará tu abono en breve.',
        membership: user.membership
    });
});

// Actualiza el abono/cuota de un usuario (solo admin). Es la fuente de verdad
// del acceso al contenido: gestión manual de los abonos de Bulderland.
export const updateMembership = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { status, plan } = req.body;

    // El middleware restrictTo(ROLES.ADMIN) ya garantiza que req.user.role === ROLES.ADMIN

    const target = await User.findById(id).select('dni');
    if (!target) {
        return next(new AppError('No hemos encontrado al usuario para actualizar su abono.', 404));
    }

    const activated = status === MEMBERSHIP_STATUS.ACTIVE;

    // Reemplazamos el subdocumento completo: al desactivar (none/expired) se limpian
    // plan y validUntil; al activar se calcula validUntil a partir del tipo de plan.
    let membership = { status };

    if (activated) {
        // Solo se puede ACTIVAR un abono si el usuario ha aportado su DNI desde la app.
        // El DNI es la clave de verificación contra los registros de Bulderland y evita
        // activar la "cuenta equivocada" cuando el email con el que paga != el email con
        // el que usa la app (Google solo expone el email, no el DNI).
        if (!target.dni) {
            return next(new AppError(
                'Este usuario aún no ha aportado su DNI. Pídele que lo introduzca desde la app para poder verificar y activar su abono.',
                400
            ));
        }
        // Al activar es obligatorio elegir el tipo de abono: de él se deriva la caducidad.
        if (!plan || !MEMBERSHIP_PLANS[plan]) {
            return next(new AppError('Elige el tipo de abono (mensual, trimestral o anual) para activarlo.', 400));
        }
        membership = { status, plan, validUntil: computeValidUntil(plan) };
    }

    const user = await User.findByIdAndUpdate(
        id,
        { membership },
        { new: true, runValidators: true }
    ).select('name email role membership');

    // Avisar al usuario del resultado de la revisión de su abono (in-app + push).
    const validUntilLabel = activated
        ? user.membership.validUntil.toLocaleDateString('es-ES')
        : null;
    await notifyAthletes([user._id], {
        type: 'system',
        title: activated ? 'Abono activado' : 'Abono actualizado',
        message: activated
            ? `Tu abono (${MEMBERSHIP_PLANS[plan].label}) ya está activo, válido hasta el ${validUntilLabel}. Ya puedes acceder a tus entrenamientos en Bulderland.`
            : 'Tu abono ya no está activo. Si crees que es un error, contacta con Bulderland.'
    });

    res.status(200).json({ message: 'Abono actualizado con éxito.', user });
});

export const getDeletedUsers = catchAsync(async (req, res) => {
    // El middleware restrictTo(ROLES.ADMIN) ya garantiza que req.user.role === ROLES.ADMIN
    const deletedUsers = await User.find({ isDeleted: true }).select('name email role');
    res.status(200).json(deletedUsers);
});

// Listar usuarios activos (solo admin) — alimenta la pantalla de gestión
export const getAllUsers = catchAsync(async (req, res) => {
    const users = await User.find({ isDeleted: { $ne: true } })
        .select('name email role photo createdAt membership dni')
        .sort({ name: 1 });
    res.status(200).json({ count: users.length, users });
});

export const login = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
        logger.warn(`Login: no existe usuario con email="${email}"`);
        return next(new AppError('Email o contraseña incorrectos', 401));
    }
    if (user.isDeleted) {
        logger.warn(`Login: el usuario email="${email}" está marcado como borrado`);
        return next(new AppError('Email o contraseña incorrectos', 401));
    }
    if (!(await user.comparePassword(password))) {
        logger.warn(`Login: contraseña incorrecta para email="${email}"`);
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
    if (req.user._id.toString() !== id && req.user.role !== ROLES.ADMIN && req.user.role !== ROLES.COACH) {
        return next(new AppError('No tienes permiso para ver este perfil', 403));
    }

    // Excluimos el password y, además, el código de verificación/recuperación y su
    // caducidad: es un secreto equivalente a una credencial (sirve para resetear la
    // contraseña) y un coach puede consultar el perfil de cualquier atleta. El resto
    // de campos (incluido membership) se mantiene para no romper la app.
    const user = await User.findById(id).select('-password -verificationCode -verificationCodeExpires');

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
    if (req.user._id.toString() !== id && req.user.role !== ROLES.ADMIN) {
        return next(new AppError('No tienes permiso para actualizar este perfil', 403));
    }

    if (name) {
        user.name = name;
    }
    if (role && req.user.role === ROLES.ADMIN) {
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
        // La fuerza de la nueva contraseña ya la valida updateUserSchema (validate middleware).
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
    if (req.user._id.toString() !== id && req.user.role !== ROLES.ADMIN) {
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
            role: ROLES.ATHLETE
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
    if (req.user._id.toString() !== id && req.user.role !== ROLES.ADMIN) {
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

    // Eliminar foto antigua si es local
    removeLocalImage(user.photo);

    // Guardar la imagen base64 como archivo y construir su URL pública
    const filename = saveBase64Image(photoBase64, mimeType, 'profile');
    const photoUrl = buildUploadUrl(req, filename);

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
    if (req.user._id.toString() !== id && req.user.role !== ROLES.ADMIN) {
        return next(new AppError('No tienes permiso para eliminar esta foto de perfil', 403));
    }

    const user = await User.findById(id);

    if (!user) {
        return next(new AppError('Usuario no encontrado', 404));
    }

    // Eliminar archivo si es local
    removeLocalImage(user.photo);

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
