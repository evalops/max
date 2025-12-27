module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat", // New feature
        "fix", // Bug fix
        "docs", // Documentation
        "style", // Formatting, missing semicolons, etc.
        "refactor", // Code refactoring
        "perf", // Performance improvements
        "test", // Adding tests
        "build", // Build system or dependencies
        "ci", // CI configuration
        "chore", // Maintenance tasks
        "revert", // Revert previous commit
      ],
    ],
    "subject-case": [2, "always", "lower-case"],
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "type-case": [2, "always", "lower-case"],
    "type-empty": [2, "never"],
    "header-max-length": [2, "always", 100],
    "body-max-line-length": [0, "always", Infinity],
  },
};
