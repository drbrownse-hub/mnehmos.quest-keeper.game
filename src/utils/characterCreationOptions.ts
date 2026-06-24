import { dnd5eItems, ItemReference } from '../data/dnd5eItems';
import type { LLMProvider } from '../stores/settingsStore';

export interface CharacterBackgroundOption {
  name: string;
  description: string;
  suggestedItems: string[];
  startingGold: number;
}

export interface StartingEquipmentInput {
  characterClass: string;
  background: string;
  selectedClassItems?: string[];
  selectedBackgroundItems?: string[];
}

export interface ResolvedStartingEquipment {
  items: string[];
  gold: number;
}

export interface ItemTemplateInput {
  name: string;
  type: 'weapon' | 'armor' | 'consumable' | 'quest' | 'misc' | 'scroll';
  description: string;
  weight: number;
  value: number;
  properties?: Record<string, unknown>;
}

export const PORTRAIT_ICONS = ['⚔️', '🛡️', '🏹', '🔮', '✨', '🗡️', '🌿', '🔥', '🎵', '👁️', '🪓', '✋'];

export const PORTRAIT_COLORS = [
  { name: 'Emerald', bg: '#065f46', border: '#10b981' },
  { name: 'Ruby', bg: '#7f1d1d', border: '#ef4444' },
  { name: 'Sapphire', bg: '#1e3a8a', border: '#3b82f6' },
  { name: 'Amethyst', bg: '#581c87', border: '#a855f7' },
  { name: 'Gold', bg: '#78350f', border: '#f59e0b' },
  { name: 'Silver', bg: '#374151', border: '#9ca3af' },
  { name: 'Copper', bg: '#7c2d12', border: '#ea580c' },
  { name: 'Jade', bg: '#064e3b', border: '#34d399' },
];

export const BACKGROUND_OPTIONS: CharacterBackgroundOption[] = [
  { name: 'Acolyte', description: 'A temple servant, initiate, or wandering devotee.', suggestedItems: ['Holy Symbol', 'Prayer Book'], startingGold: 15 },
  { name: 'Charlatan', description: 'A practiced deceiver with aliases and social tricks.', suggestedItems: ['Disguise Kit', 'Fine Clothes'], startingGold: 15 },
  { name: 'Criminal', description: 'A lawbreaker with underworld contacts.', suggestedItems: ['Crowbar', 'Dark Common Clothes'], startingGold: 15 },
  { name: 'Entertainer', description: 'A performer accustomed to crowds and travel.', suggestedItems: ['Lute', 'Costume'], startingGold: 15 },
  { name: 'Folk Hero', description: 'A humble champion known for standing up to danger.', suggestedItems: ['Shovel', 'Iron Pot'], startingGold: 10 },
  { name: 'Guild Artisan', description: 'A trained craftsperson with guild ties.', suggestedItems: ["Artisan's Tools", 'Traveler Clothes'], startingGold: 15 },
  { name: 'Hermit', description: 'A recluse shaped by solitude and discovery.', suggestedItems: ['Herbalism Kit', 'Winter Blanket'], startingGold: 5 },
  { name: 'Noble', description: 'A person of station with courtly habits.', suggestedItems: ['Fine Clothes', 'Signet Ring'], startingGold: 25 },
  { name: 'Outlander', description: 'A survivor from the wilds beyond settled lands.', suggestedItems: ['Staff', 'Hunting Trap'], startingGold: 10 },
  { name: 'Sage', description: 'A researcher, scholar, or keeper of lore.', suggestedItems: ['Ink', 'Quill'], startingGold: 10 },
  { name: 'Sailor', description: 'A traveler hardened by ships, storms, and ports.', suggestedItems: ['Rope, Hempen (50 feet)', 'Belaying Pin'], startingGold: 10 },
  { name: 'Soldier', description: 'A trained combatant from an army, militia, or company.', suggestedItems: ['Insignia', 'Gaming Set'], startingGold: 10 },
  { name: 'Urchin', description: 'A survivor from the streets and alleys.', suggestedItems: ['Small Knife', 'Common Clothes'], startingGold: 10 },
  { name: 'Custom', description: 'A user-defined background.', suggestedItems: [], startingGold: 10 },
];

export const CLASS_EQUIPMENT_OPTIONS: Record<string, string[]> = {
  Barbarian: ['Greataxe', 'Handaxe', 'Explorer Pack', 'Javelin'],
  Bard: ['Rapier', 'Dagger', 'Leather Armor', 'Lute'],
  Cleric: ['Mace', 'Scale Mail', 'Shield', 'Holy Symbol'],
  Druid: ['Scimitar', 'Leather Armor', 'Shield', 'Druidic Focus'],
  Fighter: ['Longsword', 'Shield', 'Chain Mail', 'Handaxe'],
  Monk: ['Shortsword', 'Dart', 'Explorer Pack'],
  Paladin: ['Longsword', 'Shield', 'Chain Mail', 'Holy Symbol'],
  Ranger: ['Longbow', 'Shortsword', 'Leather Armor', 'Explorer Pack'],
  Rogue: ['Rapier', 'Shortbow', 'Leather Armor', "Thieves' Tools"],
  Sorcerer: ['Light Crossbow', 'Dagger', 'Component Pouch'],
  Warlock: ['Light Crossbow', 'Dagger', 'Leather Armor', 'Arcane Focus'],
  Wizard: ['Quarterstaff', 'Dagger', 'Spellbook', 'Component Pouch'],
};

