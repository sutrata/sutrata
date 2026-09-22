import { describe, it, expect } from 'vitest';
import { parseVoiceCommand } from '../src/ai/commands';

describe('Voice Commands Pre-processor', () => {
  it('should parse English commands correctly', () => {
    const result1 = parseVoiceCommand('new scene INT. HALLWAYS - DAY', 'en-US');
    expect(result1.type).toBe('scene');
    expect(result1.text).toBe('INT. HALLWAYS - DAY');
    expect(result1.isLiteral).toBe(false);

    const result2 = parseVoiceCommand('character RAJ', 'en-US');
    expect(result2.type).toBe('character');
    expect(result2.text).toBe('RAJ');

    const result3 = parseVoiceCommand('dialogue Hello world', 'en-US');
    expect(result3.type).toBe('dialogue');
    expect(result3.text).toBe('Hello world');
  });

  it('should parse Hindi commands correctly', () => {
    const result1 = parseVoiceCommand('नया दृश्य अंतःपुर - दिन', 'hi-IN');
    expect(result1.type).toBe('scene');
    expect(result1.text).toBe('अंतःपुर - दिन');

    const result2 = parseVoiceCommand('पात्र राहुल', 'hi-IN');
    expect(result2.type).toBe('character');
    expect(result2.text).toBe('राहुल');
  });

  it('should parse Tamil commands correctly', () => {
    const result1 = parseVoiceCommand('புதிய காட்சி தெரு - பகல்', 'ta-IN');
    expect(result1.type).toBe('scene');
    expect(result1.text).toBe('தெரு - பகல்');

    const result2 = parseVoiceCommand('வசனம் வணக்கம் உலகமே', 'ta-IN');
    expect(result2.type).toBe('dialogue');
    expect(result2.text).toBe('வணக்கம் உலகமே');
  });

  it('should handle literal bypass keyword to escape commands', () => {
    const result1 = parseVoiceCommand('literal new scene heading', 'en-US');
    expect(result1.type).toBe('action');
    expect(result1.text).toBe('new scene heading');
    expect(result1.isLiteral).toBe(true);

    const result2 = parseVoiceCommand('शब्दशः नया दृश्य', 'hi-IN');
    expect(result2.type).toBe('action');
    expect(result2.text).toBe('नया दृश्य');
    expect(result2.isLiteral).toBe(true);
  });

  it('should default to action type for plain speech', () => {
    const result = parseVoiceCommand('The sun rises slowly over the mountains.', 'en-US');
    expect(result.type).toBe('action');
    expect(result.text).toBe('The sun rises slowly over the mountains.');
    expect(result.isLiteral).toBe(false);
  });
});
