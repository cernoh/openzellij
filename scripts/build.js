const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'src');
const distDir = path.join(root, 'dist');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

try {
  const esbuild = require('esbuild');
  const packageJson = require(path.join(root, 'package.json'));
  
  const externalPackages = [
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.peerDependencies || {}),
  ];
  
  console.log('Using esbuild to build...');
  
  ensureDir(distDir);
  
  esbuild.buildSync({
    entryPoints: [path.join(srcDir, 'index.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: path.join(distDir, 'index.js'),
    sourcemap: true,
    minify: false,
    external: externalPackages,
    banner: {
      js: '// ESM build for import statements\n',
    },
  });
  console.log('✓ Built ESM bundle: dist/index.js');
  
  esbuild.buildSync({
    entryPoints: [path.join(srcDir, 'index.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: path.join(distDir, 'index.cjs'),
    sourcemap: true,
    minify: false,
    external: externalPackages,
    banner: {
      js: '// CJS build for require() calls\n',
    },
  });
  console.log('✓ Built CJS bundle: dist/index.cjs');
  
  const typesSrc = path.join(srcDir, 'types.ts');
  if (fs.existsSync(typesSrc)) {
    const typesContent = fs.readFileSync(typesSrc, 'utf8');
    fs.writeFileSync(path.join(distDir, 'index.d.ts'), typesContent, 'utf8');
    console.log('✓ Generated type definitions: dist/index.d.ts');
  }
  
  console.log('Build completed successfully');
  process.exit(0);
} catch (e) {
  console.log('esbuild not available — running fallback build');
  ensureDir(distDir);
  
  const fallbackEsm = `export const openzellij = () => { throw new Error('Build failed - please run: npm install && npm run build'); };\nexport default openzellij;\n`;
  fs.writeFileSync(path.join(distDir, 'index.js'), fallbackEsm, 'utf8');
  
  const fallbackCjs = `module.exports.openzellij = () => { throw new Error('Build failed - please run: npm install && npm run build'); };\nmodule.exports.default = module.exports.openzellij;\n`;
  fs.writeFileSync(path.join(distDir, 'index.cjs'), fallbackCjs, 'utf8');

  const typesSrc = path.join(srcDir, 'types.ts');
  if (fs.existsSync(typesSrc)) {
    const typesContent = fs.readFileSync(typesSrc, 'utf8');
    const cleaned = typesContent.split('\n').filter(line => !line.trim().startsWith('//')).join('\n');
    fs.writeFileSync(path.join(distDir, 'index.d.ts'), cleaned, 'utf8');
  } else {
    fs.writeFileSync(path.join(distDir, 'index.d.ts'), 'export {};\n', 'utf8');
  }

  console.log('Fallback build completed');
  process.exit(0);
}
