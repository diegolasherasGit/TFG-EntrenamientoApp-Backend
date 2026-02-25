/**
 * Clase utilitaria para construir consultas (queries) avanzadas en Mongoose a partir
 * de la query string (req.query) recibida por Express.
 */
class ApiFeatures {
    constructor(query, queryString) {
        this.query = query;
        this.queryString = queryString;
    }

    /**
     * Aplica filtros básicos excluyendo palabras clave reservadas de la paginación/sort.
     */
    filter() {
        // Objeto query original mutado durante el filtrado
        const queryObj = { ...this.queryString };
        const excludedFields = ['page', 'sort', 'limit', 'fields'];
        excludedFields.forEach(el => delete queryObj[el]);

        // Retornar Mongoose query operations como $gte, $lte, etc. (ej: /api/v1/resource?duration[gte]=5)
        let queryStr = JSON.stringify(queryObj);
        queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`);

        this.query = this.query.find(JSON.parse(queryStr));

        return this;
    }

    /**
     * Ordena los resultados. Por defecto ordena createdAt descendente.
     * Ejemplo postman: ?sort=price,duration => ordenado por price y luego duration
     */
    sort() {
        if (this.queryString.sort) {
            const sortBy = this.queryString.sort.split(',').join(' ');
            this.query = this.query.sort(sortBy);
        } else {
            // Sorting por defecto: los más nuevos primero
            this.query = this.query.sort('-createdAt');
        }

        return this;
    }

    /**
     * Selecciona qué campos devolver (Projecting).
     */
    limitFields() {
        if (this.queryString.fields) {
            const fields = this.queryString.fields.split(',').join(' ');
            this.query = this.query.select(fields);
        } else {
            // Por defecto, nunca retornar propiedades internas de mongo como __v
            this.query = this.query.select('-__v');
        }

        return this;
    }

    /**
     * Paginación
     * skip: (número de página - 1) * cantidad de items por página
     */
    paginate() {
        const page = this.queryString.page * 1 || 1;
        const limit = this.queryString.limit * 1 || 10;
        const skip = (page - 1) * limit;

        this.query = this.query.skip(skip).limit(limit);

        return this;
    }
}

export default ApiFeatures;
