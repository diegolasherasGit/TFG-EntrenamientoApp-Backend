export default function softDeletePlugin(schema) {
    // Añadimos el campo isActive automáticamente a todos los esquemas
    schema.add({
        isActive: {
            type: Boolean,
            default: true
        }
    });

    // Operaciones sobre las que aplicaremos el filtro automático
    const typesFindQueryMiddleware = [
        'countDocuments',
        'find',
        'findOne',
        'findOneAndUpdate',
        'updateOne',
        'updateMany',
    ];

    const excludeDeleted = function () {
        if (typeof this.getQuery === 'function') {
            const query = this.getQuery();
            if (query && query.isActive === undefined) {
                query.isActive = true;
            }
        }
    };

    // Aplicar el middleware a todas las operaciones de lectura y actualización
    typesFindQueryMiddleware.forEach((type) => {
        schema.pre(type, excludeDeleted);
    });
}
