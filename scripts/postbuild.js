import fs from 'fs';
import path from 'path';

function getFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results.push(...getFiles(fullPath));
    } else {
      results.push({
        path: fullPath,
        size: stat.size
      });
    }
  });
  return results;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const FORBIDDEN_DIST_PATTERN = /(^|[\\/])assets[\\/]aistudio([\\/]|$)|Paste_|progilic_dashboard_|\.(md|pdf|log|bak)$/i;
const FORBIDDEN_DEV_IMAGES = new Set([
  'current_view_1920.png',
  'final_login_desktop.png',
  'final_login_mobile.png',
  'pixel_perfect_1920.png',
  'pixel_perfect_mobile.png',
  'reference_comparison_desktop.png',
  'reference_comparison_mobile.png',
  'screenshot_desktop.png',
  'screenshot_mobile.png',
  'test_logo.png'
]);

export function sanitizeAndAuditDist(distDir = 'dist') {
  const aistudioPath = path.join(distDir, 'assets', 'aistudio');
  if (fs.existsSync(aistudioPath)) {
    fs.rmSync(aistudioPath, { recursive: true, force: true });
  }
  for (const img of FORBIDDEN_DEV_IMAGES) {
    const imgPath = path.join(distDir, img);
    if (fs.existsSync(imgPath)) {
      fs.rmSync(imgPath, { force: true });
    }
  }

  const remaining = getFiles(distDir);
  const violations = remaining
    .map(file => path.relative(distDir, file.path))
    .filter(rel => FORBIDDEN_DIST_PATTERN.test(rel) || FORBIDDEN_DEV_IMAGES.has(path.basename(rel)));

  if (violations.length > 0) {
    throw new Error(`SECURITY_ARTIFACT_LEAK_IN_DIST: Forbidden artifacts found in ${distDir}: ${violations.join(', ')}`);
  }
  return remaining;
}

function main() {
  console.log('\n📊 Starting post-build audit...');

  // 1. Calculate Build Duration
  let durationMs = 0;
  if (fs.existsSync('.build-start-time')) {
    const startTimeStr = fs.readFileSync('.build-start-time', 'utf8');
    const startTime = parseInt(startTimeStr, 10);
    durationMs = Date.now() - startTime;
    try {
      fs.unlinkSync('.build-start-time');
    } catch (_) {}
  }

  // 2. Sanitize & Scan Build Artifacts (dist/)
  const distDir = 'dist';
  const artifacts = sanitizeAndAuditDist(distDir);
  let totalSize = 0;
  const filesList = [];

  artifacts.forEach(file => {
    totalSize += file.size;
    const relativePath = path.relative(distDir, file.path);
    filesList.push({
      file: relativePath,
      sizeBytes: file.size,
      sizeFormatted: formatBytes(file.size)
    });
  });

  // 3. Extract Dependency Metrics
  let prodDepsCount = 0;
  let devDepsCount = 0;
  if (fs.existsSync('package.json')) {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    prodDepsCount = Object.keys(pkg.dependencies || {}).length;
    devDepsCount = Object.keys(pkg.devDependencies || {}).length;
  }

  // 4. Generate Build Summary Object
  const summary = {
    appName: "crm",
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    build: {
      durationMs,
      durationSeconds: parseFloat((durationMs / 1000).toFixed(2)),
      totalFiles: artifacts.length,
      totalSizeBytes: totalSize,
      totalSizeFormatted: formatBytes(totalSize)
    },
    dependencies: {
      productionCount: prodDepsCount,
      developmentCount: devDepsCount,
      totalCount: prodDepsCount + devDepsCount
    },
    artifacts: filesList
  };

  // 5. Write to build-summary.json
  const summaryPath = 'build-summary.json';
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  console.log('✅ Post-build audit completed successfully!');
  console.log(`⏱️  Build Duration: ${summary.build.durationSeconds}s`);
  console.log(`📦 Build Size: ${summary.build.totalSizeFormatted} (${summary.build.totalFiles} files)`);
  console.log(`📝 Summary written to: ${summaryPath}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve('scripts/postbuild.js')) {
  main();
}
