import TechniqueVideo from '../models/TechniqueVideo.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';

/**
 * Obtener todos los videos de técnica (Público para usuarios logueados)
 */
export const getAllVideos = catchAsync(async (req, res, next) => {
    const videos = await TechniqueVideo.find().sort({ createdAt: -1 });

    res.status(200).json({
        status: 'success',
        results: videos.length,
        data: {
            videos
        }
    });
});

/**
 * Obtener un video de técnica por ID
 */
export const getVideo = catchAsync(async (req, res, next) => {
    const video = await TechniqueVideo.findById(req.params.id);

    if (!video) {
        return next(new AppError('No se encontró ningún video con ese ID', 404));
    }

    res.status(200).json({
        status: 'success',
        data: {
            video
        }
    });
});

/**
 * Crear un nuevo video de técnica (Solo Admin)
 */
export const createVideo = catchAsync(async (req, res, next) => {
    const newVideo = await TechniqueVideo.create({
        title: req.body.title,
        videoUrl: req.body.videoUrl,
        description: req.body.description
    });

    res.status(201).json({
        status: 'success',
        data: {
            video: newVideo
        }
    });
});

/**
 * Actualizar un video de técnica existente (Solo Admin)
 */
export const updateVideo = catchAsync(async (req, res, next) => {
    const video = await TechniqueVideo.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
            new: true,
            runValidators: true
        }
    );

    if (!video) {
        return next(new AppError('No se encontró ningún video con ese ID', 404));
    }

    res.status(200).json({
        status: 'success',
        data: {
            video
        }
    });
});

/**
 * Eliminar un video de técnica (Solo Admin)
 */
export const deleteVideo = catchAsync(async (req, res, next) => {
    const video = await TechniqueVideo.findByIdAndDelete(req.params.id);

    if (!video) {
        return next(new AppError('No se encontró ningún video con ese ID', 404));
    }

    res.status(204).json({
        status: 'success',
        data: null
    });
});
