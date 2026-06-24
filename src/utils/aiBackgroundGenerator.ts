/**
 * AI Background Story Generator
 * Uses the configured LLM provider to generate contextual character backstories
 */

import { llmService } from '../services/llm/LLMService';

interface CharacterContext {
    name: string;
    race: string;
    characterClass: string;
    level: number;
    existingBackground?: string;
    traits?: string[];
}

/**
 * Generate an AI-enhanced background story for a character
 */
export async function generateBackgroundStory(context: CharacterContext): Promise<string> {
    const prompt = buildPrompt(context);
    const response = await llmService.sendPlainMessage([
        {
            role: 'system',
            content: 'You are a creative writing assistant specializing in fantasy RPG character backstories.'
        },
        { role: 'user', content: prompt }
    ]);
    return response.trim();
}

function buildPrompt(context: CharacterContext): string {
    const parts = [
        `Generate a compelling 2-3 paragraph backstory for a fantasy RPG character with these details:`,
        ``,
        `Name: ${context.name || 'Unknown'}`,
        `Race: ${context.race}`,
        `Class: ${context.characterClass}`,
        `Level: ${context.level}`,
    ];

    if (context.traits && context.traits.length > 0) {
        parts.push(`Racial Traits: ${context.traits.join(', ')}`);
    }

    if (context.existingBackground && context.existingBackground.trim()) {
        parts.push(``, `The player has provided these notes to incorporate: "${context.existingBackground}"`);
    }

    parts.push(
        ``,
        `Guidelines:`,
        `- Write in third person`,
        `- Include a formative event that explains why they became a ${context.characterClass}`,
        `- Reference their ${context.race} heritage naturally`,
        `- Add a personal motivation or goal`,
        `- Keep it under 500 characters`,
        `- Be evocative but not cliché`,
        ``,
        `Respond ONLY with the backstory text, no headers or explanations.`
    );

    return parts.join('\n');
}
