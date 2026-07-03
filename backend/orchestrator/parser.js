/**
 * Symbol Parser — Brain v4.0 (Scalability Engine)
 * 
 * Uses optimized regex to extract semantic symbols without the overhead
 * of a full AST parser like Babel or TypeScript.
 */
export function extractSymbols(content) {
  const symbols = [];
  
  // 1. Function declarations: function name() { ... }
  const funcRegex = /function\s+([a-zA-Z0-9_$]+)\s*\(/g;
  let match;
  while ((match = funcRegex.exec(content)) !== null) {
    symbols.push({ name: match[1], kind: 'function' });
  }

  // 2. Class declarations: class Name { ... }
  const classRegex = /class\s+([a-zA-Z0-9_$]+)\s*{/g;
  while ((match = classRegex.exec(content)) !== null) {
    symbols.push({ name: match[1], kind: 'class' });
  }

  // 3. Arrow function constants: const name = () => { ... }
  const arrowRegex = /(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:\([^)]*\)|[a-zA-Z0-9_$]+)\s*=>/g;
  while ((match = arrowRegex.exec(content)) !== null) {
    symbols.push({ name: match[1], kind: 'function' });
  }

  // 4. React Components (heuristics): function Component(props) { ... }
  // (Covered by general function regex above)

  // 5. Exports: export const name = ...
  const exportRegex = /export\s+(?:const|let|var|function|class)\s+([a-zA-Z0-9_$]+)/g;
  while ((match = exportRegex.exec(content)) !== null) {
    // Only add if not already added
    if (!symbols.some(s => s.name === match[1])) {
      symbols.push({ name: match[1], kind: 'variable' });
    }
  }

  return symbols;
}
