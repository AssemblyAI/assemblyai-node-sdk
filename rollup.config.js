const ts = require("@rollup/plugin-typescript");
const terser = require("@rollup/plugin-terser");
const nodeResolve = require("@rollup/plugin-node-resolve");
const replace = require("@rollup/plugin-replace");
const packageJson = require("./package.json");

const replacePlugin = replace({
  preventAssignment: true,
  values: {
    __SDK_VERSION__: packageJson.version,
  },
});

const umdConfig = {
  input: "src/exports/index.ts",
  plugins: [
    replacePlugin,
    ts({
      compilerOptions: { target: "ES2015", customConditions: ["browser"] },
    }),
    nodeResolve({ browser: true }),
  ],
  external: [],
};

module.exports = [
  {
    input: "src/exports/index.ts",
    plugins: [
      replacePlugin,
      // we don't know where this will be used, could be browser, could be another runtime
      // so we compile to es2015 for maximum compatibility.
      ts({ compilerOptions: { target: "ES2015" } }),
    ],
    external: ["ws"],
    output: [
      {
        file: `./dist/index.mjs`,
        format: "es",
        exports: "named",
      },
      {
        file: `./dist/index.cjs`,
        format: "cjs",
        exports: "named",
      },
    ],
  },
  {
    input: "src/exports/streaming.ts",
    plugins: [
      // we don't know where this will be used, could be browser, could be another runtime
      // so we compile to es2015 for maximum compatibility.
      ts({ compilerOptions: { target: "ES2015" } }),
    ],
    external: ["ws"],
    output: [
      {
        file: `./dist/streaming.mjs`,
        format: "es",
        exports: "named",
      },
      {
        file: `./dist/streaming.cjs`,
        format: "cjs",
        exports: "named",
      },
    ],
  },
  {
    input: "src/exports/index.ts",
    plugins: [
      replacePlugin,
      ts({ compilerOptions: { customConditions: ["node"] } }),
    ],
    external: ["fs", "stream", "stream/web", "ws"],
    output: [
      {
        file: `./dist/node.mjs`,
        format: "es",
        exports: "named",
      },
      {
        file: `./dist/node.cjs`,
        format: "cjs",
        exports: "named",
      },
    ],
  },
  {
    input: "src/exports/index.ts",
    plugins: [
      replacePlugin,
      ts({ compilerOptions: { customConditions: ["deno"] } }),
    ],
    external: ["ws"],
    output: [
      {
        file: `./dist/deno.mjs`,
        format: "es",
        exports: "named",
      },
    ],
  },
  {
    input: "src/exports/index.ts",
    plugins: [
      replacePlugin,
      ts({ compilerOptions: { customConditions: ["bun"] } }),
    ],
    external: ["ws"],
    output: [
      {
        file: `./dist/bun.mjs`,
        format: "es",
        exports: "named",
      },
    ],
  },
  // Browser ESM build
  {
    input: "src/exports/index.ts",
    plugins: [
      replacePlugin,
      ts({ compilerOptions: { customConditions: ["browser"] } }),
    ],
    output: [
      {
        file: `./dist/browser.mjs`,
        format: "es",
        exports: "named",
      },
    ],
  },
  {
    input: "src/exports/streaming.ts",
    plugins: [
      replacePlugin,
      ts({ compilerOptions: { customConditions: ["browser"] } }),
    ],
    output: [
      {
        file: `./dist/streaming.browser.mjs`,
        format: "es",
        exports: "named",
      },
    ],
  },
  // Browser UMD build to reference directly in the browser.
  {
    ...umdConfig,
    output: [
      {
        name: "assemblyai",
        file: "./dist/assemblyai.umd.js",
        format: "umd",
      },
    ],
  },
  // Browser UMD build to reference directly in the browser.
  {
    ...umdConfig,
    input: "src/exports/streaming.ts",
    output: [
      {
        name: "assemblyai",
        file: "./dist/assemblyai.streaming.umd.js",
        format: "umd",
      },
    ],
  },
  // Browser UMD minified build to reference directly in the browser.
  {
    ...umdConfig,
    plugins: [...umdConfig.plugins, terser()],
    output: [
      {
        name: "assemblyai",
        file: "./dist/assemblyai.umd.min.js",
        format: "umd",
      },
    ],
  },
  // Browser UMD minified build to reference directly in the browser.
  {
    ...umdConfig,
    input: "src/exports/streaming.ts",
    plugins: [...umdConfig.plugins, terser()],
    output: [
      {
        name: "assemblyai",
        file: "./dist/assemblyai.streaming.umd.min.js",
        format: "umd",
      },
    ],
  },
];
