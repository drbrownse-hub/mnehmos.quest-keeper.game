import { parseMcpResponse } from '../utils/mcpUtils';
import { canonicalItemName, toItemTemplateInput } from '../utils/characterCreationOptions';

type McpLikeClient = {
  callTool: (name: string, args: any) => Promise<any>;
};

export interface ProvisionCharacterEquipmentOptions {
  characterId: string;
  items: string[];
  equipDefaults?: boolean;
}

export async function provisionCharacterEquipment(
  client: McpLikeClient,
  options: ProvisionCharacterEquipmentOptions
): Promise<void> {
  const itemIds: Array<{ name: string; id: string }> = [];

  for (const rawName of options.items) {
    const name = canonicalItemName(rawName);
    const itemId = await findOrCreateItemTemplate(client, name);
    itemIds.push({ name, id: itemId });

    await client.callTool('inventory_manage', {
      action: 'give',
      characterId: options.characterId,
      itemId,
      quantity: 1,
    });
  }

  if (!options.equipDefaults) return;

  const mainhand = itemIds.find((item) => isWeapon(item.name));
  const shield = itemIds.find((item) => item.name.toLowerCase() === 'shield');
  const armor = itemIds.find((item) => isArmor(item.name));

  if (mainhand) {
    await client.callTool('inventory_manage', {
      action: 'equip',
      characterId: options.characterId,
      itemId: mainhand.id,
      slot: 'mainhand',
    });
  }

  if (shield) {
    await client.callTool('inventory_manage', {
      action: 'equip',
      characterId: options.characterId,
      itemId: shield.id,
      slot: 'offhand',
    });
  }

  if (armor) {
    await client.callTool('inventory_manage', {
      action: 'equip',
      characterId: options.characterId,
      itemId: armor.id,
      slot: 'armor',
    });
  }
}

async function findOrCreateItemTemplate(client: McpLikeClient, itemName: string): Promise<string> {
  const searchResult = await client.callTool('item_manage', {
    action: 'search',
    name: itemName,
  });
  const searchData = parseMcpResponse<any>(searchResult, {});
  const existing = searchData.items?.[0] || searchData.item;
  if (existing?.id) return existing.id;

  const template = toItemTemplateInput(itemName);
  const createResult = await client.callTool('item_manage', {
    action: 'create',
    ...template,
  });
  const createData = parseMcpResponse<any>(createResult, {});
  return createData.item?.id || createData.id || itemName;
}

function isWeapon(itemName: string): boolean {
  return ['sword', 'axe', 'bow', 'crossbow', 'mace', 'staff', 'dagger', 'rapier', 'scimitar', 'javelin', 'dart']
    .some((token) => itemName.toLowerCase().includes(token));
}

function isArmor(itemName: string): boolean {
  const lower = itemName.toLowerCase();
  return lower.includes('armor') || lower.includes('mail') || lower.includes('plate') || lower.includes('leather');
}
