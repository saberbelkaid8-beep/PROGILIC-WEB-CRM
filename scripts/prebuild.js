import fs from 'fs';
import path from 'path';

function checkFileExists(filePath, description) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Missing critical file: ${filePath} (${description})`);
    return false;
  }
  console.log(`✅ File found: ${filePath} (${description})`);
  return true;
}

function parseDotenv(content) {
  const env = {};
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const firstEquals = trimmed.indexOf('=');
    if (firstEquals === -1) return;
    const key = trimmed.slice(0, firstEquals).trim();
    let value = trimmed.slice(firstEquals + 1).trim();
    // Strip quotes if they exist
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  });
  return env;
}

function main() {
  console.log('🏁 Starting pre-build compatibility & integrity check...');

  // Record build start timestamp for post-build duration auditing
  fs.writeFileSync('.build-start-time', Date.now().toString());

  // 1. Check Critical Files
  const criticalFiles = [
    { path: 'package.json', desc: 'Package Manifest' },
    { path: 'package-lock.json', desc: 'Lockfile for reproducible builds' },
    { path: 'vite.config.js', desc: 'Vite Config' },
    { path: 'index.html', desc: 'App entry HTML' },
    { path: 'src/main.js', desc: 'Main JavaScript entrypoint' },
    { path: '.env.example', desc: 'Environment variables template' }
  ];

  let filesOk = true;
  criticalFiles.forEach(file => {
    if (!checkFileExists(file.path, file.desc)) {
      filesOk = false;
    }
  });

  if (!filesOk) {
    console.error('❌ Pre-build check failed: One or more critical files are missing!');
    process.exit(1);
  }

  // 2. Parse .env.example keys
  const envExampleContent = fs.readFileSync('.env.example', 'utf8');
  const exampleEnv = parseDotenv(envExampleContent);
  const requiredKeys = Object.keys(exampleEnv);

  // 3. Load local .env if it exists
  let localEnv = {};
  if (fs.existsSync('.env')) {
    localEnv = parseDotenv(fs.readFileSync('.env', 'utf8'));
    console.log('ℹ️ Loaded environment from local .env file.');
  }

  // 4. Verify Env Keys (from process.env or localEnv)
  console.log('\n🔐 Checking environment variables compatibility...');
  let missingKeys = [];
  requiredKeys.forEach(key => {
    const val = process.env[key] || localEnv[key];
    if (val === undefined || val === '') {
      missingKeys.push(key);
    } else {
      console.log(`✅ Env variable "${key}" is set.`);
    }
  });

  if (missingKeys.length > 0) {
    console.warn(`⚠️ Warning: The following environment variables from .env.example are not set:`);
    missingKeys.forEach(key => console.warn(`   - ${key}`));
    console.warn('👉 Make sure to configure these in your Cloudflare Pages dashboard under "Environment variables" if needed by the application.');
  } else {
    console.log('✅ All environment variables are correctly configured.');
  }

  console.log('\n🚀 Pre-build compatibility and integrity check passed successfully!');
}

main();
