import { describe, expect, it } from 'vitest';
import fs from 'fs';
import * as babel from '@babel/parser';

describe('i18n dictionary hygiene (AC-21 regression check)', () => {
  it('has zero duplicate keys across all dictionary object literals', () => {
    const content = fs.readFileSync('src/utils/i18n.js', 'utf8');
    const ast = babel.parse(content, { sourceType: 'module' });
    const duplicates = [];

    for (const stmt of ast.program.body) {
      let decls = [];
      if (stmt.type === 'VariableDeclaration') decls = stmt.declarations;
      if (stmt.type === 'ExportNamedDeclaration' && stmt.declaration?.declarations) decls = stmt.declaration.declarations;
      for (const decl of decls) {
        if (decl.init?.type === 'ObjectExpression') {
          const seen = new Set();
          for (const prop of decl.init.properties) {
            if (prop.type === 'ObjectProperty') {
              const k = prop.key.type === 'StringLiteral' ? prop.key.value : prop.key.name;
              if (seen.has(k)) {
                duplicates.push({ dict: decl.id.name, key: k, line: prop.loc.start.line });
              } else {
                seen.add(k);
              }
            }
          }
        }
      }
    }

    expect(duplicates).toEqual([]);
  });
});
