import { base44 } from '@/api/base44Client';

export async function parseScriptWithLLM(fileUrl, fileName, onProgress, onLogs) {
  try {
    console.log(`[parseScriptWithLLM] Starting parse for: ${fileName}`);
    console.log(`[parseScriptWithLLM] File URL: ${fileUrl}`);
    onProgress?.(10);

    // Simulate progress during parsing (backend doesn't send updates)
    let simulatedProgress = 10;
    const progressInterval = setInterval(() => {
      simulatedProgress = Math.min(simulatedProgress + Math.random() * 1.2, 75);
      onProgress?.(simulatedProgress);
    }, 1500);

    // Appeler parseScriptV3 (extraction texte + parsing chunked, évite les timeouts 504)
    const parsePromise = base44.functions.invoke('parseScriptV3', {
      file_url: fileUrl,
      file_name: fileName
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout: analyse des répliques trop longue (>5min). Le fichier est peut-être trop gros ou contient trop de répliques.')), 300000)
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

// Encodage phonétique simplifié pour le français
function phoneticFR(word) {
  return word
    .toLowerCase()
    // Suppressions/remplacements phonétiques français
    .replace(/[aàâä]/g, 'a')
    .replace(/[eéèêë]/g, 'e')
    .replace(/[iîï]/g, 'i')
    .replace(/[oôö]/g, 'o')
    .replace(/[uùûü]/g, 'u')
    .replace(/[yÿ]/g, 'i')
    .replace(/ç/g, 's')
    .replace(/œ/g, 'e')
    .replace(/æ/g, 'e')
    // Sons similaires
    .replace(/ph/g, 'f')
    .replace(/ch/g, 'x')
    .replace(/gn/g, 'ni')
    .replace(/qu/g, 'k')
    .replace(/gu/g, 'g')
    .replace(/eau|au|o/g, 'o')
    .replace(/ain|ein|in|un/g, 'in')
    .replace(/an|en|am|em/g, 'an')
    .replace(/on|om/g, 'on')
    .replace(/tion/g, 'sion')
    .replace(/z/g, 's')
    .replace(/x/g, 's')
    // Consonnes finales muettes
    .replace(/[dst]$/g, '')
    .replace(/er$/g, 'e')
    .replace(/ez$/g, 'e')
    // Doubles consonnes
    .replace(/(.)\1+/g, '$1')
    // Supprimer les h
    .replace(/h/g, '')
    // Supprimer les e muets finaux
    .replace(/e$/g, '');
}

function wordsMatch(a, b) {
  if (a === b) return true;
  // Les mots très courts (≤2 lettres) doivent être exactement identiques
  if (a.length <= 2 || b.length <= 2) {
    return a === b;
  }
  // Tolérance préfixe pour mots moyens/longs (≥4 lettres)
  if (a.length >= 4 && b.startsWith(a)) return true;
  if (b.length >= 4 && a.startsWith(b)) return true;
  // Comparaison phonétique
  const pa = phoneticFR(a);
  const pb = phoneticFR(b);
  if (pa === pb) return true;
  // Distance de Levenshtein normalisée (tolérance ~25%)
  const maxLen = Math.max(pa.length, pb.length);
  if (maxLen === 0) return true;
  const dist = levenshtein(pa, pb);
  return dist / maxLen <= 0.25;
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = [];
  for (let i = 0; i <= m; i++) { dp[i] = [i]; }
  for (let j = 0; j <= n; j++) { dp[0][j] = j; }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

export async function compareTexts(expectedText, spokenText) {
  try {
    const normalize = (text) =>
      text
        ?.toLowerCase()
        .trim()
        .replace(/-/g, ' ')
        .replace(/[^\p{L}\p{N}\s]/gu, '')
        .replace(/\s+/g, ' ') || '';

    const normalizedExpected = normalize(expectedText);
    const normalizedSpoken = normalize(spokenText);

    const expectedWords = normalizedExpected.split(' ').filter(w => w);
    const spokenWords = normalizedSpoken.split(' ').filter(w => w);

    const m = expectedWords.length;
    const n = spokenWords.length;

    // LCS avec programmation dynamique
    const dp = [];
    for (let row = 0; row <= m; row++) {
      dp[row] = new Array(n + 1).fill(0);
    }
    for (let row = 1; row <= m; row++) {
      for (let col = 1; col <= n; col++) {
        if (wordsMatch(expectedWords[row - 1], spokenWords[col - 1])) {
          dp[row][col] = dp[row - 1][col - 1] + 1;
        } else {
          dp[row][col] = Math.max(dp[row - 1][col], dp[row][col - 1]);
        }
      }
    }

    // Reconstruire les indices matchés
    const matchedExpected = new Set();
    const matchedSpoken = new Set();
    let row = m, col = n;
    while (row > 0 && col > 0) {
      if (wordsMatch(expectedWords[row - 1], spokenWords[col - 1])) {
        matchedExpected.add(row - 1);
        matchedSpoken.add(col - 1);
        row--; col--;
      } else if (dp[row - 1][col] >= dp[row][col - 1]) {
        row--;
      } else {
        col--;
      }
    }

    // Construire word_results pour chaque mot attendu
    // Stratégie : aligner séquentiellement les mots spoken non-matchés sur les mots expected non-matchés.
    // Si un mot spoken non-matché est disponible → "faux" (peu importe la similarité).
    // Si plus aucun mot spoken non-matché disponible → "manquant".
    const unmatchedExpectedIndices = [];
    for (let ei = 0; ei < m; ei++) {
      if (!matchedExpected.has(ei)) unmatchedExpectedIndices.push(ei);
    }
    const unmatchedSpokenWords = [];
    for (let si = 0; si < n; si++) {
      if (!matchedSpoken.has(si)) unmatchedSpokenWords.push(spokenWords[si]);
    }

    // Assigner séquentiellement les mots spoken non-matchés aux mots expected non-matchés
    const wrongMap = new Map(); // ei -> spoken word string
    const unmatchedSpokenIndices = [];
    unmatchedExpectedIndices.forEach((ei, pos) => {
      if (pos < unmatchedSpokenWords.length) {
        wrongMap.set(ei, unmatchedSpokenWords[pos]);
        unmatchedSpokenIndices.push(pos);
      }
    });

    const wordResults = [];
    let correctCount = 0;

    for (let ei = 0; ei < m; ei++) {
      const word = expectedWords[ei];
      if (matchedExpected.has(ei)) {
        wordResults.push({ word, status: 'correct', got: '' });
        correctCount++;
      } else if (wrongMap.has(ei)) {
        wordResults.push({ word, status: 'wrong', got: wrongMap.get(ei) });
      } else {
        wordResults.push({ word, status: 'missing', got: '' });
      }
    }

    // Mots parlés non-matchés qui dépassent le nombre de mots attendus non-matchés
    const extraSpoken = unmatchedSpokenWords.slice(unmatchedExpectedIndices.length);

    // Convertir unmatchedSpokenIndices en indices globaux
    const globalUnmatchedSpokenIndices = [];
    for (let si = 0; si < n; si++) {
      if (!matchedSpoken.has(si)) {
        globalUnmatchedSpokenIndices.push(si);
      }
    }

    const missingCount = wordResults.filter(w => w.status === 'missing').length;
    const accuracy = m > 0 ? Math.round((correctCount / m) * 100) : 0;

    return {
      accuracy,
      perfect: accuracy === 100 && missingCount === 0,
      word_results: wordResults,
      correctCount,
      missingCount,
      extra_spoken: extraSpoken,
      extraCount: Math.max(0, n - matchedSpoken.size),
      unmatchedSpokenIndices: globalUnmatchedSpokenIndices
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