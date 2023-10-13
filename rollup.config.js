const pkg = require('./package.json')
const ts = require('rollup-plugin-typescript2')

const plugins = [
  ts({
    tsconfigOverride: { exclude: ['**/*.test.ts'] },
  }),
]

module.exports = [
  {
    input: 'src/index.ts',
    output: [
      { file: pkg.main, format: 'cjs' },
      { file: pkg.module, format: 'es' }
    ],
    plugins,
    external: ['axios', 'fs/promises', 'stream', 'ws']
  },
]
