import User from '../models/User.js';

export const register = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // Verificar si el usuario ya existe
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'El usuario ya existe' });
        }

        const newUser = new User({
            name,
            email,
            password, // De momento sin hashear (TODO: añadir bcrypt)
            role
        });

        await newUser.save();

        res.status(201).json({
            message: 'Usuario registrado con éxito',
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Error en el servidor', error: error.message });
    }
};

export const getProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: 'Error en el servidor', error: error.message });
    }
};
