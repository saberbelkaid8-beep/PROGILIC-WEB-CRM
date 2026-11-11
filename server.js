/**
 * PROGILIC CRM v3 — Production Standalone Server
 * 
 * Production-compatible HTTP backend independent of Vite dev server.
 * Handles /api/trello/* webhooks, /api/ai proxy, health checks, and serves compiled dist/ assets.
 */

import './src/server/bootstrap.js';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleTrelloAiClassify, handleTrelloWebhookRequest } from './src/server/trelloRoutes.js';
import { initFirebaseAdmin, getFirebaseAdminStatus, checkFirestoreReadiness } from './src/server/firebaseAdmin.js';
import { extractBearerToken, verifyFirebaseIdToken, assertTenantAccess, assertTrelloAuthorizedPrincipal } from './src/server/middleware/authMiddleware.js';
import { initiateTrelloOAuth, handleTrelloOAuthCallback } from './src/server/trelloOAuth.js';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';
const DIST_DIR = path.resolve(__dirname, 'dist');
const MAX_BODY_BYTES = 1048576; // 1MB upper limit for API payloads

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // 1a. Liveness Endpoints (/health and /livez) - Process alive probe
  if (pathname === '/health' || pathname === '/livez') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      liveness: true,
      service: 'progilic-crm-backend',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version
    }));
    return;
  }

  // 1b. Readiness Endpoints (/ready and /api/ready) - Confirms Firebase Admin & Firestore are operational
  if (pathname === '/ready' || pathname === '/api/ready') {
    const adminStatus = getFirebaseAdminStatus();
    const firestoreCheck = await checkFirestoreReadiness();
    const isReady = adminStatus.status === 'READY' && firestoreCheck.operational;
    const statusCode = isReady ? 200 : 503;

    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: isReady ? 'ready' : 'not_ready',
      ready: isReady,
      service: 'progilic-crm-backend',
      services: {
        server: 'ok',
        firebaseAdmin: adminStatus.status,
        firestore: firestoreCheck.operational ? 'operational' : 'degraded'
      },
      error: isReady ? null : (firestoreCheck.reason || adminStatus.error || 'FIRESTORE_NOT_READY'),
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime())
    }));
    return;
  }

  // 1c. Diagnostic Health Endpoint (/api/health)
  if (pathname === '/api/health') {
    const adminStatus = getFirebaseAdminStatus();
    const firestoreCheck = await checkFirestoreReadiness();
    const isReady = adminStatus.status === 'READY' && firestoreCheck.operational;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      liveness: true,
      ready: isReady,
      service: 'progilic-crm-backend',
      services: {
        server: 'ok',
        firebaseAdmin: adminStatus.status,
        firestore: firestoreCheck.operational ? 'operational' : 'degraded'
      },
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version
    }));
    return;
  }

  // Helper to read request body safely with size limit
  const readBody = () => new Promise((resolve, reject) => {
    let body = '';
    let bytesReceived = 0;
    req.on('data', chunk => {
      bytesReceived += chunk.length;
      if (bytesReceived > MAX_BODY_BYTES) {
        req.destroy();
        const err = new Error('PAYLOAD_TOO_LARGE');
        err.status = 413;
        reject(err);
        return;
      }
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });

  // 2. Trello Webhook Endpoint
  if (pathname === '/api/trello/webhook') {
    try {
      const rawBody = await readBody();
      const result = await handleTrelloWebhookRequest(rawBody, req.headers, req.method, process.env);
      res.writeHead(result.status, result.headers || { 'Content-Type': 'application/json' });
      res.end(result.body);
    } catch (err) {
      const status = err.status || 500;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'INTERNAL_SERVER_ERROR' }));
    }
    return;
  }

  // 3. Trello AI Classify Endpoint (Protected User Endpoint)
  if (pathname === '/api/trello/classify') {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }));
      return;
    }
    try {
      const token = extractBearerToken(req.headers);
      if (!token) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'UNAUTHENTICATED', message: 'Missing Bearer ID token in Authorization header.' }));
        return;
      }
      const decoded = await verifyFirebaseIdToken(token);
      assertTrelloAuthorizedPrincipal(decoded, process.env);

      const body = await readBody();
      const parsed = JSON.parse(body || '{}');
      const apiKey = process.env.GEMINI_API_KEY;
      const classification = await handleTrelloAiClassify(parsed, apiKey);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(classification));
    } catch (err) {
      const status = err.status || 500;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'INTERNAL_SERVER_ERROR' }));
    }
    return;
  }

  // 3a. Trello Confidential OAuth 2.0 Start (/api/trello/oauth/start) (Protected User Endpoint)
  if (pathname === '/api/trello/oauth/start') {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }));
      return;
    }
    try {
      const token = extractBearerToken(req.headers) || parsedUrl.searchParams.get('token');
      if (!token) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'UNAUTHENTICATED', message: 'Missing Bearer ID token.' }));
        return;
      }
      const decoded = await verifyFirebaseIdToken(token);
      assertTrelloAuthorizedPrincipal(decoded, process.env);

      const returnUrl = parsedUrl.searchParams.get('returnUrl') || '/';
      const oauthData = initiateTrelloOAuth({
        uid: decoded.uid,
        email: decoded.email,
        returnUrl
      }, process.env);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(oauthData));
    } catch (err) {
      const status = err.status || 500;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'INTERNAL_SERVER_ERROR' }));
    }
    return;
  }

  // 3b. Trello Confidential OAuth 2.0 Callback (/api/trello/oauth/callback)
  if (pathname === '/api/trello/oauth/callback') {
    try {
      const queryParams = Object.fromEntries(parsedUrl.searchParams.entries());
      const result = await handleTrelloOAuthCallback(queryParams, process.env);

      // Successfully authorized and bound to single account progilicservice@gmail.com
      const redirectTarget = new URL(result.returnUrl || '/', `http://${req.headers.host || 'localhost'}`);
      redirectTarget.searchParams.set('trello_auth', 'success');
      if (result.member && result.member.username) {
        redirectTarget.searchParams.set('trello_user', result.member.username);
      }

      res.writeHead(302, { 'Location': redirectTarget.pathname + redirectTarget.search });
      res.end();
    } catch (err) {
      const status = err.status || 500;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'OAUTH_CALLBACK_FAILED' }));
    }
    return;
  }

  // 4. General AI Assistant Route (/api/ai) (Protected User Endpoint)
  if (pathname === '/api/ai') {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }));
      return;
    }
    try {
      const token = extractBearerToken(req.headers);
      if (!token) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'UNAUTHENTICATED', message: 'Missing Bearer ID token in Authorization header.' }));
        return;
      }
      await verifyFirebaseIdToken(token);

      const body = await readBody();
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'GEMINI_API_KEY_MISSING' }));
        return;
      }
      const parsed = JSON.parse(body || '{}');
      const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: parsed.prompt || '',
        config: {
          responseMimeType: 'application/json'
        }
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(response.text || '{}');
    } catch (err) {
      const status = err.status || 500;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'INTERNAL_SERVER_ERROR' }));
    }
    return;
  }

  // 5. Catch unmatched /api/* routes (API routes must never return HTML fallback)
  if (pathname.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'API_ENDPOINT_NOT_FOUND', path: pathname }));
    return;
  }

  // 6. Static Asset Serving (dist/) with SPA Fallback
  if (req.method === 'GET' || req.method === 'HEAD') {
    let filePath = path.join(DIST_DIR, pathname === '/' ? 'index.html' : pathname);

    // Prevent directory traversal
    if (!filePath.startsWith(DIST_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        // SPA Fallback to index.html
        filePath = path.join(DIST_DIR, 'index.html');
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      fs.readFile(filePath, (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
          return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        if (req.method === 'HEAD') {
          res.end();
        } else {
          res.end(content);
        }
      });
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'NOT_FOUND' }));
});

// Graceful shutdown handling
function setupGracefulShutdown(srv) {
  const shutdown = (signal) => {
    console.log(`[PROGILIC Production Server] Received ${signal}. Closing HTTP server cleanly...`);
    srv.close(() => {
      console.log('[PROGILIC Production Server] Server closed. Exiting process.');
      process.exit(0);
    });
    setTimeout(() => {
      console.error('[PROGILIC Production Server] Forcefully terminating after timeout.');
      process.exit(1);
    }, 5000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

const isDirectRun = Boolean(
  process.env.NODE_ENV === 'production' ||
  process.argv.includes('--start') ||
  (process.argv[1] && (process.argv[1].endsWith('server.js') || process.argv[1].endsWith('server')))
);

if (isDirectRun) {
  try {
    initFirebaseAdmin();
  } catch (adminErr) {
    console.warn('[PROGILIC Production Server] Firebase Admin boot notice:', adminErr.message);
  }

  server.listen(PORT, HOST, () => {
    console.log(`[PROGILIC Production Server] Listening on http://${HOST}:${PORT}`);
  });
  setupGracefulShutdown(server);
}

export { server };
