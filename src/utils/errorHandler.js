import { ask } from '../ai/client.js';
import chalk from 'chalk';

const FIX_SYSTEM_PROMPT = `You are a terminal error diagnostician. You will be given a shell command that failed and its error output.

Respond with ONLY a raw JSON object (no markdown fences, no extra text) matching this schema:

{
  "explanation": "one-line reason why it failed",
  "fixCommand": "a single shell command that would fix the underlying issue, or null if you can't determine one",
  "requiresInteractive": true or false,
  "retryOriginal": true or false
}

Rules:
- "fixCommand" should be a real, runnable command (e.g. "pkg install gh", "npm install commander", "git branch -M main"). If it needs a value only the user has (like a URL or token), set fixCommand to null and explain what the user needs to provide instead.
- CRITICAL: "fixCommand" must be a SINGLE atomic command only. NEVER chain multiple commands with "&&", "||", ";", or subshells — compound commands have unpredictable operator-precedence behavior (e.g. "A || B && C" does NOT mean "try A, else do B, then C" — it can run C even when A succeeds). If more than one command is genuinely needed, set fixCommand to the single most important one, set retryOriginal accordingly, and explain in "explanation" that further steps may follow.
- "requiresInteractive": true if the fix command needs live user input/typing while it runs (e.g. "gh auth login", any login/auth flow, any prompt-based installer). false for simple one-shot commands (e.g. "pkg install gh").
- "retryOriginal": true if, after the fix runs successfully, the original failed command should be automatically re-run.`;

/**
 * Called when a step's command fails during execution.
 * Sends the failing command + error to the AI and returns a structured
 * fix suggestion the executor can act on programmatically.
 */
async function suggestFix(command, errorOutput) {
  console.log(chalk.red(`\n✗ Command failed: ${command}`));
  console.log(chalk.gray(errorOutput.slice(0, 500)));

  try {
    const raw = await ask(FIX_SYSTEM_PROMPT, `Command: ${command}\nError: ${errorOutput}`);
    const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const fix = JSON.parse(cleaned);

    // Enforcement layer: don't just trust the prompt — if the model ignored
    // the "no compound commands" rule anyway, defensively split and keep
    // only the first atomic command rather than risk operator-precedence bugs.
    if (fix.fixCommand && /&&|\|\||;/.test(fix.fixCommand)) {
      const firstCommand = fix.fixCommand.split(/&&|\|\||;/)[0].trim();
      console.log(
        chalk.yellow(`(Fix contained multiple chained commands — using only: "${firstCommand}")`)
      );
      fix.fixCommand = firstCommand;
    }

    console.log(chalk.yellow(`\n💡 ${fix.explanation}`));
    if (fix.fixCommand) {
      console.log(chalk.gray(`   Suggested fix: $ ${fix.fixCommand}`));
    }

    return fix;
  } catch {
    console.log(chalk.gray('(Could not reach AI for a fix suggestion.)'));
    return { explanation: null, fixCommand: null, requiresInteractive: false, retryOriginal: false };
  }
}

export { suggestFix };

