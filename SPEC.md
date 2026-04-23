# opencode-plugin-no-think — Specification

## 1. Overview

**Plugin name:** `opencode-no-think`  
**What it does:** Strips thinking/reasoning tags (`<think>...</think>` and `<|message|>...<|message_end|>`) from LLM output before it renders in the CLI. The model still generates thinking content — it just doesn't appear on screen.

**Why it exists:** When MiniMax M2.5/M2.7 models are served through SGLANG, the model emits thinking content as `<think>...</think>` XML tags in its text output. OpenCode's TUI renders these tags as plain text, exposing them to the user. This plugin strips both the standard XML format and, when `--reasoning-parser minimax-append-think` is enabled, the additional `<|message|>...<|message_end|>` format.

**Plugin type:** OpenCode server plugin (exports `server` function, receives `PluginInput`)

---

## 2. Behaviour

### 2.1 Master toggle

The plugin is fully opt-out. Default behaviour is to strip tags. No configuration required unless you want to disable it.

### 2.2 Stripped content

Two tag formats are stripped:

| Format | Start token | End token | Example | Trigger |
|--------|-----------|-----------|---------|---------|
| XML (standard) | `<think>` | `</think>` | `<think>think content</think>` | Always (MiniMax M2.5/M2.7 via SGLANG) |
| MiniMax append-think | `<\|message\|>` | `<\|message_end\|>` | `<\|message\|>thinking<\|message_end\|>` | `--reasoning-parser minimax-append-think` in SGLANG |

After stripping, surrounding whitespace is normalized (leading/trailing whitespace from tags is removed).

### 2.3 What is NOT stripped

- Tool call definitions / function schemas
- System prompts
- User messages
- Error messages
- Content in non-text parts (images, audio, etc.)

### 2.4 Interaction with thinking duration

Some models support returning thinking duration metadata. The plugin does NOT suppress this metadata. If the model outputs thinking duration as part of the text content (e.g. `(spent 2.3s thinking)`), those tokens remain visible. Stripping only removes the tagged reasoning blocks themselves.

---

## 3. Hooks

### 3.1 Primary hook — `experimental.text.complete`

**Fires:** After each text part completes, before TUI renders it.  
**Mutation:** `output.text` (in-place modification, mutable)

```ts
"experimental.text.complete": async (
  input: { sessionID: string; messageID: string; partID: string },
  output: { text: string }
) => {
  output.text = stripThinkTags(output.text);
}
```

This is the preferred hook because it intercepts text at the per-chunk level, after completion, before any downstream rendering.

### 3.2 Fallback hook — `experimental.chat.messages.transform`

**Fires:** On the full messages array during compaction and session save.  
**Mutation:** `output.messages[].parts[].text` for assistant role messages

```ts
"experimental.chat.messages.transform": async (
  input: {},
  output: { messages: Array<{ info: Message; parts: Part[] }> }
) => {
  for (const msg of output.messages) {
    if (msg.info?.role !== 'assistant') continue;
    for (const part of msg.parts || []) {
      if (part.type === 'text' && typeof part.text === 'string') {
        part.text = stripThinkTags(part.text);
      }
    }
  }
}
```

This hook guards against cases where thinking content survives into session compaction (which bypasses `experimental.text.complete`).

### 3.3 Non-applicable hooks

The following hooks were considered but are not appropriate:

| Hook | Reason not used |
|------|----------------|
| `chat.message` | Fires before text is complete; may double-strip if `experimental.text.complete` also fires |
| `chat.params` | Operates on request parameters, not response content |
| `chat.headers` | Operates on HTTP headers, not response content |
| `tool.execute.before/after` | Operates on tool call data, not model output |

---

## 4. Configuration

Configuration is passed as a tuple in `opencode.json`:

```json
{
  "plugin": [
    "superpowers@git+https://github.com/obra/superpowers.git",
    ["/path/to/Opencode-SGLANG-Thinktags-fix", {
      "enabled": true,
      "showThinkTokens": false,
      "showThinkDuration": false,
      "tagFormats": ["xml", "minimax"]
    }]
  ]
}
```

Opencode resolves plugins from its local package cache, which requires a filesystem path. Git URLs and npm module names are not currently supported as plugin specifiers.

### 4.1 Verified SGLANG server command

This plugin was developed against the following SGLANG server invocation:

```bash
python3 -m sglang.launch_server \
        --model lukealonso/MiniMax-M2.7-NVFP4 \
        --served-model-name MiniMax-M2.5 \
        --host 0.0.0.0 \
        --port 8000 \
        --tensor-parallel-size 2 \
        --quantization modelopt_fp4 \
        --trust-remote-code \
        --reasoning-parser minimax-append-think \
        --tool-call-parser minimax-m2 \
        --moe-runner-backend flashinfer_cutlass \
        --attention-backend flashinfer \
        --kv-cache-dtype fp8_e5m2 \
        --max-running-requests 16 \
        --mem-fraction-static 0.94 \
        --chunked-prefill-size 16384
```

The `--reasoning-parser minimax-append-think` flag is the trigger for the `<|message|>` tag format.

### 4.2 Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Master toggle. `false` installs no hooks. |
| `showThinkTokens` | `boolean` | `false` | After each assistant turn, print thinking token count to stderr |
| `showThinkDuration` | `boolean` | `false` | After each assistant turn, print thinking duration to stderr |
| `tagFormats` | `string[]` | `["xml", "minimax"]` | Which tag formats to strip. Can be a subset. |

### 4.3 Notes

