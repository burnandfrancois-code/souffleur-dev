import { base44 } from '@/api/base44Client';

export async function parseScriptWithLLM(fileUrl, fileName, onProgress, onLogs) {
  try {
    console.log(`[parseScriptWithLLM] Starting parse for: ${fileName}`);
    console.log(`[parseScriptWithLLM] File URL: ${fileUrl}`);
    onProgress?.(10);

    // Simulate progress during parsing (backend doesn't send updates)
    let simulatedProgress = 10;
    const progressInterval = setInterval(() => {
      simulatedProgress = Math.min(simulatedProgress + Math.random() * 5, 75);
      onProgress?.(simulatedProgress);
    }, 1000);

    // Appeler la vraie fonction backend parseScript avec timeout de 5 minutes
    const parsePromise = base44.functions.invoke('parseScript', {
      file_url: fileUrl,
      file_name: fileName
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Parsing timeout après 5 minutes')), 300000)
    );

    const result = await Promise.race([parsePromise, timeoutPromise]);

    clearInterval(progressInterval);
    onProgress?.(80);

    // Passer les logs au callback
    if (onLogs && result.data?.logs) {
      onLogs(result.data.logs);
    }

    console.log(`[parseScriptWithLLM] Parse successful: ${result.data?.characters?.length} characters, ${result.data?.lines?.length} lines`);

    return {
      characters: result.data?.characters || [],
      lines: result.data?.lines || [],
      stats: result.data?.stats || {},
      rawText: result.data?.rawText || '',
      logs: result.data?.logs || []
    };
  } catch (error) {
    console.error('[parseScriptWithLLM] Parse failed:', error);
    
    // Extract backend error message if available
    const backendError = error?.response?.data?.error || error?.message || 'Unknown error';
    console.error('[parseScriptWithLLM] Backend error:', backendError);
    
    throw new Error(backendError);
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
        wordResults.push({ word, status: 'correct', got: '' });
        correctCount++;
      } else if (spokenWords[i]) {
        wordResults.push({ word, status: 'wrong', got: spokenWords[i] });
      } else {
        wordResults.push({ word, status: 'missing', got: '' });
        missingCount++;
      }
    });

    spokenWords.slice(expectedWords.length).forEach((word) => {
      wordResults.push({ word, status: 'extra', got: word });
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