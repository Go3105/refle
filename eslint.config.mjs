import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";


/** @type {import('eslint').Linter.Config[]} */
export default [
    { files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"] },
    pluginReact.configs.flat.recommended,
    ...tseslint.configs.recommended,
    {
        languageOptions: { globals: { ...globals.browser, ...globals.node } },
        //追加
        rules: {
            "react/react-in-jsx-scope": "off",
            "react/jsx-uses-react": "off",
        },
    },
];