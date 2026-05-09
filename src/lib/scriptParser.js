import { base44 } from '@/api/base44Client';

export async function parseScriptWithLLM(fileUrl, fileName, onProgress) {
  try {
    onProgress?.(10);

    const response = await fetch(fileUrl);
    const text = await response.text();
    onProgress?.(30);

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Extract characters and dialogue lines from this French script. Return a JSON object with:
{
  "characters": ["Character1", "Character2", ...],
  "lines": [
    {"character": "Character1", "text": "Dialogue text", "act": "1", "scene": "1"},
    ...
  ],
  "stats": {"total_lines": number, "total_characters": number}
}

Script content:
${text.substring(0, 8000)}`,
      response_json_schema: {
        type: 'object',
        properties: {
          characters: {
            type: 'array',
            items: { type: 'string' }
          },
          lines: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                character: { type: 'string' },
                text: { type: 'string' },
                act: { type: 'string' },
                scene: { type: 'string' }
              }
            }
          },
          stats: {
            type: 'object',
            properties: {
              total_lines: { type: 'number' },
              total_characters: { type: 'number' }
            }
          }
        }
      }
    });

    onProgress?.(80);

    return {
      characters: result.characters || [],
      lines: result.lines || [],
      stats: result.stats || {},
      rawText: text
    };
  } catch (error) {
    console.error('Error parsing script:', error);
    throw error;
  }
}

export async function verifyScriptIntegrity(rawText, parsedScript) {
  try {
    if (!parsedScript.lines || parsedScript.lines.length === 0) {
      return { valid: false, issues: ['No lines found'] };
    }

    if (!parsedScript.characters || parsedScript.characters.length === 0) {
      return { valid: false, issues: ['No characters found'] };
    }

    return { valid: true, issues: [] };
  } catch (error) {
    console.error('Error verifying script integrity:', error);
    return { valid: false, issues: [error.message] };
  }
}

export async function compareTexts(expectedText, spokenText) {
  try {
    const normalize = (text) =>
      text
        ?.toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, ' ') || '';

    const normalizedExpected = normalize(expectedText);
    const normalizedSpoken = normalize(spokenText);

    const expectedWords = normalizedExpected.split(' ').filter(w => w);
    const spokenWords = normalizedSpoken.split(' ').filter(w => w);

    const wordResults = [];
    let correctCount = 0;
    let missingCount = 0;
    let extraCount = 0;

    expectedWords.forEach((word, i) => {
      if (spokenWords[i] === word) {
        wordResults.push({ word, status: 'correct' });
        correctCount++;
      } else if (spokenWords[i]) {
        wordResults.push({ word, spokenWord: spokenWords[i], status: 'incorrect' });
      } else {
        wordResults.push({ word, status: 'missing' });
        missingCount++;
      }
    });

    spokenWords.slice(expectedWords.length).forEach((word) => {
      wordResults.push({ word, status: 'extra' });
      extraCount++;
    });

    const accuracy = expectedWords.length > 0
      ? Math.round((correctCount / expectedWords.length) * 100)
      : 0;

    return {
      accuracy,
      perfect: accuracy === 100 && missingCount === 0 && extraCount === 0,
      word_results: wordResults,
      correctCount,
      missingCount,
      extraCount
    };
  } catch (error) {
    console.error('Error comparing texts:', error);
    return {
      accuracy: 0,
      perfect: false,
      word_results: [],
      error: error.message
    };
  }
}