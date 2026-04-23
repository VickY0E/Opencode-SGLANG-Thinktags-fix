import type { PluginInput, Hooks } from '@opencode-ai/plugin';
import type { PluginOptions } from './types.js';
import { stripThinkTags, countThinkTokens } from './strip.js';

const DEFAULT_OPTIONS: Required<PluginOptions> = {
  enabled: true,
  showThinkTokens: false,
  showThinkDuration: false,
  tagFormats: ['xml', 'minimax'],
};

export async function server(
  _input: PluginInput,
  options?: PluginOptions,
): Promise<Hooks> {
  const opts: Required<PluginOptions> = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  if (!opts.enabled) return {};

  return {
    'experimental.text.complete': async (_inp, out) => {
      console.error('[no-think] text.complete hook firing, original length:', out.text.length);
      out.text = stripThinkTags(out.text, opts.tagFormats);
      console.error('[no-think] text.complete done, stripped length:', out.text.length);
    },

    'experimental.chat.messages.transform': async (_inp, out) => {
      for (const msg of out.messages) {
        if (msg.info?.role !== 'assistant') continue;
        for (const part of msg.parts ?? []) {
          if (part.type === 'text' && typeof part.text === 'string') {
            const original = part.text;
            part.text = stripThinkTags(part.text, opts.tagFormats);
            if (original !== part.text) {
              console.error('[no-think] messages.transform stripped tags from part');
            }
          }
        }
      }
    },

    'chat.message': async (_inp, out) => {
      if (!opts.showThinkTokens && !opts.showThinkDuration) return;
      if ((out.message as any).role !== 'assistant') return;

      for (const part of out.parts ?? []) {
        if (part.type !== 'text') continue;
        if (typeof part.text !== 'string') continue;

        if (opts.showThinkTokens) {
          const count = countThinkTokens(part.text, opts.tagFormats);
          if (count > 0) {
            console.error(`[no-think] Think tokens: ${count}`);
          }
        }

        if (opts.showThinkDuration && (part as any)._thinkDuration !== undefined) {
          console.error(`[no-think] Thinking duration: ${(part as any)._thinkDuration}s`);
        }
      }
    },
  };
}
