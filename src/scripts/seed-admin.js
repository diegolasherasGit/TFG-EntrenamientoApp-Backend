import '../config/db.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const mongoUri = process.env.MONGO_URI || 'mongodb://mongo:27017/entrenamiento_db';

// Credenciales del administrador inicial: se pasan por entorno y nunca se
// guardan en el código. Sin ellas el script no crea nada.
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

const seedAdmin = async () => {
    if (!email || !password) {
        console.error('Define ADMIN_EMAIL y ADMIN_PASSWORD para crear el administrador inicial.');
        process.exit(1);
    }
    if (password.length < 12) {
        console.error('ADMIN_PASSWORD debe tener al menos 12 caracteres.');
        process.exit(1);
    }

    try {
        console.log(`Conectando a MongoDB en: ${mongoUri}`);
        await mongoose.connect(mongoUri);
        console.log('Conectado a MongoDB...');

        // Check if admin already exists
        const existingAdmin = await User.findOne({ email });
        if (existingAdmin) {
            console.log(`El administrador ${email} ya existe en la base de datos.`);
            process.exit(0);
        }

        console.log('Creando usuario administrador inicial...');

        const adminData = {
            name: 'Administrador',
            email: email,
            password,
            role: 'admin',
            isVerified: true,
            isActive: true
        };
        
        await User.create(adminData);
        console.log(`Administrador creado con éxito: ${email}`);

        process.exit(0);
    } catch (error) {
        console.error('Error durante la creación del administrador:', error);
        process.exit(1);
    }
};

seedAdmin();
