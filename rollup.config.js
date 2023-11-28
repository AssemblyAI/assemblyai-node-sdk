const pkg = require("./package.json");
const ts = require("rollup-plugin-typescript2");
const terser = require("@rollup/plugin-terser");
const alias = require("@rollup/plugin-alias");
const { nodeResolve } = require("@rollup/plugin-node-resolve");

const cjsFile = pkg.main;
const esmFile = pkg.module;
const browserFile = pkg.exports["."].browser;

const defaultPlugins = [
  ts({
    tsconfigOverride: { exclude: ["**/*.test.ts"] },
  }),
];
const defaultConfig = {
  plugins: defaultPlugins,
  external: ["fs", "isomorphic-ws", "@swimburger/isomorphic-streams"],
  input: "src/index.ts",
};

const browserConfig = {
  ...defaultConfig,
  plugins: [
    ...defaultConfig.plugins,
    alias({
      entries: [{ find: "fs", replacement: "./src/browser/fs.ts" }],
    }),
    nodeResolve({ browser: true }),
  ],
  external: [],
};

module.exports = [
  {
    ...defaultConfig,
    output: [
      {
        file: cjsFile,
        format: "cjs",
        exports: "named",
      },
      {
        file: esmFile,
        format: "es",
        exports: "named",
      },
    ],
  },
  {
    ...browserConfig,
    output: [
      {
        name: "assemblyai",
        file: browserFile,
        format: "esm",
      },
    ],
  },
  {
    ...browserConfig,
    output: [
      {
        name: "assemblyai",
        file: "./dist/assemblyai.umd.js",
        format: "umd",
      },
    ],
  },
  {
    ...browserConfig,
    plugins: [...browserConfig.plugins, terser()],
    output: [
      {
        name: "assemblyai",
        file: "./dist/assemblyai.umd.min.js",
        format: "umd",
      },
    ],
  },
];
