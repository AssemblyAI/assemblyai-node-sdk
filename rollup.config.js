const pkg = require('./package.json')
const ts = require('rollup-plugin-typescript2')

module.exports = [
  {
    plugins: [
      ts({
        tsconfigOverride: { exclude: ['**/*.test.ts'] },
      })
    ],
    external: ['axios', 'fs', 'stream', 'ws'],
    input: 'src/index.ts',
    output:
      [{
        file: pkg.main, format: 'cjs', exports: 'named'
      }, {
        file: pkg.module, format: 'es', exports: 'named'
      }]
  }
]
