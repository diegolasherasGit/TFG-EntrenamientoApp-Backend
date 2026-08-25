import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    planId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TrainingPlan',
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    text: {
        type: String,
        required: true,
        trim: true
    }
}, {
    timestamps: true
});

// Índice para cargar el historial de chat de un plan ordenado cronológicamente
messageSchema.index({ planId: 1, createdAt: 1 });

const Message = mongoose.model('Message', messageSchema);
export default Message;
