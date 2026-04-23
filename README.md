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

| Model | Format | Example |
|-------|--------|---------|
| DeepSeek-R1, Qwen3 | XML | `<think>thinking content</think>` |
| MiniMax-M2.5 | append-think | `<|message|>thinking<|message_end|>` |
