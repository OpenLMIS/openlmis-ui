---
name: sync-translations
description: Sync i18next translation files in src/messages/ with en.json as the single source of truth. Removes stale keys, adds missing keys translated into each target language, preserves existing translations, then runs pnpm sort-messages and pnpm tsc --noEmit. Use this skill whenever the user asks to sync, update, translate, or refresh translation files; whenever they add new keys to en.json; whenever they add a new language file and want it populated; or when they say "sync translations", "update language files", "translate new keys", "let's sync the translations", or similar — even if they don't explicitly name the skill or mention i18n.
---

# Sync Translations

This skill keeps i18next translation files in sync with `src/messages/en.json` as the single source of truth.

## When to use

Trigger this skill when:
- The user has edited `src/messages/en.json` and other language files need updating
- The user mentions syncing, updating, translating, or refreshing translations
- The user adds a new language file (e.g. creates an empty `de.json`) and wants it populated
- The user invokes `/sync-translations`

## Core principle

`en.json` is the king. Every other language file in `src/messages/` must match its key set exactly — no stale keys, no missing keys. Existing translations are preserved (never overwritten), so the user can manually tweak a translation and trust that future syncs won't clobber it.

## Procedure

### Step 1: Read the source of truth

Read `src/messages/en.json`. This defines the authoritative key set and the English values that need translating.

### Step 2: Discover target language files

Glob `src/messages/*.json` and exclude `en.json`. The filename (without extension) is the ISO 639-1 language code. Common examples:

| Code | Language |
|---|---|
| `pl` | Polish |
| `de` | German |
| `es` | Spanish |
| `fr` | French |
| `it` | Italian |
| `pt` | Portuguese |
| `nl` | Dutch |
| `sv` | Swedish |
| `cs` | Czech |
| `ja` | Japanese |
| `zh` | Chinese (Simplified) |

Translate using your own knowledge — no external API needed.

### Step 3: Sync each target file

For each target file:

1. Read its current content into a map.
2. Build the new content by iterating over keys in `en.json`:
   - If the key exists in the target file, **copy the existing translation unchanged**.
   - If the key is missing, translate the English value into the target language and add it.
3. Keys only present in the target (stale) are naturally dropped because they're never copied.
4. Write the new content back using the Write tool (full replace is simpler than surgical edits and `sort-messages` will normalize formatting anyway).

### Step 4: Preserve translation-value format

Translation values may contain structural elements that must stay intact. Translate the natural-language portions, not the structure:

- **ICU MessageFormat** — e.g. `{count, plural, one {# item} other {# items}}`. Preserve the `{variable, plural, ...}` scaffolding; translate only the text inside `{...}` branches. Note that non-English plural rules differ — Polish has `one`/`few`/`many`/`other`, Russian has `one`/`few`/`many`, Arabic has `zero`/`one`/`two`/`few`/`many`/`other`. Use the correct categories for the target language.
- **Interpolation placeholders** — e.g. `Hello {{name}}` or `{name}`. Preserve the placeholder exactly; translate surrounding text only.
- **HTML/JSX tags** (from `<Trans>` components) — e.g. `Read the <1>docs</1>`. Preserve tags exactly.

### Step 5: Sort and verify

After all target files are updated, run:

```bash
pnpm sort-messages
```

This sorts keys alphabetically across all files in `src/messages/`.

Then verify type safety:

```bash
pnpm tsc --noEmit
```

The `src/types/i18next.d.ts` file imports `en.json` to type-augment i18next's `t()` function. If typecheck fails, it usually means a `t()` call in the code references a key that was just removed from `en.json`. Surface the error to the user; don't try to fix it by re-adding the key — the stale reference in the code is the real bug.

## Example

**`en.json` (current):**
```json
{
  "dashboard.title": "Dashboard",
  "users.count": "{count, plural, one {# user} other {# users}}",
  "users.title": "Users"
}
```

**`pl.json` (before):**
```json
{
  "dashboard.title": "Panel",
  "old.deprecated.key": "Stara wartość"
}
```

**`pl.json` (after):**
```json
{
  "dashboard.title": "Panel",
  "users.count": "{count, plural, one {# użytkownik} few {# użytkowników} many {# użytkowników} other {# użytkowników}}",
  "users.title": "Użytkownicy"
}
```

What happened:
- `dashboard.title` — preserved (translation already existed)
- `users.title` — added, translated
- `users.count` — added; ICU structure preserved, text translated, Polish plural categories (`one`/`few`/`many`/`other`) used correctly
- `old.deprecated.key` — removed (not in `en.json`)

## Notes

- **Don't touch `en.json`.** It's the source; this skill only modifies other language files.
- **Don't bulk-retranslate.** The preservation rule is a feature, not a limitation — it respects manual tweaks.
- **The pre-commit hook runs `sort-messages` too**, but running it here keeps the diff clean and catches issues before committing.
- **Empty or brand-new language files** (e.g. user just created `de.json` with `{}`) are handled correctly — every key will be added via translation.
