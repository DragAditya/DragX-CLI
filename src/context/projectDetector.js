import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const CWD = () => process.cwd();

/**
 * Checks common manifest files across ecosystems and returns whatever
 * useful info it can find — package.json scripts, requirements.txt presence,
 * README content, etc. Best-effort: works even on unfamiliar project types
 * by just reporting what files exist.
 */
function detectProject() {
  const findings = [];

  // Node.js / JS / TS
  const pkgPath = join(CWD(), 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      findings.push({
        type: 'Node.js',
        manifest: 'package.json',
        scripts: pkg.scripts || {},
        dependencies: Object.keys(pkg.dependencies || {}),
        packageManager: existsSync(join(CWD(), 'yarn.lock'))
          ? 'yarn'
          : existsSync(join(CWD(), 'pnpm-lock.yaml'))
            ? 'pnpm'
            : 'npm',
      });
    } catch {
      findings.push({ type: 'Node.js', manifest: 'package.json', error: 'could not parse' });
    }
  }

  // Python
  if (existsSync(join(CWD(), 'requirements.txt'))) {
    findings.push({ type: 'Python', manifest: 'requirements.txt' });
  }
  if (existsSync(join(CWD(), 'pyproject.toml'))) {
    findings.push({ type: 'Python', manifest: 'pyproject.toml' });
  }

  // Rust
  if (existsSync(join(CWD(), 'Cargo.toml'))) {
    findings.push({ type: 'Rust', manifest: 'Cargo.toml' });
  }

  // Go
  if (existsSync(join(CWD(), 'go.mod'))) {
    findings.push({ type: 'Go', manifest: 'go.mod' });
  }

  // Java
  if (existsSync(join(CWD(), 'pom.xml'))) {
    findings.push({ type: 'Java (Maven)', manifest: 'pom.xml' });
  }
  if (existsSync(join(CWD(), 'build.gradle'))) {
    findings.push({ type: 'Java/Kotlin (Gradle)', manifest: 'build.gradle' });
  }

  // Ruby
  if (existsSync(join(CWD(), 'Gemfile'))) {
    findings.push({ type: 'Ruby', manifest: 'Gemfile' });
  }

  // README (any project type)
  let readme = null;
  for (const name of ['README.md', 'readme.md', 'README.txt']) {
    if (existsSync(join(CWD(), name))) {
      const content = readFileSync(join(CWD(), name), 'utf-8');
      readme = content.slice(0, 3000); // cap to avoid bloating context
      break;
    }
  }

  return { findings, readme, hasAnyManifest: findings.length > 0 };
}

/**
 * Builds a readable context string from detectProject() output,
 * for feeding into the AI prompt.
 */
function buildProjectContext() {
  const { findings, readme, hasAnyManifest } = detectProject();

  if (!hasAnyManifest && !readme) {
    return 'No recognizable project manifest (package.json, requirements.txt, etc.) or README found in the current directory.';
  }

  const parts = [];
  for (const f of findings) {
    if (f.type === 'Node.js' && f.scripts) {
      parts.push(
        `Node.js project (${f.packageManager}). package.json scripts: ${JSON.stringify(f.scripts)}. Key dependencies: ${f.dependencies.slice(0, 15).join(', ')}`
      );
    } else {
      parts.push(`${f.type} project detected (${f.manifest})`);
    }
  }
  if (readme) {
    parts.push(`README content (truncated):\n${readme}`);
  }

  return parts.join('\n\n');
}

export { detectProject, buildProjectContext };
