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
            "no-console": "warn",
            "prefer-const": "error",
            "no-var": "error",
            "eqeqeq": ["error", "always"],
            "curly": "error"
        }
    }
];