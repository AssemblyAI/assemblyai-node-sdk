/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest",
  testEnvironment: "node",
  collectCoverage: true,
  modulePathIgnorePatterns: ["<rootDir>/dist"],
  testMatch: ["**/tests/integration/**/*.test.ts"],
  clearMocks: true,
  maxConcurrency: 1,
};

process.env.TESTDATA_DIR = "tests/static";

module.exports = config;
