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
        .replace(/[^\wàâäéèêëîïôùûüç\s]/g, '')
        .replace(/\s+/g, ' ') || '';

    const normalizedExpected = normalize(expectedText);
    const normalizedSpoken = normalize(spokenText);

    const expectedWords = normalizedExpected.split(' ').filter(w => w);
    const spokenWords = normalizedSpoken.split(' ').filter(w => w);

    // LCS — trouver les mots communs dans le bon ordre
    const m = expectedWords.length;
    const n = spokenWords.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (expectedWords[i - 1] === spokenWords[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // Reconstruire l'alignement
    const matchedExpected = new Set();
    const matchedSpoken = new Set();
    let i = m, j = n;
    while (i > 0 && j > 0) {
      if (expectedWords[i - 1] === spokenWords[j - 1]) {
        matchedExpected.add(i - 1);
        matchedSpoken.add(j - 1);
        i--; j--;
      } else if (dp[i - 1][j] >= dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }

    // Construire les résultats mot par mot pour les mots attendus
    // Pour les mots non matchés dans expected, on cherche le mot spoken le plus proche non utilisé
    const usedSpoken = new Set([...matchedSpoken]);
    const wordResults = [];
    let correctCount = 0;

    expectedWords.forEach((word, ei) => {
      if (matchedExpected.has(ei)) {
        wordResults.push({ word, status: 'correct', got: '' });
        correctCount++;
      } else {
        // Chercher le mot spoken non utilisé le plus proche
        let bestIdx = -1;
        for (let si = 0; si < spokenWords.length; si++) {
          if (!usedSpoken.has(si)) { bestIdx = si; break; }
        }
        if (bestIdx !== -1) {
          usedSpoken.add(bestIdx);
          wordResults.push({ word, status: 'wrong', got: spokenWords[bestIdx] });
        } else {
          wordResults.push({ word, status: 'missing', got: '' });
        }
      }
    });

    const missingCount = wordResults.filter(w => w.status === 'missing').length;
    const extraCount = spokenWords.length - matchedSpoken.size - (wordResults.filter(w => w.status === 'wrong').length);

    const accuracy = m > 0 ? Math.round((correctCount / m) * 100) : 0;

    return {
      accuracy,
      perfect: accuracy === 100 && missingCount === 0,
      word_results: wordResults,
      correctCount,
      missingCount,
      extraCount: Math.max(0, extraCount)
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