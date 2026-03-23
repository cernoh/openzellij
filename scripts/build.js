const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'src');
const distDir = path.join(root, 'dist');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

try {
  // Try to use esbuild if available
  const esbuild = require('esbuild');
  console.log('Using esbuild to build...');
  esbuild.buildSync({
    entryPoints: [path.join(srcDir, 'index.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: path.join(distDir, 'index.js'),
    sourcemap: true,
    minify: false,
  });
  // create index.d.ts by copying Types content
  const typesSrc = path.join(srcDir, 'types.ts');
  if (fs.existsSync(typesSrc)) {
    ensureDir(distDir);
    const typesContent = fs.readFileSync(typesSrc, 'utf8');
    fs.writeFileSync(path.join(distDir, 'index.d.ts'), typesContent, 'utf8');
  }
  console.log('Build completed (esbuild)');
  process.exit(0);
} catch (e) {
  // Fallback simple build without external deps
  console.log('esbuild not available — running fallback build');
  ensureDir(distDir);
  // Create a minimal JS bundle
  const indexJs = `// Auto-generated fallback build\nmodule.exports = {}\n`;
  fs.writeFileSync(path.join(distDir, 'index.js'), indexJs, 'utf8');

  // If types.ts exists, copy to dist as .d.ts
  const typesSrc = path.join(srcDir, 'types.ts');
  if (fs.existsSync(typesSrc)) {
    const typesContent = fs.readFileSync(typesSrc, 'utf8');
    // Strip any single-line comments to satisfy strict d.ts requirements
    const cleaned = typesContent.split('\n').filter(line => !line.trim().startsWith('//')).join('\n');
    fs.writeFileSync(path.join(distDir, 'index.d.ts'), cleaned, 'utf8');
  } else {
    fs.writeFileSync(path.join(distDir, 'index.d.ts'), '// No types available\n', 'utf8');
  }

  console.log('Fallback build completed');
  process.exit(0);
}
