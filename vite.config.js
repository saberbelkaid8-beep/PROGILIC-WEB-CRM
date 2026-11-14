import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { SYSTEM_PROMPT, buildUserPrompt } from './src/business/ai/prompts.js';
import {
  extractBearerToken,
  verifyFirebaseIdToken,
  assertTrelloAuthorizedPrincipal
} from './src/server/middleware/authMiddleware.js';

const MAX_DEV_BODY_BYTES = 1048576; // 1MB
const FORBIDDEN_DIST_ROOT_FILES = new Set([
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

function readRequestBodyWithLimit(req, limitBytes = MAX_DEV_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let body = '';
    let bytes = 0;
    req.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > limitBytes) {
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
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

export default defineConfig({
  plugins: [
    {
      name: 'sanitize-dist-artifacts',
      closeBundle() {
        const distDir = path.resolve(process.cwd(), 'dist');
        if (!fs.existsSync(distDir)) return;

        const aistudioDistDir = path.join(distDir, 'assets', 'aistudio');
        if (fs.existsSync(aistudioDistDir)) {
          fs.rmSync(aistudioDistDir, { recursive: true, force: true });
        }

        for (const filename of FORBIDDEN_DIST_ROOT_FILES) {
          const filePath = path.join(distDir, filename);
          if (fs.existsSync(filePath)) {
            fs.rmSync(filePath, { force: true });
          }
        }
      }
    },
    {
      name: 'ai-api-middleware',
      configureServer(server) {
        server.middlewares.use('/api/ai', async (req, res) => {
          if (req.method !== 'POST') {
            sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
            return;
          }

          try {
            const token = extractBearerToken(req.headers);
            if (!token) {
              sendJson(res, 401, { error: 'UNAUTHENTICATED', message: 'Missing Bearer ID token in Authorization header.' });
              return;
            }
            await verifyFirebaseIdToken(token);

            const body = await readRequestBodyWithLimit(req);
            const { userMessage, activeContext, conversationHistory } = JSON.parse(body || '{}');
            const apiKey = process.env.GEMINI_API_KEY;

            if (!apiKey) {
              console.warn('[Server AI] GEMINI_API_KEY is missing on server process');
              sendJson(res, 400, { error: 'GEMINI_API_KEY_MISSING' });
              return;
            }

            const ai = new GoogleGenAI({
              apiKey,
              httpOptions: {
                headers: {
                  'User-Agent': 'aistudio-build',
                }
              }
            });
            const promptText = buildUserPrompt(userMessage, activeContext, conversationHistory);

            const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-pro'];
            let response = null;
            let lastError = null;

            for (const modelName of modelsToTry) {
              try {
                const genConfig = {
                  systemInstruction: SYSTEM_PROMPT,
                  responseMimeType: 'application/json',
                  responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                      intent: { type: Type.STRING },
                      confidence: { type: Type.NUMBER },
                      summary: { type: Type.STRING },
                      plan: { type: Type.ARRAY, items: { type: Type.STRING } },
                      extractedData: {
                        type: Type.OBJECT,
                        properties: {
                          fullName: { type: Type.STRING },
                          company: { type: Type.STRING },
                          phone: { type: Type.STRING },
                          email: { type: Type.STRING },
                          wilaya: { type: Type.STRING },
                          commune: { type: Type.STRING },
                          address: { type: Type.STRING },
                          status: { type: Type.STRING },
                          query: { type: Type.STRING },
                          clientId: { type: Type.STRING },
                          programName: { type: Type.STRING },
                          licenseType: { type: Type.STRING },
                          issueTitle: { type: Type.STRING },
                          issuePriority: { type: Type.STRING },
                          targetPage: { type: Type.STRING }
                        }
                      },
                      clarificationNeeded: { type: Type.ARRAY, items: { type: Type.STRING } },
                      warning: { type: Type.STRING }
                    },
                    required: ['intent', 'confidence', 'summary', 'plan']
                  }
                };

                if (modelName.startsWith('gemini-3')) {
                  genConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
                }

                response = await ai.models.generateContent({
                  model: modelName,
                  contents: promptText,
                  config: genConfig
                });
                if (response && response.text) break;
              } catch (err) {
                console.warn(`[Server AI] Model ${modelName} failed:`, err.message || err);
                lastError = err;
              }
            }

            if (!response || !response.text) {
              throw lastError || new Error('All Gemini model attempts failed');
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Cache-Control', 'no-store');
            res.end(response.text);
          } catch (err) {
            console.error('[Server AI Error]:', err.message || err);
            const errMsg = err.message || String(err);
            if (err.status) {
              sendJson(res, err.status, { error: err.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'AUTH_OR_REQUEST_ERROR' });
              return;
            }
            const is503 = errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('high demand');
            const is429 = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota');
            const status = is503 ? 503 : is429 ? 429 : 500;
            sendJson(res, status, {
              error: is503 ? 'UNAVAILABLE' : is429 ? 'RATE_LIMIT' : 'AI_REQUEST_FAILED',
              code: is503 ? 'UNAVAILABLE' : is429 ? 'RATE_LIMIT' : 'SERVER_ERROR',
              temporary: is503 || is429
            });
          }
        });

        // Trello Webhook and Integration Routes
        server.middlewares.use('/api/trello', async (req, res) => {
          const url = req.url || '/';

          // HEAD request for Trello Webhook registration validation
          if (req.method === 'HEAD') {
            res.statusCode = 200;
            res.end();
            return;
          }

          try {
            const body = await readRequestBodyWithLimit(req);
            if (url.includes('/classify')) {
              if (req.method !== 'POST') {
                sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
                return;
              }
              const token = extractBearerToken(req.headers);
              if (!token) {
                sendJson(res, 401, { error: 'UNAUTHENTICATED', message: 'Missing Bearer ID token in Authorization header.' });
                return;
              }
              const decoded = await verifyFirebaseIdToken(token);
              assertTrelloAuthorizedPrincipal(decoded, process.env);

              const parsed = body ? JSON.parse(body) : {};
              const apiKey = process.env.GEMINI_API_KEY;
              const { handleTrelloAiClassify } = await import('./src/server/trelloRoutes.js');
              const classification = await handleTrelloAiClassify(parsed, apiKey);
              sendJson(res, 200, classification);
              return;
            }

            if (url.includes('/webhook')) {
              const { handleTrelloWebhookRequest } = await import('./src/server/trelloRoutes.js');
              const result = await handleTrelloWebhookRequest(body, req.headers, req.method, process.env);
              res.statusCode = result.status;
              if (result.headers) {
                for (const [k, v] of Object.entries(result.headers)) {
                  res.setHeader(k, v);
                }
              }
              res.end(result.body);
              return;
            }

            sendJson(res, 404, { error: 'Endpoint not found' });
          } catch (err) {
            const status = err.status || 500;
            sendJson(res, status, { error: status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_REJECTED' });
          }
        });
      }
    }
  ],
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase/auth')) {
            return 'firebase-auth';
          }
          if (id.includes('node_modules/firebase/firestore')) {
            return 'firebase-firestore';
          }
          if (id.includes('node_modules/firebase')) {
            return 'firebase-core';
          }
          if (id.includes('node_modules/minisearch')) {
            return 'search-engine';
          }
          if (id.includes('src/utils/i18n.js')) {
            return 'crm-i18n';
          }
        }
      }
    }
  },
  base: './',
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
  preview: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
