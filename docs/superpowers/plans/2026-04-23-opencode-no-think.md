# opencode-no-think Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an OpenCode server plugin that strips `<think>...</think>` and `<|message|>...<|message_end|>` thinking tags from LLM output before they render in the CLI.

**Architecture:** The plugin is a thin, pure-function core (`strip.ts`) wrapped by an OpenCode plugin entry (`plugin.ts`). The core stripping logic has zero OpenCode dependencies, making it testable and portable. The plugin registers two hooks: `experimental.text.complete` for live display stripping, and `experimental.chat.messages.transform` as a fallback for session compaction.

**Tech Stack:** TypeScript, `vitest` for unit tests, `@opencode-ai/plugin` for type definitions only.

---

## File Structure

```
opencode-no-think/
├── docs/superpowers/plans/2026-04-23-opencode-no-think.md   # This file
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .npmignore
└── src/
    ├── plugin.ts          # Plugin entry — registers hooks, reads config
    ├── types.ts           # Shared TypeScript types (PluginOptions, Hooks)
    └── strip.ts           # Core stripping logic (no OpenCode deps)
    └── strip.test.ts      # Unit tests for strip.ts
```

---

## Task 1: Initialize project scaffolding

**Files:**
- Create: `opencode-no-think/package.json`
- Create: `opencode-no-think/tsconfig.json`
- Create: `opencode-no-think/vitest.config.ts`
- Create: `opencode-no-think/.npmignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "opencode-plugin-no-think",
  "version": "0.1.0",
  "description": "Strip thinking/reasoning tags from LLM output in OpenCode",
  "type": "module",
  "main": "src/plugin.ts",
  "exports": {
    ".": "./src/plugin.ts"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@opencode-ai/plugin": "^0.1.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0",
    "tsx": "^4.19.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "noUncheckedIndexedAccess": true,
    "outDir": "dist"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    globals: true,
    environment: 'node',
    reporter: ['verbose'],
  },
});
```

- [ ] **Step 4: Create `.npmignore`**

```
src/**/*.test.ts
vitest.config.ts
*.tsbuildinfo
```

- [ ] **Step 5: Commit**

```bash
cd /home/claw/opencode-no-think
git init
git add package.json tsconfig.json vitest.config.ts .npmignore
git commit -m "chore: scaffold project with TypeScript and vitest"
```

---

## Task 2: Implement `src/types.ts`

**Files:**
- Create: `opencode-no-think/src/types.ts`

- [ ] **Step 1: Write the type definitions**

```ts
export interface PluginOptions {
  enabled?: boolean;
  showThinkTokens?: boolean;
  showThinkDuration?: boolean;
  tagFormats?: Array<'xml' | 'minimax'>;
}

export interface TextCompleteInput {
  sessionID: string;
  messageID: string;
  partID: string;
}

export interface TextCompleteOutput {
  text: string;
}

export interface MessageInfo {
  role?: string;
}

export interface Part {
  type: string;
  text?: string;
  [key: string]: unknown;
}

export interface Message {
  info?: MessageInfo;
  parts?: Part[];
}

export interface MessagesTransformInput {
  // empty object, all input is via output
}

export interface MessagesTransformOutput {
  messages: Message[];
}

export type StripFn = (text: string, tagFormats: Array<'xml' | 'minimax'>) => string;
export type CountTokensFn = (text: string, tagFormats: Array<'xml' | 'minimax'>) => number;
```

- [ ] **Step 2: Commit**

```bash
cd /home/claw/opencode-no-think
git add src/types.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 3: Implement `src/strip.ts` (core logic, TDD)

**Files:**
- Create: `opencode-no-think/src/strip.ts`
- Create: `opencode-no-think/src/strip.test.ts`

- [ ] **Step 1: Write the failing tests in `src/strip.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { stripThinkTags, countThinkTokens } from './strip.js';

describe('stripThinkTags', () => {
  it('strips basic XML think tags', () => {
    expect(stripThinkTags('<think>thinking content</think> answer')).toBe('answer');
  });

  it('strips XML think tags with nested think content', () => {
    expect(stripThinkTags('<think>thinking</think></think> answer')).toBe('answer');
  });

  it('strips basic MiniMax append-think tags', () => {
    expect(stripThinkTags('<|message|>thinking<|message_end|> answer')).toBe('answer');
  });

  it('passes through text with no tags', () => {
    expect(stripThinkTags('plain text')).toBe('plain text');
  });

  it('returns empty string when entire text is think content', () => {
    expect(stripThinkTags('<think>onlythink</think>')).toBe('');
  });

  it('does NOT strip partial unclosed XML start tag', () => {
    expect(stripThinkTags('<think>incomplete answer')).toBe('<think>incomplete answer');
  });

  it('does NOT strip partial unclosed XML end tag', () => {
    expect(stripThinkTags('complete</think> answer')).toBe('complete</think> answer');
  });

  it('normalizes whitespace after stripping', () => {
    expect(stripThinkTags('<think>  think </think>   answer')).toBe('answer');
  });
});

