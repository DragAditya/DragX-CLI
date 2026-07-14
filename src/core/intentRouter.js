import { ask } from '../ai/client.js';

const INTENT_SYSTEM_PROMPT = `You classify a user's terminal input into exactly one intent. Respond with ONLY a raw JSON object, no markdown fences, no extra text:

{ "intent": "chat" | "project_help" | "action" }

Rules:
- "chat": casual conversation, greetings, questions unrelated to the current project/repo (e.g. "hello bhai", "kaise ho", "what's the weather", "tell me a joke", general knowledge questions).
- "project_help": the user wants to understand THIS project/codebase — how to run it, set it up, what it does, how to install dependencies, what tech stack it uses, etc. (e.g. "ye project kaise run karu", "how do I set this up", "what does this code do", "isme kya hai").
- "action": the user wants something DONE — a git operation, file operation, GitHub action, commit, push, delete, create, rename, etc. (e.g. "commit karo", "push karo", "delete old files", "create a new repo").

When genuinely ambiguous, prefer "action" only if there's a clear verb implying a file/git change; otherwise prefer "chat".`;

/**
 * Classifies user input into one of three intents so the CLI can route
 * to the right handler instead of always trying to build a git/file plan.
 */
async function classifyIntent(userInput) {
  try {
    const raw = await ask(INTENT_SYSTEM_PROMPT, userInput);
    const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    if (['chat', 'project_help', 'action'].includes(parsed.intent)) {
      return parsed.intent;
    }
    return 'action'; // safe default — falls back to old behavior
  } catch {
    return 'action'; // if classification fails, don't block the user — fall back
  }
}

export { classifyIntent };
