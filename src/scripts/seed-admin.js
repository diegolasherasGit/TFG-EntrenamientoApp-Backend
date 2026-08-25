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

const seedAdmin = async () => {
    try {
        console.log(`Conectando a MongoDB en: ${mongoUri}`);
        await mongoose.connect(mongoUri);
        console.log('Conectado a MongoDB...');

        const email = 'admin@bulderland.com';

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
            password: '***REMOVED***',
            role: 'admin',
            isVerified: true,
            isActive: true
        };
        
        await User.create(adminData);
        console.log(`Administrador creado con éxito: ${email} / ***REMOVED***`);

        process.exit(0);
    } catch (error) {
        console.error('Error durante la creación del administrador:', error);
        process.exit(1);
    }
};

seedAdmin();
