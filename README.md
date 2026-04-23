# opencode-no-think

Strips thinking/reasoning tags from LLM output before it renders in the CLI.

Models like MiniMax-M2.5, DeepSeek-R1, and Qwen3 emit thinking content as `<think>...</think>` or `<|message|>...<|message_end|>` tags. OpenCode's TUI renders these as plain text, exposing the tags to the user. This plugin hides them.

## Install

Add to your `opencode.json` plugin config:

```json
{
  "plugin": [
    ["opencode-no-think", {
      "enabled": true
    }]
  ]
}
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Master toggle |
| `showThinkTokens` | `boolean` | `false` | Print think token count to stderr after each assistant turn |
| `showThinkDuration` | `boolean` | `false` | Print thinking duration to stderr after each assistant turn |
| `tagFormats` | `string[]` | `["xml", "minimax"]` | Which tag formats to strip |

## Develop

```bash
npm install
npm test          # 11 tests
npm run typecheck  # TypeScript
```

## How it works

The plugin registers two OpenCode hooks:

- `experimental.text.complete` — strips tags from each text chunk before TUI render
- `experimental.chat.messages.transform` — strips tags from session history during compaction

The core stripping logic (`src/strip.ts`) has zero OpenCode dependencies — it's a pure function library that can be tested independently.

## Verified patterns

All verified reasoning models emit thinking content as `<think>...</think>` tags in the text output. The plugin strips these universally.

| Model | Format | Notes |
|-------|--------|-------|
| MiniMax-M2.5 | XML | Thinking embedded as `<think>...</think>` in content field |
| DeepSeek-R1, Qwen3 | XML | Thinking embedded as `<think>...</think>` |
| OpenAI o1/o3 | XML | Thinking embedded as `<think>...</think>` |
| Gemini 2.0 Flash (thinking) | XML | Thinking embedded as `<think>...</think>` |

Example input:
```
<think>Let me think about this...</think>
The answer is 42.
```

Renders as: `The answer is 42.`
