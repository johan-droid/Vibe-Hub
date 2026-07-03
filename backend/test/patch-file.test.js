import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  applyFuzzyPatchFile,
  findBestFuzzyBlock,
  PatchFileError,
} from '../orchestrator/patch-file.js';

describe('patch_file fuzzy backend', () => {
  let rootDir;

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'selina-patch-file-'));
  });

  afterEach(async () => {
    await fs.rm(rootDir, { recursive: true, force: true });
  });

  it('applies a unique exact search-and-replace without line numbers', async () => {
    await fs.writeFile(path.join(rootDir, 'example.js'), [
      'const before = true;',
      'function target() {',
      '  return "old";',
      '}',
      'const after = true;',
      '',
    ].join('\n'));

    const result = await applyFuzzyPatchFile({
      rootDir,
      path: 'example.js',
      search_content: 'function target() {\n  return "old";\n}',
      replace_content: 'function target() {\n  return "new";\n}',
    });

    await expect(fs.readFile(path.join(rootDir, 'example.js'), 'utf-8')).resolves.toContain('return "new";');
    expect(result).toMatchObject({
      success: true,
      path: 'example.js',
      startLine: 2,
      endLine: 4,
      exact: true,
    });
  });

  it('finds a near-match when whitespace differs from the file', async () => {
    await fs.writeFile(path.join(rootDir, 'math.js'), [
      'export function sum(a, b) {',
      '  const result = a + b;',
      '  return result;',
      '}',
      '',
    ].join('\n'));

    const result = await applyFuzzyPatchFile({
      rootDir,
      path: 'math.js',
      search_content: 'export function sum(a,b) {\n const result = a + b;\n return result;\n}',
      replace_content: 'export function sum(a, b) {\n  return a + b;\n}',
    });

    await expect(fs.readFile(path.join(rootDir, 'math.js'), 'utf-8')).resolves.toBe('export function sum(a, b) {\n  return a + b;\n}\n');
    expect(result.exact).toBe(false);
    expect(result.score).toBeGreaterThanOrEqual(0.78);
  });

  it('rejects ambiguous matches instead of guessing', () => {
    const content = [
      'function same() {',
      '  return 1;',
      '}',
      'function same() {',
      '  return 1;',
      '}',
    ].join('\n');

    expect(() => findBestFuzzyBlock(content, 'function same() {\n  return 1;\n}'))
      .toThrow(PatchFileError);
    expect(() => findBestFuzzyBlock(content, 'function same() {\n  return 1;\n}'))
      .toThrow(/multiple exact blocks/);
  });

  it('rejects paths outside the workspace root', async () => {
    await expect(applyFuzzyPatchFile({
      rootDir,
      path: '../escape.js',
      search_content: 'old',
      replace_content: 'new',
    })).rejects.toMatchObject({ code: 'PATCH_PATH_ESCAPE' });
  });
});
