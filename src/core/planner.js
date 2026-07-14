/**
 * Strips markdown code fences if the model added them despite instructions,
 * and parses the result as JSON. Throws a clear error if parsing fails.
 */
function parsePlan(rawResponse) {
  if (!rawResponse || typeof rawResponse !== 'string') {
    throw new Error('AI returned an empty or invalid response.');
  }

  const cleaned = rawResponse
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  let plan;
  try {
    plan = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(
      `Failed to parse AI response as JSON: ${err.message}\n\nRaw response:\n${cleaned}`
    );
  }

  validatePlan(plan);
  return plan;
}

/**
 * Detects genuinely dangerous shell substitution — backticks or $() that
 * appear OUTSIDE single-quoted segments. Inside single quotes, POSIX shells
 * never interpret backticks or $() as command substitution, so content like
 * printf '...`/src`...' (markdown backticks in a README) is completely safe
 * and must NOT be flagged. This avoids false positives on legitimate content
 * while still catching real injection attempts in unquoted/double-quoted spots.
 */
function hasUnsafeSubstitution(command) {
  // Strip out everything inside single-quoted segments first
  const withoutSingleQuoted = command.replace(/'[^']*'/g, '');
  return /`|\$\(/.test(withoutSingleQuoted);
}

function hasSuspiciousChaining(command) {
  return /&&\s*rm|;.*rm\s|\|\s*sh\b|\|\s*bash\b/.test(command);
}

/**
 * Basic shape validation so executor.js never crashes on malformed plans.
 * Also flags commands containing shell-injection-prone patterns (unquoted
 * backticks, $() substitution, or suspicious chaining) as destructive,
 * forcing an explicit confirmation even if the model didn't flag it itself.
 */
function validatePlan(plan) {
  if (!plan || typeof plan !== 'object') {
    throw new Error('Plan is not a valid object.');
  }

  // defaults for the newer fields — older/malformed responses shouldn't crash the tool
  if (!['high', 'medium', 'low'].includes(plan.confidence)) {
    plan.confidence = 'medium';
  }
  if (typeof plan.needsClarification !== 'boolean') {
    plan.needsClarification = false;
  }

  if (plan.needsClarification) {
    if (!plan.clarificationQuestion || typeof plan.clarificationQuestion !== 'string') {
      plan.clarificationQuestion = 'Could you clarify exactly what you want done?';
    }
    plan.steps = []; // clarification plans never carry steps
    return true;
  }

  if (!Array.isArray(plan.steps)) {
    throw new Error('Plan is missing a valid "steps" array.');
  }
  for (const step of plan.steps) {
    if (!step.command || typeof step.command !== 'string') {
      throw new Error(`Step ${step.id ?? '?'} is missing a valid "command" string.`);
    }
    if (typeof step.destructive !== 'boolean') {
      // default to safe assumption if the model forgot to flag it
      step.destructive = /rm |delete|force|reset --hard|push -f/.test(step.command);
    }
    if (hasUnsafeSubstitution(step.command) || hasSuspiciousChaining(step.command)) {
      step.destructive = true;
      step.description = `⚠ SUSPICIOUS PATTERN DETECTED — ${step.description}`;
    }
  }
  return true;
}

export { parsePlan, validatePlan };
