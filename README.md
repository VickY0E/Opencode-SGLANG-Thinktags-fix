# opencode-no-think

Strips thinking/reasoning tags from MiniMax M2.5/M2.7 model output when served via SGLANG, before it renders in the CLI.

When MiniMax M2.5/M2.7 are served through SGLANG, the model emits thinking content as `<think>...</think>` XML tags in the text output. OpenCode's TUI renders these tags as plain text, exposing them to the user. This plugin strips them. When `--reasoning-parser minimax-append-think` is enabled, it additionally emits `<|message|>...<|message_end|>` tags — both formats are stripped.

## The Problem

Running MiniMax M2.5/M2.7 via SGLANG produces visible thinking tags in the OpenCode TUI:

```
<think>Let me think about this...
</think>
The answer is 42.
```

This happens specifically because of the `--reasoning-parser minimax-append-think` flag in the SGLANG server command.

## Install

Add to your opencode config (at `~/.config/opencode/opencode.json` or your workspace config):

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

> **Note:** Opencode resolves plugins via its local package cache, which requires a filesystem path. Git URLs and npm module names are not currently supported as plugin specifiers — use the absolute path to the cloned repo.

### Setup steps

```bash
# 1. Clone the repo somewhere permanent
git clone https://github.com/VickY0E/Opencode-SGLANG-Thinktags-fix.git ~/Opencode-SGLANG-Thinktags-fix

# 2. Add to ~/.config/opencode/opencode.json (see config above)

# 3. Restart opencode
```

After restart, thinking tags will be stripped from MiniMax M2.5/M2.7 SGLANG output in both the CLI and desktop app.

## Verified SGLANG Setup

This plugin was developed against the following SGLANG server command:

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

The `--reasoning-parser minimax-append-think` flag is the trigger. Without it, MiniMax M2.5/M2.7 thinking content may still appear as `<<think>...</think>` XML tags and will also be stripped by this plugin.

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Master toggle |
| `showThinkTokens` | `boolean` | `false` | Print think token count to stderr after each assistant turn |
| `showThinkDuration` | `boolean` | `false` | Print thinking duration to stderr after each assistant turn |
| `tagFormats` | `string[]` | `["xml", "minimax"]` | Which tag formats to strip (`"minimax"` targets `<|message|>` tags) |

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

| Model | Format | Trigger |
|-------|--------|---------|
| MiniMax-M2.5/M2.7 (SGLANG) | XML + MiniMax append-think | `--reasoning-parser minimax-append-think` |
| DeepSeek-R1, Qwen3 | XML | None (standard reasoning output) |
| OpenAI o1/o3 | XML | None (standard reasoning output) |
| Gemini 2.0 Flash (thinking) | XML | None (standard reasoning output) |

Example input:
```
<think>Let me think about this...</think>
The answer is 42.
```

Renders as: `The answer is 42.`
