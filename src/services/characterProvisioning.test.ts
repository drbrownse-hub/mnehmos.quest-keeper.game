import { describe, expect, it } from 'vitest';
import { provisionCharacterEquipment } from './characterProvisioning';

describe('provisionCharacterEquipment', () => {
  it('creates missing item templates, gives items, and equips obvious defaults', async () => {
    const calls: Array<{ name: string; args: any }> = [];
    const client = {
      callTool: async (name: string, args: any) => {
        calls.push({ name, args });
        if (name === 'item_manage' && args.action === 'search') {
          return { items: [] };
        }
        if (name === 'item_manage' && args.action === 'create') {
          return { item: { id: `item-${args.name}` } };
        }
        return { ok: true };
      },
    };

    await provisionCharacterEquipment(client, {
      characterId: 'char-1',
      items: ['Longsword', 'Shield', 'Chain Mail'],
      equipDefaults: true,
    });

    expect(calls).toContainEqual({
      name: 'inventory_manage',
      args: { action: 'give', characterId: 'char-1', itemId: 'item-Longsword', quantity: 1 },
    });
    expect(calls).toContainEqual({
      name: 'inventory_manage',
      args: { action: 'equip', characterId: 'char-1', itemId: 'item-Longsword', slot: 'mainhand' },
    });
    expect(calls).toContainEqual({
      name: 'inventory_manage',
      args: { action: 'equip', characterId: 'char-1', itemId: 'item-Shield', slot: 'offhand' },
    });
    expect(calls).toContainEqual({
      name: 'inventory_manage',
      args: { action: 'equip', characterId: 'char-1', itemId: 'item-Chain Mail', slot: 'armor' },
    });
  });
});
