import User from '../models/User.js';
import catchAsync from '../utils/catchAsync.js';
import jwt from 'jsonwebtoken';

export const login = catchAsync(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'secret_key_temporal', {
            expiresIn: '30d'
        });

        res.cookie('jwt', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000 // 30 días
        });

        res.status(200).json({
            message: 'Inicio de sesión exitoso',
            user: { id: user._id, name: user.name, email: user.email, role: user.role }
        });
    } else {
        res.status(401).json({ message: 'Email o contraseña inválidos' });
    }
});

export const register = catchAsync(async (req, res) => {
    const { name, email, password, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return res.status(400).json({ message: 'El usuario ya existe' });
    }

    const newUser = new User({ name, email, password, role });
    await newUser.save();

    res.status(201).json({
        message: 'Usuario registrado con éxito',
        user: { id: newUser._id, name: newUser.name, email: newUser.email, role: newUser.role }
    });
});

export const getProfile = catchAsync(async (req, res) => {
    const { id } = req.params;
    const user = await User.findById(id).select('-password');

    if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    res.status(200).json(user);
});

export const updateUser = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { name } = req.body; // ELIMINADO role PARA EVITAR ESCALADA DE PRIVILEGIOS

    const user = await User.findByIdAndUpdate(
        id,
        { name },
        { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.status(200).json({ message: 'Usuario actualizado con éxito', user });
});

export const deleteUser = catchAsync(async (req, res) => {
    const { id } = req.params;
    // CAMBIADO A SOFT DELETE
    const user = await User.findByIdAndUpdate(id, { isActive: false }, { new: true });

    if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.status(200).json({ message: 'Usuario eliminado con éxito' });
});
