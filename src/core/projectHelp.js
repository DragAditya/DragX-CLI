import { ask } from '../ai/client.js';
import { buildProjectContext } from '../context/projectDetector.js';

const PROJECT_HELP_SYSTEM_PROMPT = `You are DragX, a terminal assistant helping a user understand and run an unfamiliar project. You'll be given project context (manifest files, scripts, README excerpt). Respond in plain text (NOT JSON) with:

1. A one-line summary of what kind of project this is.
2. A short numbered step-by-step guide to set up and run it (install dependencies, configure env vars if apparent, the run command).

Respond in the same language style as the user's question (Hindi/English/Hinglish). Keep it concise — this is a terminal, not documentation. If you genuinely can't tell how to run it from the given context, say so plainly instead of guessing.`;

/**
 * Explains how to run/set up the current project based on detected
 * manifest files and README content.
 */
async function explainProject(userInput) {
  const context = buildProjectContext();
  const fullPrompt = `${PROJECT_HELP_SYSTEM_PROMPT}\n\n--- PROJECT CONTEXT ---\n${context}\n--- END CONTEXT ---`;
  return ask(fullPrompt, userInput);
}

export { explainProject };
