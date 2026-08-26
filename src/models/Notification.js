import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'La notificación debe pertenecer a un usuario']
    },
    type: {
        type: String,
        enum: ['plan_assigned', 'workout_updated', 'new_message', 'system', 'other'],
        default: 'system'
    },
    title: {
        type: String,
        required: [true, 'La notificación debe tener un título'],
        trim: true,
        maxlength: [100, 'El título no puede exceder los 100 caracteres']
    },
    message: {
        type: String,
        required: [true, 'La notificación debe tener un mensaje'],
        trim: true,
        maxlength: [500, 'El mensaje no puede exceder los 500 caracteres']
    },
    read: {
        type: Boolean,
        default: false
    },
    relatedId: {
        type: mongoose.Schema.Types.ObjectId,
        // Puede referenciar a un Plan o un Workout dependiendo del 'type'
    }
}, {
    timestamps: true
});

// Índice para la query principal: notificaciones del usuario ordenadas por fecha desc.
// Cubre también el filtro por usuario de markAllAsRead y el contador de no leídas.
NotificationSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('Notification', NotificationSchema);
