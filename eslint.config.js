import globals from "globals";
import pluginJs from "@eslint/js";

export default [
    {
        // 1. Definir los entornos (Node y Jest para tests)
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.jest,
                process: "readonly" // Para las variables de entorno
            }
        }
    },
    // 2. Usar la base recomendada
    pluginJs.configs.recommended,

    // 3. Tus reglas personalizadas (el "toque" profesional)
    {
        rules: {
            "no-console": "warn",        // Te avisa si dejas console.logs (limpieza)
            "prefer-const": "error",     // Te obliga a usar const si la variable no cambia
            "no-var": "error",           // Prohibido usar 'var' (es 2026, usa let/const)
            "eqeqeq": ["error", "always"], // Obliga a usar === en lugar de == (evita errores de tipo)
            "curly": "error"             // Obliga a usar llaves en if/else (evita errores lógicos)
        }
    }
];