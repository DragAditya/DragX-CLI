import { GoogleGenAI } from '@google/genai';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const PRIMARY_MODEL = 'gemini-3.1-flash-lite';
const FALLBACK_MODEL = 'gemini-3-flash';

let aiInstance = null;
let envLoaded = false;

/**
 * Minimal .env loader — no extra dependency needed for something this simple.
 * Checks the current project directory first, then the user's home dir
 * (~/.dragx/.env) as a fallback for a global default key.
 * Only sets variables that aren't already set (real env vars win).
 */
function loadDotEnv() {
  if (envLoaded) return;
  envLoaded = true;

  const candidates = [join(process.cwd(), '.env'), join(homedir(), '.dragx', '.env')];

  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const lines = readFileSync(path, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      // strip surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
    break; // stop after first .env found (project-local takes priority)
  }
}

/**
 * Lazily creates and returns a singleton GoogleGenAI client.
 * Reads the API key from process.env.GEMINI_API_KEY (loading .env first if present).
 */
function getClient() {
  if (aiInstance) return aiInstance;

  loadDotEnv();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY not found. Set it with: export GEMINI_API_KEY="your-key-here"\n' +
        '(or create a .env file with GEMINI_API_KEY=your-key-here in this project, or in ~/.dragx/.env for a global default)'
    );
  }

  aiInstance = new GoogleGenAI({ apiKey });
  return aiInstance;
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(err) {
  const msg = err.message?.toLowerCase() || '';
  return msg.includes('429') || msg.includes('rate limit') || msg.includes('quota');
}

/**
 * Sends a prompt to Gemini and returns the raw text response.
 * Tries the primary (flash-lite) model with exponential backoff on rate
 * limits (up to MAX_RETRIES), then falls back to gemini-3-flash if the
 * primary model keeps failing for any reason.
 *
 * @param {string} systemPrompt - instructions for how the model should behave
 * @param {string} userInput - the actual user message/command
 * @returns {Promise<string>} the model's text response
 */
async function ask(systemPrompt, userInput) {
  const ai = getClient();
  const contents = [
    { role: 'user', parts: [{ text: `${systemPrompt}\n\nUser input: ${userInput}` }] },
  ];

  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await ai.models.generateContent({ model: PRIMARY_MODEL, contents });
      return response.text;
    } catch (err) {
      lastError = err;
      if (isRateLimitError(err) && attempt < MAX_RETRIES - 1) {
        const delay = BASE_DELAY_MS * 2 ** attempt; // 1s, 2s, 4s
        await sleep(delay);
        continue;
      }
      break; // non-rate-limit error, or out of retries — stop trying primary
    }
  }

  // Primary model exhausted retries or failed outright — try fallback once
  try {
    const response = await ai.models.generateContent({ model: FALLBACK_MODEL, contents });
    return response.text;
  } catch (fallbackError) {
    throw new Error(
      `Both models failed. Primary: ${lastError.message} | Fallback: ${fallbackError.message}`
    );
  }
}

export { ask, getClient, PRIMARY_MODEL, FALLBACK_MODEL };
