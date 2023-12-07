module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  collectCoverage: true,
  modulePathIgnorePatterns: ["<rootDir>/dist"],
};

process.env.TESTDATA_DIR = "tests/static";
