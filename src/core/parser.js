import { ask } from '../ai/client.js';
import { SYSTEM_PROMPT } from '../ai/prompts.js';
import { scanRepo } from '../context/scanner.js';
import { ensureGitignore } from '../context/gitignoreGuard.js';
import { loadMemory } from '../context/memory.js';
import * as log from '../utils/logger.js';

/**
 * Builds a short context block from recent command history, so the AI
 * has some awareness of past actions in this project (e.g. avoid repeating
 * a "create repo" that already happened, match past commit message style).
 * The most recent interaction gets fuller detail (actual commands run) so
 * follow-up references like "ab usko push bhi kardo" can be resolved —
 * older history is kept to a one-line summary to save tokens.
 */
function buildMemoryContext() {
  const memory = loadMemory();
  if (!memory.history || memory.history.length === 0) return '';

  const recent = memory.history.slice(-5, -1); // all but the most recent (that's lastInteraction)
  const olderLines = recent.map((h) => `- "${h.input}" → ${h.summary}`).join('\n');

  let lastBlock = '';
  if (memory.lastInteraction) {
    const li = memory.lastInteraction;
    const stepLines = li.steps.map((s) => `  - ${s.description}: ${s.command}`).join('\n');
    lastBlock = `\n\nMOST RECENT command (use this to resolve follow-up references like "usko", "wo file", "ye commit"):\nUser said: "${li.input}"\nWhat happened:\n${stepLines}`;
  }

  const olderBlock = olderLines
    ? `\n\nEarlier command history (context only, do not repeat completed actions):\n${olderLines}`
    : '';

  return `${lastBlock}${olderBlock}`;
}

/**
 * Takes the user's raw natural-language command, builds full context
 * (repo state + file tree + recent memory), and asks the AI for a plan.
 * Returns the raw text response (expected to be JSON — planner.js parses it).
 */
async function parseCommand(userInput) {
  const gitignoreUpdated = ensureGitignore();
  if (gitignoreUpdated) {
    log.info('(.gitignore updated to protect .dragx/, node_modules/, .env)');
  }

  const repoContext = scanRepo();
  const memoryContext = buildMemoryContext();

  const fullPrompt = `${SYSTEM_PROMPT}\n\n--- REPO CONTEXT ---\n${repoContext.contextText}${memoryContext}\n--- END CONTEXT ---`;

  const rawResponse = await ask(fullPrompt, userInput);
  return rawResponse;
}

export { parseCommand };
