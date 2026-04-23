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
