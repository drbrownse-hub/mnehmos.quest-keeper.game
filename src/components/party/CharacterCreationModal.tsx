import React, { useState, useCallback } from 'react';
import { mcpManager } from '../../services/mcpClient';
import { parseMcpResponse } from '../../utils/mcpUtils';
import { useGameStateStore } from '../../stores/gameStateStore';
import { getStartingGear, getStartingItemIds } from '../../data/startingGear';
import { llmService } from '../../services/llm/LLMService';

interface CharacterCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (characterId: string) => void;
}

type StatGenerationMethod = 'roll' | 'standard' | 'pointbuy' | 'manual';
type CharacterType = 'pc' | 'npc' | 'enemy' | 'neutral';

interface AbilityScores {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

interface RollResult {
  dice: number[];
  dropped: number;
  total: number;
}

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const POINT_BUY_COSTS: Record<number, number> = {
  8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9
};
const POINT_BUY_TOTAL = 27;

const ABILITY_NAMES: (keyof AbilityScores)[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const ABILITY_LABELS: Record<keyof AbilityScores, string> = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma'
};

const RACES = [
  'Human', 'Elf', 'Dwarf', 'Halfling', 'Half-Elf', 'Half-Orc', 'Gnome', 'Tiefling',
  'Dragonborn', 'Goliath', 'Aasimar', 'Tabaxi', 'Kenku', 'Hobbit', 'Other'
];

const CLASSES = [
  'Fighter', 'Wizard', 'Rogue', 'Cleric', 'Ranger', 'Paladin', 'Barbarian',
  'Bard', 'Druid', 'Monk', 'Sorcerer', 'Warlock', 'Artificer', 'Other'
];

const DEFAULT_STATS: AbilityScores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

const extractJsonObject = (text: string): any | null => {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] || text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
};

const parseJsonString = (value: unknown): any | null => {
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const parseNumericList = (value: unknown): number[] | null => {
  if (!Array.isArray(value)) return null;
  const numbers = value.map((item) => Number(item));
  return numbers.every(Number.isFinite) ? numbers : null;
};

const extractDiceFromRollSteps = (steps: unknown): { rolls: number[] | null; dropped: number | null } => {
  if (!Array.isArray(steps)) return { rolls: null, dropped: null };
  const text = steps.join('\n');
  const rollsMatch = text.match(/Rolled\s+\d+d\d+:\s*\[([^\]]+)\]/i);
  const droppedMatch = text.match(/Dropped:\s*\[([^\]]+)\]/i);

  const parseList = (raw?: string) => raw
    ? raw.split(',').map((part) => Number(part.trim())).filter(Number.isFinite)
    : [];

  const rolls = parseList(rollsMatch?.[1]);
  const dropped = parseList(droppedMatch?.[1])[0] ?? null;
  return {
    rolls: rolls.length > 0 ? rolls : null,
    dropped
  };
};

