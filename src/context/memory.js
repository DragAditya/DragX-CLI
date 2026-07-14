import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DRAGX_DIR = '.dragx';
const MEMORY_FILE = 'memory.json';

function getMemoryPath() {
  return join(process.cwd(), DRAGX_DIR, MEMORY_FILE);
}

function ensureDragxDir() {
  const dir = join(process.cwd(), DRAGX_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Loads memory.json, or returns a fresh default structure if it doesn't exist yet.
 */
function loadMemory() {
  const path = getMemoryPath();
  if (!existsSync(path)) {
    return { history: [], createdAt: new Date().toISOString() };
  }
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return { history: [], createdAt: new Date().toISOString() };
  }
}

/**
 * Appends a completed command + its plan to memory, keeping only the last 50 entries.
 * Also updates "lastInteraction" with fuller detail (actual step commands, not just
 * the summary) so the very next command can resolve follow-up references like
 * "ab usko push bhi kardo" (referring to what was just done).
 */
function recordCommand(userInput, plan) {
  ensureDragxDir();
  const memory = loadMemory();

  const entry = {
    timestamp: new Date().toISOString(),
    input: userInput,
    summary: plan.summary,
    stepCount: plan.steps?.length ?? 0,
  };

  memory.history.push(entry);

  // keep memory file from growing forever
  if (memory.history.length > 50) {
    memory.history = memory.history.slice(-50);
  }

  // fuller record of just the most recent interaction, for follow-up resolution
  memory.lastInteraction = {
    input: userInput,
    summary: plan.summary,
    steps: (plan.steps || []).map((s) => ({ description: s.description, command: s.command })),
    timestamp: entry.timestamp,
  };

  writeFileSync(getMemoryPath(), JSON.stringify(memory, null, 2), 'utf-8');
}

export { loadMemory, recordCommand, ensureDragxDir };
