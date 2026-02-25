/**
 * Envuelve una función asíncrona (controlador o middleware) y atrapa
 * automáticamente cualquier error (promesa rechazada), pasándolo a `next`.
 * Esto elimina la necesidad de escribir bloques try/catch repetitivos.
 */
const catchAsync = (fn) => {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
    };
};

export default catchAsync;
