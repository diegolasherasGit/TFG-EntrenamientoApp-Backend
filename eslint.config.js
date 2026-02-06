import globals from "globals";
import pluginJs from "@eslint/js";

export default [
    {
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.jest,
                process: "readonly"
            }
        }
    },
    pluginJs.configs.recommended,

    {
        rules: {
            "no-console": ["warn", { allow: ["warn", "error"] }],
            "prefer-const": "error",
            "no-var": "error",
            "eqeqeq": ["error", "always"],
            "curly": "error"
        }
    },

    {
        files: ["src/config/**/*.js", "src/app.js", "src/index.js", "src/tests/**/*.js"],
        rules: {
            "no-console": "off"
        }
    }
];