const ITEM_ALIASES: Record<string, string> = {
  'chain-mail': 'Chain Mail',
  'chain mail': 'Chain Mail',
  'leather-armor': 'Leather Armor',
  'leather armor': 'Leather Armor',
  'scale-mail': 'Scale Mail',
  'scale mail': 'Scale Mail',
  'plate-armor': 'Plate Armor',
  'plate armor': 'Plate Armor',
  'half-plate': 'Half Plate',
  'studded-leather': 'Studded Leather Armor',
  'studded leather': 'Studded Leather Armor',
  'light-crossbow': 'Light Crossbow',
  'shortbow': 'Shortbow',
  'longbow': 'Longbow',
  'longsword': 'Longsword',
  'shortsword': 'Shortsword',
  'quarterstaff': 'Quarterstaff',
  'handaxe': 'Handaxe',
  'greataxe': 'Greataxe',
  'mace': 'Mace',
  'rapier': 'Rapier',
  'scimitar': 'Scimitar',
  'shield': 'Shield',
  'dagger': 'Dagger',
  'javelin': 'Javelin',
  'dart': 'Dart',
  'potion-of-healing': 'Potion of Healing',
  'explorers-pack': 'Explorer Pack',
  'explorer pack': 'Explorer Pack',
  'dungeoneers-pack': 'Dungeoneer Pack',
  'scholars-pack': 'Scholar Pack',
  'priests-pack': 'Priest Pack',
  'burglars-pack': 'Burglar Pack',
  'entertainers-pack': 'Entertainer Pack',
  'component-pouch': 'Component Pouch',
  'holy-symbol': 'Holy Symbol',
  'spellbook': 'Spellbook',
  'thieves-tools': "Thieves' Tools",
};

export function getBackgroundByName(name: string): CharacterBackgroundOption | undefined {
  return BACKGROUND_OPTIONS.find((background) => background.name.toLowerCase() === name.trim().toLowerCase());
}

export function canUseSelectedAiProvider(provider: LLMProvider, apiKey: string): { usable: true } | { usable: false; reason: string } {
  if (provider === 'local-openai') return { usable: true };
  if (apiKey.trim()) return { usable: true };
  return {
    usable: false,
    reason: `API Key for ${provider} is missing. Please configure it in settings.`,
  };
}

export function canonicalItemName(rawName: string): string {
  const trimmed = rawName.trim();
  const alias = ITEM_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;

  const exactKey = Object.keys(dnd5eItems).find((key) => key.toLowerCase() === trimmed.toLowerCase());
  if (exactKey) return exactKey;

  return trimmed
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function resolveStartingEquipment(input: StartingEquipmentInput): ResolvedStartingEquipment {
  const background = getBackgroundByName(input.background) || getBackgroundByName('Custom')!;
  const classItems = input.selectedClassItems?.length
    ? input.selectedClassItems
    : CLASS_EQUIPMENT_OPTIONS[input.characterClass] || ['Dagger', 'Explorer Pack'];
  const backgroundItems = input.selectedBackgroundItems ?? background.suggestedItems;

  const seen = new Set<string>();
  const items = [...classItems, ...backgroundItems]
    .map(canonicalItemName)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return { items, gold: background.startingGold };
}

export function toItemTemplateInput(itemName: string): ItemTemplateInput {
  const canonicalName = canonicalItemName(itemName);
  const ref = dnd5eItems[canonicalName];
  const type = mapItemType(ref, canonicalName);
  return {
    name: canonicalName,
    type,
    description: ref?.description || `${canonicalName} carried as starting equipment.`,
    weight: ref?.weight ?? 1,
    value: parseGoldValue(ref?.value),
    properties: buildProperties(ref),
  };
}

function mapItemType(ref: ItemReference | undefined, name: string): ItemTemplateInput['type'] {
  const type = ref?.type.toLowerCase() || '';
  if (type.includes('weapon')) return 'weapon';
  if (type.includes('armor') || type.includes('shield')) return 'armor';
  if (type.includes('potion') || type.includes('consumable')) return 'consumable';
  if (name.toLowerCase().includes('scroll')) return 'scroll';
  return 'misc';
}

function parseGoldValue(value?: string): number {
  if (!value) return 0;
  const amount = Number.parseFloat(value.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(amount)) return 0;
  const lower = value.toLowerCase();
  if (lower.includes('cp')) return amount / 100;
  if (lower.includes('sp')) return amount / 10;
  return amount;
}

function buildProperties(ref: ItemReference | undefined): Record<string, unknown> | undefined {
  if (!ref) return undefined;
  const properties: Record<string, unknown> = {};
  if (ref.properties?.length) properties.properties = ref.properties;
  if (ref.damage) properties.damageDice = ref.damage;
  if (ref.armorClass !== undefined) properties.baseAC = ref.armorClass;
  if (ref.rarity) properties.rarity = ref.rarity;
  return Object.keys(properties).length > 0 ? properties : undefined;
}
