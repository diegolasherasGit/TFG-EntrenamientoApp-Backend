/**
 * ¿El usuario tiene acceso a un plan? Solo el coach dueño o un atleta inscrito.
 * Los administradores NO acceden al contenido/chat de los planes.
 *
 * Acepta tanto un ObjectId (req.user._id) como un string (socket.user.id): el
 * array `plan.athletes` de Mongoose castea ambos en su `.includes()`.
 *
 * @param {import('mongoose').Document} plan - Documento TrainingPlan hidratado.
 * @param {string|import('mongoose').Types.ObjectId} userId - Id del usuario.
 */
export function canAccessPlan(plan, userId) {
    const isCoach = plan.coach.toString() === userId.toString();
    const isAthlete = plan.athletes.includes(userId);
    return isCoach || isAthlete;
}
