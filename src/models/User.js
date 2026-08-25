import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ALL_ROLES } from '../constants/roles.js';
import { ALL_MEMBERSHIP_STATUS, MEMBERSHIP_STATUS } from '../constants/membership.js';

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: function () { return !this.googleId; }, // Solo requerido si no hay Google ID
        minlength: 6
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true // Permite que sea opcional y único
    },
    // DNI/NIE del usuario. Lo aporta al solicitar el abono y sirve para que el
    // admin verifique contra los registros de Bulderland que esa persona pagó.
    // Único y sparse: opcional hasta que se solicita el abono, pero sin duplicados.
    dni: {
        type: String,
        unique: true,
        sparse: true,
        uppercase: true,
        trim: true
    },
    photo: {
        type: String
    },
    role: {
        type: String,
        enum: ALL_ROLES,
        default: 'athlete'
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationCode: {
        type: String
    },
    verificationCodeExpires: {
        type: Date
    },
    notificationsEnabled: {
        type: Boolean,
        default: true
    },
    expoPushToken: {
        type: String
    },
    // Marca de tiempo del último cambio de contraseña. Se usa para invalidar los
    // JWT emitidos antes de ese cambio (ver changedPasswordAfter / middleware protect).
    passwordChangedAt: {
        type: Date
    },
    // Abono/cuota en Bulderland. La gestiona un admin a mano (no hay API del
    // rocódromo). El acceso al contenido de entrenamiento exige status 'active'
    // y, si hay validUntil, que no haya caducado (ver hasActiveMembership).
    membership: {
        status: {
            type: String,
            enum: ALL_MEMBERSHIP_STATUS,
            default: MEMBERSHIP_STATUS.NONE
        },
        plan: {
            type: String,
            trim: true
        },
        validUntil: {
            type: Date
        },
        // Momento en que el usuario solicitó la activación (estado 'pending').
        requestedAt: {
            type: Date
        }
    }
}, {
    timestamps: true
});

// Índice en role para los conteos por rol del dashboard de estadísticas
// (email y googleId ya tienen índice único implícito)
userSchema.index({ role: 1 });

// Encriptar contraseña antes de guardar
userSchema.pre('save', async function () {
    if (!this.isModified('password')) { return; }
    this.password = await bcrypt.hash(this.password, 12);

    // En documentos ya existentes, registrar cuándo se cambió la contraseña para
    // invalidar tokens anteriores. Restamos 1s para evitar una condición de carrera
    // en la que el token recién emitido tras el cambio parezca anterior al cambio.
    if (!this.isNew) {
        this.passwordChangedAt = Date.now() - 1000;
    }
});

// Método para// Comprobar contraseña
userSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Indica si el usuario tiene un abono activo: estado 'active' y, si hay fecha de
// caducidad, que aún no haya pasado. Lo usa el middleware requireActiveMembership.
userSchema.methods.hasActiveMembership = function () {
    if (!this.membership || this.membership.status !== MEMBERSHIP_STATUS.ACTIVE) {
        return false;
    }
    if (this.membership.validUntil && this.membership.validUntil.getTime() < Date.now()) {
        return false;
    }
    return true;
};

// Indica si la contraseña se cambió después de emitirse un token (iat en segundos).
userSchema.methods.changedPasswordAfter = function (jwtIatSeconds) {
    if (!this.passwordChangedAt) { return false; }
    const changedAtSeconds = Math.floor(this.passwordChangedAt.getTime() / 1000);
    return jwtIatSeconds < changedAtSeconds;
};

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;
