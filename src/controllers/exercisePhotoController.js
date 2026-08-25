import ExercisePhoto from '../models/ExercisePhoto.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import { saveBase64Image, buildUploadUrl, removeLocalImage } from '../utils/imageUpload.js';

/**
 * Obtener todas las fotos de ejercicios (público para usuarios logueados)
 */
export const getAllPhotos = catchAsync(async (req, res) => {
    const photos = await ExercisePhoto.find().sort({ createdAt: -1 });

    res.status(200).json({
        status: 'success',
        results: photos.length,
        data: {
            photos
        }
    });
});

/**
 * Obtener una foto de ejercicio por ID
 */
export const getPhoto = catchAsync(async (req, res, next) => {
    const photo = await ExercisePhoto.findById(req.params.id);

    if (!photo) {
        return next(new AppError('No se encontró ninguna foto con ese ID', 404));
    }

    res.status(200).json({
        status: 'success',
        data: {
            photo
        }
    });
});

/**
 * Crear una nueva foto de ejercicio (Solo Admin).
 * La imagen llega en base64 y se guarda como fichero en /uploads,
 * igual que las fotos de perfil.
 */
export const createPhoto = catchAsync(async (req, res) => {
    const { title, description, exerciseType, photoBase64, mimeType } = req.body;

    const filename = saveBase64Image(photoBase64, mimeType, 'exercise');
    const imageUrl = buildUploadUrl(req, filename);

    const newPhoto = await ExercisePhoto.create({
        title,
        imageUrl,
        description,
        exerciseType
    });

    res.status(201).json({
        status: 'success',
        data: {
            photo: newPhoto
        }
    });
});

/**
 * Actualizar título/descripción de una foto (Solo Admin)
 */
export const updatePhoto = catchAsync(async (req, res, next) => {
    // Allowlist explícita: evita mass-assignment (p. ej. sobrescribir imageUrl)
    // aunque lleguen claves no previstas en el body.
    const ALLOWED_FIELDS = ['title', 'description', 'exerciseType'];
    const updates = {};
    for (const field of ALLOWED_FIELDS) {
        if (req.body[field] !== undefined) {
            updates[field] = req.body[field];
        }
    }

    const photo = await ExercisePhoto.findByIdAndUpdate(
        req.params.id,
        updates,
        {
            new: true,
            runValidators: true
        }
    );

    if (!photo) {
        return next(new AppError('No se encontró ninguna foto con ese ID', 404));
    }

    res.status(200).json({
        status: 'success',
        data: {
            photo
        }
    });
});

/**
 * Eliminar una foto de ejercicio (Solo Admin)
 */
export const deletePhoto = catchAsync(async (req, res, next) => {
    const photo = await ExercisePhoto.findByIdAndDelete(req.params.id);

    if (!photo) {
        return next(new AppError('No se encontró ninguna foto con ese ID', 404));
    }

    removeLocalImage(photo.imageUrl);

    res.status(204).json({
        status: 'success',
        data: null
    });
});
