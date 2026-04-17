import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

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
    photo: {
        type: String
    },
    role: {
        type: String,
        enum: ['coach', 'athlete', 'admin'],
        default: 'athlete'
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Encriptar contraseña antes de guardar
userSchema.pre('save', async function () {
    if (!this.isModified('password')) { return; }
    this.password = await bcrypt.hash(this.password, 12);
});

// Método para// Comprobar contraseña
userSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;
