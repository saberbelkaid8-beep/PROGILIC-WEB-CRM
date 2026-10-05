import { defineConfig } from 'vite';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { SYSTEM_PROMPT, buildUserPrompt } from './src/business/ai/prompts.js';

export default defineConfig({
  plugins: [
    {
      name: 'ai-api-middleware',
      configureServer(server) {
        server.middlewares.use('/api/ai', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end(JSON.stringify({ error: 'Method Not Allowed' }));
            return;
          }

          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const { userMessage, activeContext, conversationHistory } = JSON.parse(body || '{}');
              const apiKey = process.env.GEMINI_API_KEY;

              if (!apiKey) {
                console.warn('[Server AI] GEMINI_API_KEY is missing on server process');
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'GEMINI_API_KEY_MISSING' }));
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

              res.setHeader('Content-Type', 'application/json');
              res.end(response.text);
            } catch (err) {
              console.error('[Server AI Error]:', err.message || err);
              const errMsg = err.message || String(err);
              const is503 = errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('high demand');
              const is429 = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota');
              
              const status = is503 ? 503 : is429 ? 429 : 500;
              res.statusCode = status;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ 
                error: errMsg,
                code: is503 ? 'UNAVAILABLE' : is429 ? 'RATE_LIMIT' : 'SERVER_ERROR',
                temporary: is503 || is429
              }));
            }
          });
        });
      }
    }
  ],
  build: {
    chunkSizeWarningLimit: 700,
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
          if (id.includes('node_modules/algeria-locations')) {
            return 'algeria-data';
          }
          if (id.includes('node_modules/minisearch')) {
            return 'search-engine';
          }
        }
      }
    }
  },
  server: {
    port: 3000,
    host: true,
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
});
