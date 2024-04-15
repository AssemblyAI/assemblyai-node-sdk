/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest",
  testEnvironment: "node",
  collectCoverage: true,
  modulePathIgnorePatterns: ["<rootDir>/dist"],
  testMatch: ["**/tests/unit/**/*.test.ts"],
};

process.env.TESTDATA_DIR = "tests/static";

module.exports = config;
