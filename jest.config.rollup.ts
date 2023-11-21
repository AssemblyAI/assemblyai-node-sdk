import type { JestConfigWithTsJest } from "ts-jest";

const jestConfig: JestConfigWithTsJest = {
  preset: "ts-jest",
  testEnvironment: "node",
  collectCoverage: true,
  modulePathIgnorePatterns: ["<rootDir>/dist"],
};

process.env.TESTDATA_DIR = "tests/static";

export default jestConfig;
