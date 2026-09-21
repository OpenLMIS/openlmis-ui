/**
 * Sorts translation keys alphabetically in all JSON files under public/locales/.
 * Run manually: pnpm sort-messages
 * Also runs automatically on pre-commit via lefthook.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const messagesDir = join(import.meta.dirname, '..', 'public', 'locales');
const files = readdirSync(messagesDir).filter((f) => f.endsWith('.json'));

let hasChanges = false;

for (const file of files) {
  const filePath = join(messagesDir, file);
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw);

  const sorted = Object.keys(parsed)
    .sort()
    .reduce((acc, key) => {
      acc[key] = parsed[key];
      return acc;
    }, {});

  const output = `${JSON.stringify(sorted, null, 2)}\n`;

  if (raw !== output) {
    writeFileSync(filePath, output, 'utf-8');
    console.log(`Sorted: ${file}`);
    hasChanges = true;
  }
}

if (!hasChanges) {
  console.log('All message files are already sorted.');
}
