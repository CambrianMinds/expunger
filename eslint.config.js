const globals = require("globals");
const pluginJs = require("@eslint/js");

module.exports = [
  {
    ignores: [
      "**/pdf-lib.min.js",
      "docs/app/pdf-lib.min.js",
      "extension/pdf-lib.min.js",
      "playwright-report/**",
      "test-results/**",
      "node_modules/**",
      "archive/**",
      ".agents/**",
      "temp/**"
    ]
  },
  pluginJs.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
        chrome: "readonly",
        IndianaExpungement: "readonly",
        IndianaExpungementState: "readonly",
        PDFDocument: "readonly",
        StandardFonts: "readonly",
        PDFLib: "readonly",
        ko: "readonly"
      },
      ecmaVersion: "latest",
      sourceType: "module"
    },
    rules: {
      "no-unused-vars": "off",
      "no-undef": "error",
      "no-empty": "warn",
      "no-control-regex": "off"
    }
  }
];
