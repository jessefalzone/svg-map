export default [
  {
    ignores: ["dist/**", "legacy/**"],
  },
  {
    files: ["**/*.js", "**/*.mjs"],
    rules: {
      curly: ["error", "all"],
    },
  },
];
