// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    // Personal health data must never be bundled into the app: the site is public, so anything imported here
    // ships to everyone. The app only reads what the user imports on their own device (src/health/storage.ts).
    files: ["src/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["**/data/fixtures/**", "@/data/fixtures/**", "**/data/raw/**", "**/data/tmp/**"],
          message: "Personal health data must not be imported into the app bundle (it would be published). Use the on-device import instead.",
        }],
      }],
    },
  },
]);