- Configuration is optional. The plugin works with zero config.
- `showThinkTokens` and `showThinkDuration` require the model to include those fields in its response (model-dependent). The plugin reads them from the last assistant message in the session. If not present, the display is silently skipped.
- Disabling individual tag formats is useful if a model uses a custom tag format that the plugin should preserve.

---

## 5. Core stripping logic

### 5.1 `stripThinkTags(text: string): string`

**Input:** Raw text that may contain thinking tags  
**Output:** Text with thinking blocks removed, whitespace normalized

**Algorithm:**
1. For each configured tag format, apply the corresponding regex with `g` (global) flag
2. Replace all matches with empty string
3. After all formats are processed, trim leading whitespace from the start and trailing whitespace from the end
4. Return the cleaned text

**Regex patterns (using `new RegExp()` constructor to avoid Node.js v22.22.2 regex literal parsing quirks):**

```ts
// XML format: <think>...</think>
XML_PATTERN = new RegExp('onson[\\s\\S]*?<\\/think>\\s*', 'g')

// MiniMax append-think: <|message|>...<|message_end|>
MINIMAX_PATTERN = new RegExp('<\\x7Cmessage\\x7E[\\s\\S]*?<\\x7Cmessage_end\\x7E\\s*', 'g')
```

Note: `<|message|>` is rendered as `<|message|>` in this spec. The actual token uses a pipe character (`|`, ASCII 0x7C) — not the Unicode U+007C vertical line that Markdown renders as `|`.

**Edge cases:**
- Overlapping tags: not possible with non-greedy quantifier (`*?`)
- Unclosed tags: if `<<think>` appears without a closing `</think>`, the tag is **not** stripped (partial tags are preserved)
- Nested thinking: if thinking content itself contains thinking tags (rare), the outer tags are stripped and the inner content is preserved
- Empty text after stripping: if the entire text was thinking and `stripThinkTags` returns empty string, the hook returns the empty string — opencode handles empty content gracefully

### 5.2 `countThinkTokens(text: string): number`

**Input:** Raw text before stripping  
**Output:** Estimated thinking token count

Uses the same regex patterns to extract thinking blocks, returns their total character length divided by 4 (rough estimate; exact count requires model tokenizer). Used only for `showThinkTokens` display.

---

## 6. File structure

```
opencode-no-think/
├── SPEC.md                     # This file
├── README.md                   # User-facing documentation
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .npmignore
└── src/
    ├── plugin.ts               # Plugin entry point (server export)
    ├── types.ts                 # Shared TypeScript types
    └── strip.ts                # Core stripping logic (no opencode deps)
    └── strip.test.ts           # Unit tests
```

---

## 7. Dependencies

- `@opencode-ai/plugin` — for `PluginInput` and `Hooks` types only
- `typescript` — dev dependency

No runtime dependencies beyond what opencode provides. The `strip.ts` module is intentionally framework-agnostic.

---

## 8. Interaction with other plugins

This plugin is safe to run alongside any other plugin, including `superpowers`. Hooks modify `output.text` in-place and do not interfere with other plugins' hooks.

The stripping is idempotent — running it twice produces the same result as running it once.

Order in the `plugin` array does not matter; hooks are triggered by name, not by plugin order.

---

## 9. Verification

### 9.1 Unit test — `strip.ts`

```ts
// Basic XML stripping
stripThinkTags("<think>thinking content</think> answer") → "answer"
stripThinkTags("<think>thinking</think></think> answer") → "answer"  // nested: inner preserved

// MiniMax format stripping
stripThinkTags("<|message|>thinking<|message_end|> answer") → "answer"

// No tags — passthrough
stripThinkTags("plain text") → "plain text"

// Empty after stripping
stripThinkTags("<think>onlythink</think>") → ""  // empty string returned

// Partial tags — NOT stripped
stripThinkTags("<think>incomplete answer") → "<think>incomplete answer"
stripThinkTags("complete</think> answer") → "complete</think> answer"

// Whitespace normalization
stripThinkTags("<think>  think </think>   answer") → "answer"
```

Run with: `npm test`

### 9.2 Integration test

Run a prompt that triggers thinking and verify no tags appear:

```bash
opencode run "Explain why 13 is prime" -m sglang/MiniMax-M2.5
# Expected: clean answer, no <think> or </think> in output
```

### 9.3 Session compaction test

```bash
opencode chat "Solve this logic puzzle: ..." -m sglang/MiniMax-M2.5
# Let the session compact (after ~20+ messages)
# Verify history shows no thinking tags
```

---

## 10. Open questions / future work

1. **Server-side fix (separate issue):** The root cause is that `@ai-sdk/openai-compatible` treats MiniMax reasoning as plain text (`reasoning_content: null`). A proper fix would be upstream in the SDK or in SGLANG's `MiniMaxAppendThinkDetector`. This plugin is a display-layer workaround only.

2. **Per-model configuration:** Currently the plugin applies universally. If a user has both reasoning and non-reasoning models, tags from non-reasoning models would trigger unnecessary stripping. Hooks don't expose the model ID at text-complete time, so per-model filtering isn't possible with the current API.

3. **Custom tag formats:** If a model uses a non-standard tag format, users can add patterns via `tagFormats`. Adding a new format requires a plugin code change (no runtime config for regex patterns).

4. **Streaming correctness:** `experimental.text.complete` fires after each chunk completes, so in streaming mode the user briefly sees thinking tags before the hook strips them on the next tick. This is a cosmetic artifact of streaming; the final displayed output is clean.