export const CharacterCreationModal: React.FC<CharacterCreationModalProps> = ({
  isOpen,
  onClose,
  onCreated
}) => {
  // Basic Info
  const [name, setName] = useState('');
  const [race, setRace] = useState('Human');
  const [customRace, setCustomRace] = useState('');
  const [charClass, setCharClass] = useState('Fighter');
  const [customClass, setCustomClass] = useState('');
  const [level, setLevel] = useState(1);
  const [characterType, setCharacterType] = useState<CharacterType>('pc');
  
  // Ability Scores
  const [stats, setStats] = useState<AbilityScores>({ ...DEFAULT_STATS });
  const [statMethod, setStatMethod] = useState<StatGenerationMethod>('roll');
  const [rollResults, setRollResults] = useState<Record<keyof AbilityScores, RollResult | null>>({
    str: null, dex: null, con: null, int: null, wis: null, cha: null
  });
  const [standardArrayAssignments, setStandardArrayAssignments] = useState<(keyof AbilityScores | null)[]>(
    [null, null, null, null, null, null]
  );
  
  // AI Enhancement
  const [backstory, setBackstory] = useState('');
  const [personality, setPersonality] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancePrompt, setEnhancePrompt] = useState('');
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'stats' | 'details'>('basic');
  
  const syncState = useGameStateStore(state => state.syncState);

  // Calculate point buy remaining
  const getPointBuySpent = useCallback(() => {
    return ABILITY_NAMES.reduce((total, ability) => {
      const score = stats[ability];
      return total + (POINT_BUY_COSTS[score] ?? 0);
    }, 0);
  }, [stats]);

  // Roll 4d6 drop lowest using MCP
  const rollStat = useCallback(async (ability: keyof AbilityScores) => {
    try {
      const result = await mcpManager.gameStateClient.callTool('dice_roll', {
        expression: '4d6dl1'  // 4d6 drop lowest
      });
      
      const data = parseMcpResponse<any>(result, null);
      
      if (data) {
        const formatted = parseJsonString(data.formatted);
        const stepDice = extractDiceFromRollSteps(data.rolls || formatted?.steps);
        const rolls = parseNumericList(data.metadata?.rolls)
          || parseNumericList(formatted?.metadata?.rolls)
          || parseNumericList(data.dice)
          || stepDice.rolls
          || [3, 3, 3, 3];
        const total = Number(data.total ?? data.result ?? formatted?.result ?? 10);
        const dropped = Number(
          data.metadata?.dropped?.[0]
          ?? data.dropped?.[0]
          ?? stepDice.dropped
          ?? Math.min(...rolls)
        );
        
        setRollResults(prev => ({
          ...prev,
          [ability]: { dice: rolls, dropped, total }
        }));
        
        setStats(prev => ({ ...prev, [ability]: total }));
      }
    } catch (err) {
      console.error('Failed to roll stat:', err);
      // Fallback to local roll
      const dice = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
      const sorted = [...dice].sort((a, b) => a - b);
      const dropped = sorted[0];
      const total = sorted.slice(1).reduce((a, b) => a + b, 0);
      
      setRollResults(prev => ({
        ...prev,
        [ability]: { dice, dropped, total }
      }));
      
      setStats(prev => ({ ...prev, [ability]: total }));
    }
  }, []);

  // Roll all stats at once
  const rollAllStats = useCallback(async () => {
    for (const ability of ABILITY_NAMES) {
      await rollStat(ability);
      // Small delay between rolls for visual effect
      await new Promise(r => setTimeout(r, 150));
    }
  }, [rollStat]);

  // Assign standard array value to an ability
  const assignStandardArray = useCallback((arrayIndex: number, ability: keyof AbilityScores | null) => {
    const newAssignments = [...standardArrayAssignments];
    
    // Remove this ability from any other assignment
    if (ability) {
      const existingIndex = newAssignments.findIndex(a => a === ability);
      if (existingIndex !== -1) {
        newAssignments[existingIndex] = null;
      }
    }
    
    // Clear the previous assignment at this index (if any)
    newAssignments[arrayIndex] = ability;
    setStandardArrayAssignments(newAssignments);
    
    // Update stats
    const newStats = { ...DEFAULT_STATS };
    newAssignments.forEach((assignedAbility, idx) => {
      if (assignedAbility) {
        newStats[assignedAbility] = STANDARD_ARRAY[idx];
      }
    });
    setStats(newStats);
  }, [standardArrayAssignments]);

  // Update point buy stat
  const updatePointBuyStat = useCallback((ability: keyof AbilityScores, delta: number) => {
    const currentScore = stats[ability];
    const newScore = currentScore + delta;
    
    if (newScore < 8 || newScore > 15) return;
    
    const currentCost = POINT_BUY_COSTS[currentScore] ?? 0;
    const newCost = POINT_BUY_COSTS[newScore] ?? 0;
    const costDelta = newCost - currentCost;
    const spent = getPointBuySpent();
    
    if (spent + costDelta > POINT_BUY_TOTAL) return;
    
    setStats(prev => ({ ...prev, [ability]: newScore }));
  }, [stats, getPointBuySpent]);

  // AI Enhancement
  const enhanceWithAI = useCallback(async () => {
    if (!name.trim()) {
      setError('Please enter a character name first');
      return;
    }

    setIsEnhancing(true);
    setError(null);

    try {
      const actualClass = charClass === 'Other' ? customClass : charClass;
      const actualRace = race === 'Other' ? customRace : race;
      const statSummary = ABILITY_NAMES
        .map((ability) => `${ability.toUpperCase()} ${stats[ability]}`)
        .join(', ');
      const prompt = `Generate concise D&D character details for this character.

Name: ${name.trim()}
Race: ${actualRace || 'Unspecified'}
Class: ${actualClass || 'Unspecified'}
Level: ${level}
Ability scores: ${statSummary}
Player context: ${enhancePrompt.trim() || 'None'}

Return only valid JSON with this shape:
{
  "backstory": "2 short paragraphs, specific to the character",
  "personality": "3-5 concrete personality traits, motivations, and quirks"
}`;

      const response = await llmService.sendPlainMessage([
        {
          role: 'system',
          content: 'You generate concise fantasy RPG character details. Return only the requested JSON.'
        },
        { role: 'user', content: prompt }
      ]);

      const parsed = extractJsonObject(response);
      if (parsed?.backstory || parsed?.personality) {
        setBackstory(String(parsed.backstory || '').trim());
        setPersonality(String(parsed.personality || '').trim());
        return;
      }

      setBackstory(response.trim());
      setPersonality('');

    } catch (err) {
      console.error('AI enhancement failed:', err);
      setError(`Failed to generate character details: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsEnhancing(false);
    }
  }, [name, race, customRace, charClass, customClass, level, stats, enhancePrompt]);

  // Create character via MCP
  const createCharacter = useCallback(async () => {
    if (!name.trim()) {
      setError('Character name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const actualRace = race === 'Other' ? customRace : race;
      const actualClass = charClass === 'Other' ? customClass : charClass;

      // Calculate HP based on class and CON
      const conMod = Math.floor((stats.con - 10) / 2);
      const hitDice: Record<string, number> = {
        'Barbarian': 12, 'Fighter': 10, 'Paladin': 10, 'Ranger': 10,
        'Cleric': 8, 'Druid': 8, 'Monk': 8, 'Rogue': 8, 'Warlock': 8, 'Bard': 8,
        'Wizard': 6, 'Sorcerer': 6
      };
      const hitDie = hitDice[actualClass] || 8;
      const baseHp = hitDie + conMod;
      const totalHp = Math.max(1, baseHp + (level - 1) * (Math.floor(hitDie / 2) + 1 + conMod));

      // Calculate AC (base 10 + DEX mod)
      const dexMod = Math.floor((stats.dex - 10) / 2);
      const baseAc = 10 + dexMod;

      // Build behavior string from backstory/personality
      const behavior = [backstory, personality].filter(Boolean).join(' ');

      // Debug: Check if MCP client is connected
      const isConnected = mcpManager.gameStateClient.isConnected();
      console.log('[CharacterCreationModal] MCP connected:', isConnected);
      
      if (!isConnected) {
        throw new Error('MCP Server not connected. Please restart the application.');
      }

      const toolArgs = {
        name: name.trim(),
        hp: totalHp,
        maxHp: totalHp,
        ac: baseAc,
        level,
        stats,
        characterType,
        // Optional fields
        ...(actualRace && { race: actualRace }),
        ...(actualClass && { class: actualClass }),
        ...(behavior && { behavior })
      };
      
      console.log('[CharacterCreationModal] Calling create_character with:', toolArgs);
      
      const result = await mcpManager.gameStateClient.callTool('create_character', toolArgs);
      
      console.log('[CharacterCreationModal] Raw result:', JSON.stringify(result).slice(0, 500));

      const data = parseMcpResponse<any>(result, null);
      
      console.log('[CharacterCreationModal] Parsed data:', data ? JSON.stringify(data).slice(0, 500) : 'null');

      if (data && data.id) {
        console.log('[CharacterCreationModal] Character created:', data.id);
        
        // Give starting gear based on class and level
        const startingGear = getStartingGear(actualClass, level);
        const itemIds = getStartingItemIds(startingGear);
        
        console.log('[CharacterCreationModal] Giving starting gear:', itemIds);
        
        for (const itemId of itemIds) {
          try {
            await mcpManager.gameStateClient.callTool('give_item', {
              characterId: data.id,
              itemId: itemId,
              quantity: 1
            });
          } catch (giveErr) {
            // Item might not exist in database - log but don't fail
            console.warn(`[CharacterCreationModal] Could not give item ${itemId}:`, giveErr);
          }
        }
        
        // Give starting gold if the character has a currency tracker
        if (startingGear.gold > 0) {
          console.log('[CharacterCreationModal] Starting gold:', startingGear.gold);
          // TODO: Add gold via update_character or currency tool when available
        }
        
        // Sync state to refresh character list
        await syncState(true);
        
        onCreated?.(data.id);
        onClose();
        
        // Reset form
        setName('');
        setRace('Human');
        setCharClass('Fighter');
        setLevel(1);
        setStats({ ...DEFAULT_STATS });
        setBackstory('');
        setPersonality('');
        setRollResults({ str: null, dex: null, con: null, int: null, wis: null, cha: null });
        setStandardArrayAssignments([null, null, null, null, null, null]);
      } else {
        throw new Error('Failed to create character - no ID returned');
      }
    } catch (err: any) {
      console.error('Character creation failed:', err);
      setError(err.message || 'Failed to create character');
    } finally {
      setLoading(false);
    }
  }, [name, race, customRace, charClass, customClass, level, stats, characterType, backstory, personality, syncState, onCreated, onClose]);

  if (!isOpen) return null;

  const getMod = (score: number) => Math.floor((score - 10) / 2);
  const formatMod = (mod: number) => mod >= 0 ? `+${mod}` : `${mod}`;

  return (
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-terminal-black border-2 border-terminal-green rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-glow-xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-terminal-green/30 bg-terminal-green/5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-terminal-green">⚔️ CREATE CHARACTER</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full border border-terminal-green/50 text-terminal-green hover:bg-terminal-green/20 transition-colors flex items-center justify-center"
            >
              ✕
            </button>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-2 mt-4">
            {(['basic', 'stats', 'details'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm uppercase tracking-wider rounded transition-colors ${
                  activeTab === tab
                    ? 'bg-terminal-green text-black font-bold'
                    : 'bg-terminal-green/10 text-terminal-green hover:bg-terminal-green/20'
                }`}
              >
                {tab === 'basic' && '1. Basic Info'}
                {tab === 'stats' && '2. Abilities'}
                {tab === 'details' && '3. Details'}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Basic Info Tab */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-terminal-green/70 mb-2 uppercase">
                  Character Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter character name..."
                  className="w-full bg-terminal-black border border-terminal-green/50 text-terminal-green px-3 py-2 rounded-lg focus:outline-none focus:border-terminal-green text-lg"
                  autoFocus
                />
              </div>

              {/* Race & Class */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-terminal-green/70 mb-2 uppercase">Race</label>
                  <select
                    value={race}
                    onChange={(e) => setRace(e.target.value)}
                    className="w-full bg-terminal-black border border-terminal-green/50 text-terminal-green px-3 py-2 rounded-lg focus:outline-none focus:border-terminal-green"
                  >
                    {RACES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {race === 'Other' && (
                    <input
                      type="text"
                      value={customRace}
                      onChange={(e) => setCustomRace(e.target.value)}
                      placeholder="Enter race..."
                      className="w-full mt-2 bg-terminal-black border border-terminal-green/50 text-terminal-green px-3 py-2 rounded-lg focus:outline-none focus:border-terminal-green"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-terminal-green/70 mb-2 uppercase">Class</label>
                  <select
                    value={charClass}
                    onChange={(e) => setCharClass(e.target.value)}
                    className="w-full bg-terminal-black border border-terminal-green/50 text-terminal-green px-3 py-2 rounded-lg focus:outline-none focus:border-terminal-green"
                  >
                    {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {charClass === 'Other' && (
                    <input
                      type="text"
                      value={customClass}
                      onChange={(e) => setCustomClass(e.target.value)}
                      placeholder="Enter class..."
                      className="w-full mt-2 bg-terminal-black border border-terminal-green/50 text-terminal-green px-3 py-2 rounded-lg focus:outline-none focus:border-terminal-green"
                    />
                  )}
                </div>
              </div>

              {/* Level & Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-terminal-green/70 mb-2 uppercase">Level</label>
                  <input
                    type="number"
                    value={level}
                    onChange={(e) => setLevel(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                    min={1}
                    max={20}
                    className="w-full bg-terminal-black border border-terminal-green/50 text-terminal-green px-3 py-2 rounded-lg focus:outline-none focus:border-terminal-green"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-terminal-green/70 mb-2 uppercase">Type</label>
                  <select
                    value={characterType}
                    onChange={(e) => setCharacterType(e.target.value as CharacterType)}
                    className="w-full bg-terminal-black border border-terminal-green/50 text-terminal-green px-3 py-2 rounded-lg focus:outline-none focus:border-terminal-green"
                  >
                    <option value="pc">Player Character</option>
                    <option value="npc">NPC (Ally)</option>
                    <option value="neutral">Neutral</option>
                    <option value="enemy">Enemy</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Stats Tab */}
          {activeTab === 'stats' && (
            <div className="space-y-4">
              {/* Method Selection */}
              <div>
                <label className="block text-xs font-bold text-terminal-green/70 mb-2 uppercase">
                  Generation Method
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: 'roll', label: '🎲 Roll', desc: '4d6 drop lowest' },
                    { value: 'standard', label: '📊 Standard', desc: '15,14,13,12,10,8' },
                    { value: 'pointbuy', label: '🎯 Point Buy', desc: '27 points' },
                    { value: 'manual', label: '✏️ Manual', desc: 'Enter values' },
                  ].map((method) => (
                    <button
                      key={method.value}
                      onClick={() => {
                        setStatMethod(method.value as StatGenerationMethod);
                        if (method.value !== 'roll') {
                          setRollResults({ str: null, dex: null, con: null, int: null, wis: null, cha: null });
                        }
                        if (method.value === 'pointbuy') {
                          setStats({ str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 });
                        } else if (method.value === 'standard') {
                          setStats({ ...DEFAULT_STATS });
                          setStandardArrayAssignments([null, null, null, null, null, null]);
                        }
                      }}
                      className={`p-2 text-xs rounded transition-colors ${
                        statMethod === method.value
                          ? 'bg-terminal-green text-black font-bold'
                          : 'bg-terminal-green/10 text-terminal-green hover:bg-terminal-green/20'
                      }`}
                    >
                      <div>{method.label}</div>
                      <div className="text-[10px] opacity-70">{method.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Roll Method */}
              {statMethod === 'roll' && (
                <div className="space-y-3">
                  <button
                    onClick={rollAllStats}
                    className="w-full py-2 bg-terminal-green/20 border border-terminal-green text-terminal-green rounded hover:bg-terminal-green/30 transition-colors font-bold"
                  >
                    🎲 ROLL ALL STATS
                  </button>
                  
                  <div className="grid grid-cols-3 gap-3">
                    {ABILITY_NAMES.map((ability) => (
                      <div key={ability} className="border border-terminal-green/30 p-3 rounded bg-terminal-green/5">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs text-terminal-green/70 uppercase">{ABILITY_LABELS[ability]}</span>
                          <button
                            onClick={() => rollStat(ability)}
                            className="text-xs px-2 py-1 bg-terminal-green/20 rounded hover:bg-terminal-green/30"
                          >
                            🎲
                          </button>
                        </div>
                        <div className="text-2xl font-bold text-center">{stats[ability]}</div>
                        <div className="text-xs text-center text-terminal-green/60">
                          {formatMod(getMod(stats[ability]))}
                        </div>
                        {rollResults[ability] && (
                          <div className="text-[10px] text-terminal-green/50 text-center mt-1">
                            [{rollResults[ability]!.dice.map((d, i) => 
                              d === rollResults[ability]!.dropped 
                                ? <span key={i} className="line-through text-red-500/50">{d}</span>
                                : <span key={i}>{d}</span>
                            ).reduce((prev, curr, i) => i === 0 ? [curr] : [...prev, ',', curr], [] as React.ReactNode[])}]
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Standard Array Method */}
              {statMethod === 'standard' && (
                <div className="space-y-3">
                  <div className="text-xs text-terminal-green/70 mb-2">
                    Assign each value to an ability score:
                  </div>
                  <div className="grid grid-cols-6 gap-2 mb-4">
                    {STANDARD_ARRAY.map((value, idx) => (
                      <div key={idx} className="text-center">
                        <div className="text-lg font-bold text-terminal-green">{value}</div>
                        <select
                          value={standardArrayAssignments[idx] || ''}
                          onChange={(e) => assignStandardArray(idx, (e.target.value || null) as keyof AbilityScores | null)}
                          className="w-full mt-1 bg-terminal-black border border-terminal-green/50 text-terminal-green text-xs p-1 rounded"
                        >
                          <option value="">--</option>
                          {ABILITY_NAMES.map(a => (
                            <option key={a} value={a} disabled={standardArrayAssignments.includes(a) && standardArrayAssignments[idx] !== a}>
                              {a.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3">
                    {ABILITY_NAMES.map((ability) => (
                      <div key={ability} className="border border-terminal-green/30 p-3 rounded bg-terminal-green/5">
                        <div className="text-xs text-terminal-green/70 uppercase mb-1">{ABILITY_LABELS[ability]}</div>
                        <div className="text-2xl font-bold text-center">{stats[ability]}</div>
                        <div className="text-xs text-center text-terminal-green/60">
                          {formatMod(getMod(stats[ability]))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Point Buy Method */}
              {statMethod === 'pointbuy' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-terminal-green/70">Points Spent:</span>
                    <span className={`font-bold ${getPointBuySpent() > POINT_BUY_TOTAL ? 'text-red-500' : 'text-terminal-green'}`}>
                      {getPointBuySpent()} / {POINT_BUY_TOTAL}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3">
                    {ABILITY_NAMES.map((ability) => (
                      <div key={ability} className="border border-terminal-green/30 p-3 rounded bg-terminal-green/5">
                        <div className="text-xs text-terminal-green/70 uppercase mb-1">{ABILITY_LABELS[ability]}</div>
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => updatePointBuyStat(ability, -1)}
                            disabled={stats[ability] <= 8}
                            className="w-8 h-8 rounded bg-terminal-green/20 hover:bg-terminal-green/30 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            −
                          </button>
                          <div className="text-2xl font-bold w-10 text-center">{stats[ability]}</div>
                          <button
                            onClick={() => updatePointBuyStat(ability, 1)}
                            disabled={stats[ability] >= 15 || getPointBuySpent() >= POINT_BUY_TOTAL}
                            className="w-8 h-8 rounded bg-terminal-green/20 hover:bg-terminal-green/30 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            +
                          </button>
                        </div>
                        <div className="text-xs text-center text-terminal-green/60">
                          {formatMod(getMod(stats[ability]))} • Cost: {POINT_BUY_COSTS[stats[ability]] ?? 0}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual Entry Method */}
              {statMethod === 'manual' && (
                <div className="grid grid-cols-3 gap-3">
                  {ABILITY_NAMES.map((ability) => (
                    <div key={ability} className="border border-terminal-green/30 p-3 rounded bg-terminal-green/5">
                      <div className="text-xs text-terminal-green/70 uppercase mb-1">{ABILITY_LABELS[ability]}</div>
                      <input
                        type="number"
                        value={stats[ability]}
                        onChange={(e) => setStats(prev => ({
                          ...prev,
                          [ability]: Math.max(1, Math.min(30, parseInt(e.target.value) || 10))
                        }))}
                        min={1}
                        max={30}
                        className="w-full bg-terminal-black border border-terminal-green/50 text-terminal-green text-2xl font-bold text-center p-2 rounded"
                      />
                      <div className="text-xs text-center text-terminal-green/60 mt-1">
                        {formatMod(getMod(stats[ability]))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="space-y-4">
              {/* AI Enhancement */}
              <div className="border border-terminal-green/30 rounded-lg p-4 bg-terminal-green/5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-terminal-green uppercase">✨ AI Enhancement</h3>
                  <button
                    onClick={enhanceWithAI}
                    disabled={isEnhancing || !name.trim()}
                    className="px-4 py-2 bg-purple-600/80 text-white rounded hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-bold flex items-center gap-2"
                  >
                    {isEnhancing ? (
                      <>
                        <span className="animate-spin">⚙️</span>
                        Generating...
                      </>
                    ) : (
                      <>🪄 Generate Details</>
                    )}
                  </button>
                </div>
                <input
                  type="text"
                  value={enhancePrompt}
                  onChange={(e) => setEnhancePrompt(e.target.value)}
                  placeholder="Optional: Add context (e.g., 'former soldier', 'seeks revenge')"
                  className="w-full bg-terminal-black border border-terminal-green/50 text-terminal-green px-3 py-2 rounded text-sm focus:outline-none focus:border-terminal-green"
                />
              </div>

              {/* Backstory */}
              <div>
                <label className="block text-xs font-bold text-terminal-green/70 mb-2 uppercase">
                  Backstory
                </label>
                <textarea
                  value={backstory}
                  onChange={(e) => setBackstory(e.target.value)}
                  placeholder="Enter character backstory..."
                  rows={4}
                  className="w-full bg-terminal-black border border-terminal-green/50 text-terminal-green px-3 py-2 rounded-lg focus:outline-none focus:border-terminal-green resize-none"
                />
              </div>

              {/* Personality */}
              <div>
                <label className="block text-xs font-bold text-terminal-green/70 mb-2 uppercase">
                  Personality Traits
                </label>
                <textarea
                  value={personality}
                  onChange={(e) => setPersonality(e.target.value)}
                  placeholder="Enter personality traits, quirks, motivations..."
                  rows={3}
                  className="w-full bg-terminal-black border border-terminal-green/50 text-terminal-green px-3 py-2 rounded-lg focus:outline-none focus:border-terminal-green resize-none"
                />
              </div>

              {/* Preview */}
              <div className="border border-terminal-green/30 rounded-lg p-4 bg-black/50">
                <h3 className="text-sm font-bold text-terminal-green/70 uppercase mb-3">Preview</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-terminal-green/60">Name:</span>{' '}
                    <span className="text-terminal-green font-bold">{name || '—'}</span>
                  </div>
                  <div>
                    <span className="text-terminal-green/60">Level:</span>{' '}
                    <span className="text-terminal-green">{level}</span>
                  </div>
                  <div>
                    <span className="text-terminal-green/60">Race:</span>{' '}
                    <span className="text-terminal-green">{race === 'Other' ? customRace : race}</span>
                  </div>
                  <div>
                    <span className="text-terminal-green/60">Class:</span>{' '}
                    <span className="text-terminal-green">{charClass === 'Other' ? customClass : charClass}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-terminal-green/60">Stats:</span>{' '}
                    <span className="text-terminal-green">
                      STR {stats.str} • DEX {stats.dex} • CON {stats.con} • INT {stats.int} • WIS {stats.wis} • CHA {stats.cha}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-2 bg-red-900/30 border-t border-red-500/50 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-terminal-green/30 flex gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-terminal-green/50 text-terminal-green rounded-lg hover:bg-terminal-green/10 transition-colors"
          >
            Cancel
          </button>
          
          <div className="flex-1 flex justify-center gap-2">
            {activeTab !== 'basic' && (
              <button
                onClick={() => setActiveTab(activeTab === 'stats' ? 'basic' : 'stats')}
                className="px-4 py-2 bg-terminal-green/10 text-terminal-green rounded-lg hover:bg-terminal-green/20 transition-colors"
              >
                ← Back
              </button>
            )}
            {activeTab !== 'details' && (
              <button
                onClick={() => setActiveTab(activeTab === 'basic' ? 'stats' : 'details')}
                className="px-4 py-2 bg-terminal-green/10 text-terminal-green rounded-lg hover:bg-terminal-green/20 transition-colors"
              >
                Next →
              </button>
            )}
          </div>

          <button
            onClick={createCharacter}
            disabled={!name.trim() || loading}
            className="px-6 py-2 bg-terminal-green text-black font-bold rounded-lg hover:bg-terminal-green-bright transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(0,255,0,0.3)] flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="animate-spin">⚙️</span>
                Creating...
              </>
            ) : (
              <>⚔️ Create Character</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CharacterCreationModal;
