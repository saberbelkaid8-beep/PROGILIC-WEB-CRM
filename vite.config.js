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

              const modelsToTry = ['gemini-3.8-flash', 'gemini-2.5-flash'];
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
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message || 'Server AI Generation Error' }));
            }
          });
        });
      }
    }
  ],
  server: {
    port: 3000,
    host: true,
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
});
