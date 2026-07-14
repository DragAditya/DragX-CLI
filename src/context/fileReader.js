import { readFileSync, statSync } from 'node:fs';

const SMALL_FILE_LIMIT_BYTES = 8000; // ~2000 tokens roughly
const MAX_LINES_FOR_LARGE_FILE = 40;

/**
 * Reads a file intelligently:
 * - Small files: full content
 * - Large files: first + last N lines with a truncation note
 */
function readFileSmart(filePath) {
  try {
    const stats = statSync(filePath);
    const content = readFileSync(filePath, 'utf-8');

    if (stats.size <= SMALL_FILE_LIMIT_BYTES) {
      return { path: filePath, truncated: false, content };
    }

    const lines = content.split('\n');
    const head = lines.slice(0, MAX_LINES_FOR_LARGE_FILE / 2);
    const tail = lines.slice(-MAX_LINES_FOR_LARGE_FILE / 2);
    const summarized = [
      ...head,
      `\n... [truncated — file is ${stats.size} bytes, ${lines.length} lines total] ...\n`,
      ...tail,
    ].join('\n');

    return { path: filePath, truncated: true, content: summarized };
  } catch (err) {
    return { path: filePath, truncated: false, content: '', error: err.message };
  }
}

/**
 * Reads multiple files and returns a combined context block.
 */
function readFilesForContext(filePaths) {
  return filePaths
    .map((p) => {
      const result = readFileSmart(p);
      if (result.error) return `--- ${p} (unreadable: ${result.error}) ---`;
      return `--- ${p}${result.truncated ? ' (truncated)' : ''} ---\n${result.content}`;
    })
    .join('\n\n');
}

export { readFileSmart, readFilesForContext };
