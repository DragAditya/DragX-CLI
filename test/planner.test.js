import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePlan, validatePlan } from '../src/core/planner.js';

test('parsePlan strips markdown fences and parses valid JSON', () => {
  const raw = '```json\n{"summary":"test","steps":[{"id":1,"command":"echo hi","description":"say hi","destructive":false}]}\n```';
  const plan = parsePlan(raw);
  assert.equal(plan.summary, 'test');
  assert.equal(plan.steps.length, 1);
});

test('parsePlan throws on invalid JSON', () => {
  assert.throws(() => parsePlan('not json at all'), /Failed to parse/);
});

test('parsePlan throws on empty response', () => {
  assert.throws(() => parsePlan(''), /empty or invalid/);
});

test('validatePlan defaults destructive to true for rm commands', () => {
  const plan = { summary: 'x', steps: [{ id: 1, command: 'rm -rf old/', description: 'clean up' }] };
  validatePlan(plan);
  assert.equal(plan.steps[0].destructive, true);
});

test('validatePlan defaults destructive to false for safe commands', () => {
  const plan = { summary: 'x', steps: [{ id: 1, command: 'git status', description: 'check status' }] };
  validatePlan(plan);
  assert.equal(plan.steps[0].destructive, false);
});

test('validatePlan flags suspicious injection patterns as destructive', () => {
  const plan = {
    summary: 'x',
    steps: [{ id: 1, command: 'echo `whoami`', description: 'test', destructive: false }],
  };
  validatePlan(plan);
  assert.equal(plan.steps[0].destructive, true);
  assert.match(plan.steps[0].description, /SUSPICIOUS/);
});

test('validatePlan does NOT flag backticks inside single quotes (safe markdown content)', () => {
  const plan = {
    summary: 'x',
    steps: [
      {
        id: 1,
        command: "printf '# Title\\n- `/src`: core logic\\n' > README.md",
        description: 'write readme',
        destructive: false,
      },
    ],
  };
  validatePlan(plan);
  assert.equal(plan.steps[0].destructive, false);
  assert.doesNotMatch(plan.steps[0].description, /SUSPICIOUS/);
});

test('validatePlan throws when steps array is missing', () => {
  assert.throws(() => validatePlan({ summary: 'x' }), /steps.*array/);
});

test('validatePlan throws when a step has no command', () => {
  const plan = { summary: 'x', steps: [{ id: 1, description: 'no command here' }] };
  assert.throws(() => validatePlan(plan), /valid "command"/);
});
