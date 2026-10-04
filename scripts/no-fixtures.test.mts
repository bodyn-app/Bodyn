// The site is public: anything the app imports is published. This keeps personal health data (the Node-only
// fixtures and the raw export) out of the bundle even if the ESLint rule were switched off.
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const SRC = path.resolve(import.meta.dirname, '../src');
const files = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'fixtures' ? [] : files(p);
    return /\.(tsx?|jsx?)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });

describe('app bundle sources', () => {
  it('never import personal health data files', () => {
    const offenders = files(SRC).filter((f) => /(from|import|require\()\s*['"][^'"]*data\/(fixtures|raw|tmp)\//.test(fs.readFileSync(f, 'utf8')));
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });
});
