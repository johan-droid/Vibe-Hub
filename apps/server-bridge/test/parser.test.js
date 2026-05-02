import { describe, it, expect } from 'vitest';
import { extractSymbols } from '../orchestrator/parser.js';

describe('extractSymbols', () => {
  it('extracts function declarations', () => {
    const code = 'function test() {}';
    const symbols = extractSymbols(code);
    expect(symbols).toContainEqual({ name: 'test', kind: 'function' });
  });

  it('extracts class declarations', () => {
    const code = 'class MyClass {}';
    const symbols = extractSymbols(code);
    expect(symbols).toContainEqual({ name: 'MyClass', kind: 'class' });
  });

  it('extracts arrow functions', () => {
    const code = 'const myFunc = () => {};';
    const symbols = extractSymbols(code);
    expect(symbols).toContainEqual({ name: 'myFunc', kind: 'function' });
  });

  it('extracts exports', () => {
    const code = 'export const myVar = 10;';
    const symbols = extractSymbols(code);
    expect(symbols).toContainEqual({ name: 'myVar', kind: 'variable' });
  });

  it('handles mixed content', () => {
    const code = `
      function a() {}
      export class B {}
      const c = (x) => x;
    `;
    const symbols = extractSymbols(code);
    expect(symbols).toHaveLength(3);
    expect(symbols.map(s => s.name)).toEqual(['a', 'B', 'c']);
  });
});
