import fs from 'fs';
import path from 'path';

// Built-in Node.js modules
const BUILTINS = new Set([
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console',
  'constants', 'crypto', 'dgram', 'dns', 'domain', 'events', 'fs', 'http',
  'http2', 'https', 'inspector', 'module', 'net', 'os', 'path', 'perf_hooks',
  'process', 'punycode', 'querystring', 'readline', 'repl', 'stream',
  'string_decoder', 'sys', 'timers', 'tls', 'trace_events', 'tty', 'url',
  'util', 'v8', 'vm', 'worker_threads', 'zlib'
]);

function getFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results.push(...getFiles(fullPath));
    } else if (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.jsx') || file.endsWith('.tsx')) {
      results.push(fullPath);
    }
  });
  return results;
}

function extractImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const imports = new Set();
  
  // Match: import ... from 'pkg' or import 'pkg'
  const importRegex = /import\s+(?:[\w*\s{},]*\s+from\s+)?['"]([^'"]+)['"]/g;
  // Match: export ... from 'pkg'
  const exportRegex = /export\s+(?:[\w*\s{},]*\s+from\s+)?['"]([^'"]+)['"]/g;
  // Match: import('pkg')
  const dynamicImportRegex = /import\(['"]([^'"]+)['"]\)/g;
  // Match: require('pkg')
  const requireRegex = /require\(['"]([^'"]+)['"]\)/g;

  let match;
  while ((match = importRegex.exec(content)) !== null) imports.add(match[1]);
  while ((match = exportRegex.exec(content)) !== null) imports.add(match[1]);
  while ((match = dynamicImportRegex.exec(content)) !== null) imports.add(match[1]);
  while ((match = requireRegex.exec(content)) !== null) imports.add(match[1]);

  return Array.from(imports);
}

function getPackageName(importPath) {
  if (importPath.startsWith('.') || importPath.startsWith('/')) {
    return null; // Local import
  }
  // Scoped packages like @firebase/firestore -> @firebase/firestore
  if (importPath.startsWith('@')) {
    const parts = importPath.split('/');
    return parts.slice(0, 2).join('/');
  }
  // Standard packages like firebase/auth -> firebase
  return importPath.split('/')[0];
}

function main() {
  console.log('🔍 Starting dependency integrity check...');
  
  if (!fs.existsSync('package.json')) {
    console.error('❌ Error: package.json not found!');
    process.exit(1);
  }

  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const declaredDeps = new Set([
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {})
  ]);

  const srcFiles = getFiles('src');
  const testFiles = getFiles('tests');
  const allFiles = [...srcFiles, ...testFiles];

  console.log(`Found ${allFiles.length} files to scan.`);

  let phantomCount = 0;
  const phantomDepsMap = {};

  allFiles.forEach(file => {
    const imports = extractImports(file);
    imports.forEach(imp => {
      const pkgName = getPackageName(imp);
      if (!pkgName) return; // Skip relative imports
      if (BUILTINS.has(pkgName)) return; // Skip Node.js built-ins

      if (!declaredDeps.has(pkgName)) {
        if (!phantomDepsMap[pkgName]) {
          phantomDepsMap[pkgName] = [];
        }
        if (!phantomDepsMap[pkgName].includes(file)) {
          phantomDepsMap[pkgName].push(file);
        }
        phantomCount++;
      }
    });
  });

  if (phantomCount > 0) {
    console.error('\n❌ PHANTOM DEPENDENCIES DETECTED!');
    console.error('The following third-party imports are used in the codebase but NOT declared in package.json:\n');
    
    for (const [pkgName, files] of Object.entries(phantomDepsMap)) {
      console.error(`📦 "${pkgName}" is imported in:`);
      files.forEach(f => console.error(`   - ${f}`));
    }
    
    console.error('\n👉 Please run `npm install <package>` or add them to your dependencies list.');
    process.exit(1);
  }

  console.log('✅ Dependency check completed successfully! No phantom dependencies found.');
}

main();
