import { describe, expect, it } from 'vitest';
import {
  BACKGROUND_OPTIONS,
  canUseSelectedAiProvider,
  getBackgroundByName,
  resolveStartingEquipment,
  toItemTemplateInput,
} from './characterCreationOptions';

describe('characterCreationOptions', () => {
  it('includes common 5e backgrounds with Folk Hero as a selectable option', () => {
    expect(BACKGROUND_OPTIONS.map((background) => background.name)).toContain('Folk Hero');
    expect(getBackgroundByName('folk hero')?.name).toBe('Folk Hero');
  });

  it('resolves starter equipment to canonical item names from class and background defaults', () => {
    const equipment = resolveStartingEquipment({
      characterClass: 'Fighter',
      background: 'Folk Hero',
      selectedClassItems: ['longsword', 'shield'],
      selectedBackgroundItems: ['shovel'],
    });

    expect(equipment.items).toEqual(['Longsword', 'Shield', 'Shovel']);
    expect(equipment.gold).toBeGreaterThan(0);
  });

  it('builds MCP item template inputs from local DnD item data', () => {
    expect(toItemTemplateInput('Longsword')).toMatchObject({
      name: 'Longsword',
      type: 'weapon',
      weight: 3,
      value: 15,
    });
    expect(toItemTemplateInput('Shield')).toMatchObject({
      name: 'Shield',
      type: 'armor',
      weight: 6,
      value: 10,
    });
  });

  it('allows local-openai without a real API key and requires cloud provider keys', () => {
    expect(canUseSelectedAiProvider('local-openai', '')).toEqual({ usable: true });
    expect(canUseSelectedAiProvider('openrouter', '')).toEqual({
      usable: false,
      reason: 'API Key for openrouter is missing. Please configure it in settings.',
    });
    expect(canUseSelectedAiProvider('openrouter', 'sk-test')).toEqual({ usable: true });
  });
});
