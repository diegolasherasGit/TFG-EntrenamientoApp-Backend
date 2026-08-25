import fs from 'fs';
import path from 'path';
import AppError from './AppError.js';

const UPLOAD_DIR = 'uploads';
const MAX_BYTES = 500 * 1024; // 500KB

/**
 * Guarda una imagen recibida en base64 como fichero dentro de /uploads.
 * Valida el tamaño máximo (500KB) y crea el directorio si no existe.
 *
 * @param {string} photoBase64 - Imagen codificada en base64.
 * @param {string} mimeType - 'image/png' u otro (se asume jpeg).
 * @param {string} prefix - Prefijo del nombre (p. ej. 'profile', 'exercise').
 * @returns {string} El nombre del fichero generado.
 * @throws {AppError} 400 si la imagen supera el límite de tamaño.
 */
export function saveBase64Image(photoBase64, mimeType, prefix) {
    const buffer = Buffer.from(photoBase64, 'base64');
    if (buffer.length > MAX_BYTES) {
        throw new AppError('La imagen no puede superar los 500KB', 400);
    }

    if (!fs.existsSync(UPLOAD_DIR)) {
        fs.mkdirSync(UPLOAD_DIR);
    }

    const extension = mimeType === 'image/png' ? 'png' : 'jpeg';
    const filename = `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}.${extension}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);

    return filename;
}

/**
 * Construye la URL pública de un fichero subido. Se prefiere PUBLIC_URL (base
 * fija de confianza) para no depender de cabeceras controlables por el cliente
 * (X-Forwarded-Host/Proto), que permitirían apuntar la imagen a un host arbitrario.
 */
export function buildUploadUrl(req, filename) {
    if (process.env.PUBLIC_URL) {
        return `${process.env.PUBLIC_URL.replace(/\/$/, '')}/uploads/${filename}`;
    }
    return `${req.protocol}://${req.get('host')}/uploads/${filename}`;
}

/** Borra el fichero local de una imagen si vive en /uploads (filename saneado). */
export function removeLocalImage(imageUrl) {
    if (!imageUrl || !imageUrl.includes('/uploads/')) { return; }
    const filename = path.basename(imageUrl);
    if (filename.includes('..')) { return; }
    const filePath = path.join(UPLOAD_DIR, filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
}