describe('countThinkTokens', () => {
  it('returns 0 for text with no tags', () => {
    expect(countThinkTokens('plain text')).toBe(0);
  });

  it('counts characters in XML think blocks divided by 4', () => {
    const text = '<think>hello world</think> answer';
    const thinkBlock = '<think>hello world</think>';
    expect(countThinkTokens(text)).toBe(Math.ceil(thinkBlock.length / 4));
  });

  it('counts characters in MiniMax think blocks divided by 4', () => {
    const text = '<|message|>hello world<|message_end|> answer';
    const thinkBlock = '<|message|>hello world<|message_end|>';
    expect(countThinkTokens(text)).toBe(Math.ceil(thinkBlock.length / 4));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/claw/opencode-no-think && npx vitest run src/strip.test.ts`
Expected: FAIL — "stripThinkTags is not a function" or similar import error

- [ ] **Step 3: Write minimal `strip.ts` with regex patterns**

```ts
// Note: the spec's pattern `<thon` is a typo — it won't match `<think>` (the k/s are missing).
// The correct opening tag is `<think>` (6 chars). We implement the correct pattern.
const XML_PATTERN = new RegExp('<think>[\\s\\S]*?<\\/think>\\s*', 'g');

const MINIMAX_PATTERN = new RegExp('<\\x7Cmessage\\x7E[\\s\\S]*?<\\x7Cmessage_end\\x7E\\s*', 'g');
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/claw/opencode-no-think && npx vitest run src/strip.test.ts`
Expected: PASS — all 11 tests green

- [ ] **Step 5: Verify the regex patterns are correct by checking against spec examples**

The spec's example pattern shows:
```
XML_PATTERN = new RegExp('<thon[\\s\\S]*?<\\/think>\\s*', 'g')
```
Note: the spec has a typo where `<think>` is written as `<thon` (missing `k` and `s`). The correct pattern should match `<<think>` and `<think>` respectively.

Confirm by running:
```bash
node -e "const p = new RegExp('<think>[\\s\\S]*?<\\/think>\\s*', 'g'); console.log(p.test('<think>x</think>'))"
```
Should print `true`.

Also confirm the MiniMax pattern:
```bash
node -e "const p = new RegExp('<\\x7Cmessage\\x7E[\\s\\S]*?<\\x7Cmessage_end\\x7E\\s*', 'g'); console.log(p.test('<|message|>x<|message_end|>'))"
```
Should print `true`.

- [ ] **Step 6: Commit**

```bash
cd /home/claw/opencode-no-think
git add src/strip.ts src/strip.test.ts
git commit -m "feat: implement core stripping logic with TDD
- stripThinkTags removes XML and MiniMax thinking tags
- countThinkTokens estimates thinking token count
- Uses RegExp constructor (not literals) for Node.js compatibility"
```

---

## Task 4: Implement `src/plugin.ts`

**Files:**
- Create: `opencode-no-think/src/plugin.ts`

- [ ] **Step 1: Write the plugin entry point**

```ts
import type { PluginInput } from '@opencode-ai/plugin';
import type { PluginOptions } from './types.js';
import { stripThinkTags, countThinkTokens } from './strip.js';

const DEFAULT_OPTIONS: PluginOptions = {
  enabled: true,
  showThinkTokens: false,
  showThinkDuration: false,
  tagFormats: ['xml', 'minimax'],
};

export function server(input: PluginInput) {
  const options: PluginOptions = {
    ...DEFAULT_OPTIONS,
    ...input.config,
  };

  if (!options.enabled) return;

  input.hooks.on('experimental.text.complete', async (inp, out) => {
    out.text = stripThinkTags(out.text, options.tagFormats ?? DEFAULT_OPTIONS.tagFormats!);
  });

  input.hooks.on('experimental.chat.messages.transform', async (_inp, out) => {
    const tagFormats = options.tagFormats ?? DEFAULT_OPTIONS.tagFormats!;

    for (const msg of out.messages) {
      if (msg.info?.role !== 'assistant') continue;
      for (const part of msg.parts ?? []) {
        if (part.type === 'text' && typeof part.text === 'string') {
          part.text = stripThinkTags(part.text, tagFormats);
        }
      }
    }
  });

  input.hooks.on('chat.message', async (_inp, out) => {
    if (!options.showThinkTokens && !options.showThinkDuration) return;
    if (out.info?.role !== 'assistant') return;

    for (const part of out.parts ?? []) {
      if (part.type !== 'text') continue;
      if (typeof part.text !== 'string') continue;

      const tagFormats = options.tagFormats ?? DEFAULT_OPTIONS.tagFormats!;

      if (options.showThinkTokens) {
        const count = countThinkTokens(part.text, tagFormats);
        if (count > 0) {
          console.error(`[no-think] Think tokens: ${count}`);
        }
      }

      if (options.showThinkDuration && part._thinkDuration !== undefined) {
        console.error(`[no-think] Thinking duration: ${part._thinkDuration}s`);
      }
    }
  });
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `cd /home/claw/opencode-no-think && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd /home/claw/opencode-no-think
git add src/plugin.ts
git commit -m "feat: wire plugin entry point with hooks
- Registers experimental.text.complete and experimental.chat.messages.transform
- Reads config from PluginInput, applies defaults
- showThinkTokens and showThinkDuration via chat.message hook"
```

---

## Task 5: Final verification and typecheck

**Files modified:** none new

- [ ] **Step 1: Run typecheck**

Run: `cd /home/claw/opencode-no-think && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run tests**

Run: `cd /home/claw/opencode-no-think && npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Final commit**

```bash
cd /home/claw/opencode-no-think
git add -A
git commit -m "feat: opencode-no-think plugin ready
- Strips XML and MiniMax thinking tags from LLM output
- Two hooks: experimental.text.complete + experimental.chat.messages.transform
- Configurable via opencode.json plugin options"
```

---

## Verification commands (manual, run after implementation)

**Integration test:**
```bash
opencode run "Explain why 13 is prime" --model sglang/MiniMax-M2.5
# Expected: clean answer, no <think> or </think> in output
```

**Session compaction test:**
```bash
opencode chat "Solve this logic puzzle: ..." --model sglang/MiniMax-M2.5
# Let session compact (after ~20+ messages)
# Verify history shows no thinking tags
```
