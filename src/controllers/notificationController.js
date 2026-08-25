import Notification from '../models/Notification.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';

// @desc    Obtener notificaciones del usuario autenticado
// @route   GET /api/notifications
// @access  Privado
export const getNotifications = catchAsync(async (req, res) => {
    const notifications = await Notification.find({ user: req.user._id })
        .sort('-createdAt'); // Más recientes primero

    res.status(200).json({
        success: true,
        count: notifications.length,
        unreadCount: notifications.filter(n => !n.read).length,
        data: notifications
    });
});

// @desc    Marcar notificación como leída
// @route   PATCH /api/notifications/:id/read
// @access  Privado
export const markAsRead = catchAsync(async (req, res, next) => {
    const notification = await Notification.findOne({ _id: req.params.id, user: req.user._id });

    if (!notification) {
        return next(new AppError('Notificación no encontrada', 404));
    }

    notification.read = true;
    await notification.save();

    res.status(200).json({
        success: true,
        data: notification
    });
});

// @desc    Marcar todas las notificaciones como leídas
// @route   PATCH /api/notifications/read-all
// @access  Privado
export const markAllAsRead = catchAsync(async (req, res) => {
    await Notification.updateMany(
        { user: req.user._id, read: false },
        { $set: { read: true } }
    );

    res.status(200).json({
        success: true,
        message: 'Todas las notificaciones marcadas como leídas'
    });
});

// @desc    Eliminar una notificación
// @route   DELETE /api/notifications/:id
// @access  Privado
export const deleteNotification = catchAsync(async (req, res, next) => {
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, user: req.user._id });

    if (!notification) {
        return next(new AppError('Notificación no encontrada', 404));
    }

    res.status(200).json({
        success: true,
        data: {}
    });
});
