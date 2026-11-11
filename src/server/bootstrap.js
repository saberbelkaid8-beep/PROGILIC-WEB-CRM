/**
 * Server Bootstrap & Node Environment Initializer
 * Configures process-level diagnostics and clean server execution boundaries.
 * No fake DOM or window polyfills polluting Node.js global scope.
 */

import fs from 'fs';
import path from 'path';

// Configure default process environment if not explicitly set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

// Load local .env into process.env if present
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const firstEquals = trimmed.indexOf('=');
      if (firstEquals === -1) return;
      const key = trimmed.slice(0, firstEquals).trim();
      let value = trimmed.slice(firstEquals + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    });
  }
} catch (e) {
  // Silent fallback
}

// Global process-level safety handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server Diagnostic] Unhandled Rejection at:', promise, 'reason:', reason);
});


