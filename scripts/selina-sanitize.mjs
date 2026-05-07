import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const TARGET_DIRS = [
  'apps/user-interface/src',
  'apps/server-bridge',
];

const SOURCE_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.css',
  '.html',
]);

const EXCLUDED_SEGMENTS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  'scratch',
  'test',
  'tests',
  '__tests__',
  '__mocks__',
]);

const EXCLUDED_FILE_PATTERNS = [
  /\.test\.[cm]?[jt]sx?$/i,
  /\.spec\.[cm]?[jt]sx?$/i,
  /package-lock\.json$/i,
  /vite\.config\.js$/i,
  /playwright\.config\.js$/i,
];

const CHECKS = [
  {
    id: 'placeholder-anchor',
    severity: 'error',
    pattern: /href=["']#["']/i,
    message: 'Replace inert href="#" links with a real route, section anchor, or button action.',
  },
  {
    id: 'local-contact',
    severity: 'error',
    pattern: /mailto:[^"'\s]*\.local\b|[\w.-]+@[\w.-]+\.local\b/i,
    message: 'Replace .local contact emails with a real support path or repository issue URL.',
  },
  {
    id: 'fake-public-metric',
    severity: 'error',
    pattern: /\b(50K\+|2M\+|99\.9%|4\.9\/5)\b/i,
    message: 'Remove unverified public metrics from production UI.',
  },
  {
    id: 'invented-testimonial',
    severity: 'error',
    pattern: /\b(Sarah Chen|Marcus Johnson|Elena Rodriguez|TechCorp|StartupXYZ)\b/i,
    message: 'Remove invented testimonials, names, and customer logos from production UI.',
  },
  {
    id: 'placeholder-service',
    severity: 'error',
    pattern: /\b(cdn\.example\.com|pollinations\.ai|placeholder service|getMockVariants|mockUrl)\b/i,
    message: 'Do not return external placeholder services or mock fallbacks from production code.',
  },
  {
    id: 'dummy-language',
    severity: 'error',
    pattern: /\b(dummy|lorem ipsum|fake implementation|coming soon)\b/i,
    message: 'Remove dummy/demo language from production source.',
  },
  {
    id: 'todo-stub',
    severity: 'error',
    pattern: /\b(TODO|FIXME)\b/i,
    message: 'Resolve TODO/FIXME stubs before production release or move them to tracked issues/docs.',
  },
];

function relativePath(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function shouldSkip(filePath) {
  const relative = relativePath(filePath);
  const segments = relative.split('/');
  if (segments.some(segment => EXCLUDED_SEGMENTS.has(segment))) return true;
  return EXCLUDED_FILE_PATTERNS.some(pattern => pattern.test(relative));
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (shouldSkip(fullPath)) continue;

    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }

    if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  const findings = [];

  lines.forEach((line, index) => {
    for (const check of CHECKS) {
      if (check.pattern.test(line)) {
        findings.push({
          ...check,
          file: relativePath(filePath),
          line: index + 1,
          source: line.trim().slice(0, 220),
        });
      }
    }
  });

  return findings;
}

const files = TARGET_DIRS.flatMap(dir => walk(path.join(ROOT, dir)));
const findings = files.flatMap(scanFile);

if (findings.length > 0) {
  console.error('\n[selina-sanitize] Production sanitation failed.\n');
  for (const finding of findings) {
    console.error(`[${finding.severity}] ${finding.id} ${finding.file}:${finding.line}`);
    console.error(`  ${finding.message}`);
    console.error(`  ${finding.source}\n`);
  }
  process.exit(1);
}

console.log(`[selina-sanitize] Checked ${files.length} production source files. No dummy placeholders found.`);
