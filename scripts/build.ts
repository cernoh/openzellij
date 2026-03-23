import { build } from 'esbuild'

const args = process.argv.slice(2)
const watch = args.includes('--watch')

build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: 'dist/index.js',
  sourcemap: true,
  minify: false,
  external: [],
  watch: watch && {
    onRebuild(error, result) {
      if (error) console.error('Build failed:', error)
      else console.log('Build succeeded')
    }
  }
}).then(() => {
  if (!watch) console.log('Build completed')
}).catch((err) => {
  console.error(err)
  process.exit(1)
})
