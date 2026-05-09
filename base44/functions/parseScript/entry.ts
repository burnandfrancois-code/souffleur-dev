import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const TIMEOUTS = {
  GLOBAL: 1800000,
  EXTRACT: 60000,
  LLM: 180000,
  CHUNK: 120000,
  SETTLE: 240000
};

Deno.serve(async (req) => {
  const logs = [];
  const addLog = (level, message) => {
    const timestamp = new Date().toLocaleTimeString('fr-CH', { hour12: false });
    logs.push({ level, message, timestamp });
    console.log(`[${timestamp}] [parseScript] ${level.toUpperCase()}: ${message}`);
  };

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url, file_name } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url requis' }, { status: 400 });

    const controller = new AbortController();
    const globalTimeout = setTimeout(() => controller.abort(), TIMEOUTS.GLOBAL);

    addLog('info', `Démarrage: ${file_name}`);

    let rawText = '';
    let extractionMethod = '';

    // ==========================================
    // STEP 2: EXTRACTION PHASE 1 (LLM VISION)
    // ==========================================
    addLog('info', 'Phase 1: Extraction du texte via LLM Vision');
    try {
      const extractController = new AbortController();
      const extractTimeout = setTimeout(() => extractController.abort(), TIMEOUTS.EXTRACT);
      
      addLog('info', 'Appel à InvokeLLM avec gemini_3_1_pro...');
      const extractResult = await Promise.race([
        base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Tu es un expert en transcription de pièces de théâtre. Extrais TOUT le texte du PDF, page par page, du début à la fin, sans rien omettre ni résumer.

INSTRUCTIONS CRITIQUES:
1. Extrait TOUT le texte visible du PDF - aucune partie ne doit être omise
2. Préserve exactement:
   - Les noms de personnages (généralement en MAJUSCULES)
   - Les didascalies (entre parenthèses ou crochets)
   - Tous les dialogues complets, même très longs
3. Maintiens l'ordre et la structure exactement comme dans le document

Retourne le texte intégral brut dans "raw_text" sans formatage supplémentaire.`,
          file_urls: [file_url],
          model: 'gemini_3_1_pro',
          response_json_schema: {
            type: 'object',
            properties: {
              raw_text: { type: 'string', description: 'Texte intégral du PDF, toutes pages' }
            }
          }
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('LLM timeout')), TIMEOUTS.LLM)
        )
      ]);

      clearTimeout(extractTimeout);
      rawText = extractResult?.raw_text || '';
      extractionMethod = 'llm_vision';
      addLog('info', `Phase 1 succès: ${rawText.length} caractères extraits via LLM`);
    } catch (extractErr) {
      addLog('error', `Phase 1 échouée: ${extractErr.message}`);
    }

    // ==========================================
    // STEP 3: VALIDATION
    // ==========================================

    // ==========================================
    // STEP 4: VALIDATION
    // ==========================================
    if (!rawText || rawText.length < 50) {
      clearTimeout(timeout);
      return Response.json(
        { error: 'Impossible de lire le fichier. Vérifiez que le PDF contient du texte sélectionnable.' },
        { status: 400 }
      );
    }

    let wasTruncated = false;
    if (rawText.length > 5000000) {
      rawText = rawText.substring(0, 5000000);
      wasTruncated = true;
      addLog('warn', `Texte tronqué à 5MB (original: ${rawText.length})`);
    }

    // ==========================================
    // STEP 5: CHUNKING ADAPTATIF
    // ==========================================
    const textSize = rawText.length;
    let CHUNK_SIZE, OVERLAP_PERCENT;

    if (textSize < 15000) {
      CHUNK_SIZE = textSize;
      OVERLAP_PERCENT = 0;
    } else if (textSize < 80000) {
      CHUNK_SIZE = 20000;
      OVERLAP_PERCENT = 0.05;
    } else if (textSize < 200000) {
      CHUNK_SIZE = 30000;
      OVERLAP_PERCENT = 0.08;
    } else {
      CHUNK_SIZE = 40000;
      OVERLAP_PERCENT = 0.1;
    }

    const OVERLAP = Math.ceil(CHUNK_SIZE * OVERLAP_PERCENT);
    const chunks = [];
    let pos = 0;

    while (pos < rawText.length) {
      const end = Math.min(pos + CHUNK_SIZE, rawText.length);
      chunks.push(rawText.slice(pos, end));
      if (end === rawText.length) break;
      pos = end - OVERLAP;
    }

    addLog('info', `Chunking: ${textSize} chars → ${chunks.length} chunks de ${CHUNK_SIZE}c`);

    // ==========================================
    // STEP 6: ANALYSE LLM PARALLÈLE
    // ==========================================
    let title = (file_name || '').replace(/\.[^.]+$/, '') || 'Sans titre';
    let allCharacters = new Set();
    let allLines = [];
    const seenLineSignatures = new Set();

    const CHUNK_TIMEOUT = TIMEOUTS.CHUNK;

    const chunkPromises = chunks.map((chunkText, ci) => {
      return Promise.race([
        base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Extract every dialogue line from this theatre script. Keep the COMPLETE text of each line — do NOT truncate or summarize.
Character names should be in CAPS. Remove stage directions in parentheses/brackets, but keep all dialogue text.
Return JSON with all lines found:
{characters: ["NAME1", "NAME2", ...], lines: [{character: "NAME", text: "complete dialogue text"}, ...]}

IMPORTANT: The "text" field must contain the FULL dialogue, no matter how long (30+ words is OK, 100+ words is OK).

${chunkText}`,
          response_json_schema: {
            type: 'object',
            properties: {
              characters: { type: 'array', items: { type: 'string' } },
              lines: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    character: { type: 'string' },
                    text: { type: 'string' }
                  }
                }
              }
            }
          }
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Chunk timeout`)), CHUNK_TIMEOUT)
        )
      ])
        .then(result => {
          console.log(`[parseScript] Chunk ${ci + 1}/${chunks.length} OK: ${result?.lines?.length || 0} lignes`);
          return { success: true, data: result, ci };
        })
        .catch(err => {
          console.warn(`[parseScript] Chunk ${ci + 1}/${chunks.length} erreur: ${err.message}`);
          return { success: false, ci };
        });
    });

    addLog('info', `Lancement de ${chunkPromises.length} chunks en parallèle...`);
    const settledPromise = Promise.allSettled(chunkPromises);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUTS.SETTLE)
    );

    let settled;
    try {
      settled = await Promise.race([settledPromise, timeoutPromise]);
    } catch (err) {
      if (err.message === 'TIMEOUT') {
        addLog('error', 'AllSettled timeout après 240s');
        clearTimeout(globalTimeout);
        return Response.json({ error: 'Parsing timeout - fichier trop grand', logs }, { status: 504 });
      }
      throw err;
    }

    addLog('info', `AllSettled complété avec ${settled.length} résultats`);
    const chunkResults = [];
    for (let i = 0; i < settled.length; i++) {
      const r = settled[i];
      if (r.status === 'fulfilled') {
        chunkResults.push(r.value);
        addLog('info', `Chunk ${r.value.ci + 1}/${chunks.length}: ${r.value.data?.lines?.length || 0} répliques`);
      } else {
        const errMsg = r.reason?.message || String(r.reason);
        addLog('error', `Chunk ${i + 1}/${chunks.length}: ${errMsg}`);
        chunkResults.push({ success: false, ci: i, data: null });
      }
    }

    const successCount = chunkResults.filter(r => r.success).length;
    addLog('info', `Résumé: ${successCount}/${chunkResults.length} chunks réussis`);

    // ==========================================
    // STEP 7: DÉDUPLICATION & CONSOLIDATION
    // ==========================================
    chunkResults
      .filter(r => r.success && r.data && r.ci >= 0)
      .sort((a, b) => a.ci - b.ci)
      .forEach((res) => {
        const result = res.data;

        if (Array.isArray(result?.characters)) {
          result.characters.forEach(c => {
            if (c) allCharacters.add(c);
          });
        }

        if (Array.isArray(result?.lines)) {
          result.lines.forEach(line => {
            if (line.character && line.text) {
              const sig = `${line.character}|${line.text.substring(0, 30)}`;
              if (!seenLineSignatures.has(sig)) {
                seenLineSignatures.add(sig);
                allLines.push({
                  character: line.character,
                  text: line.text,
                  act: '',
                  scene: ''
                });
              }
            }
          });
        }
      });

    allLines.forEach(l => {
      if (l.character) allCharacters.add(l.character);
    });

    // Nettoyer @ et trim
    const cleanedChars = new Set();
    allCharacters.forEach(c => {
      const clean = (c || '').replace(/^@/, '').trim();
      if (clean) cleanedChars.add(clean);
    });
    allCharacters = cleanedChars;

    addLog('info', `Consolidation: ${allCharacters.size} personnages, ${allLines.length} répliques`);

    // ==========================================
    // STEP 8: STATISTIQUES D'INTÉGRITÉ
    // ==========================================
    const originalWords = rawText
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 0);

    const parsedWords = allLines
      .map(l => l.text)
      .join(' ')
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 0);

    const originalWordSet = new Set(originalWords);
    const parsedWordSet = new Set(parsedWords);
    const capturedWords = originalWords.filter(w => parsedWordSet.has(w)).length;

    const originalLength = rawText.length;
    const parsedLength = parsedWords.join(' ').length;
    const captureRate = originalWords.length > 0 ? (capturedWords / originalWords.length) * 100 : 0;
    const wordDifference = Math.abs(originalWords.length - parsedWords.length);
    const percentDifference = originalWords.length > 0 ? (wordDifference / originalWords.length) * 100 : 0;

    // Top 20 missing words
    const missingWordMap = {};
    originalWords.forEach(w => {
      if (!parsedWordSet.has(w)) {
        missingWordMap[w] = (missingWordMap[w] || 0) + 1;
      }
    });
    const missingWords = Object.entries(missingWordMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word, count]) => ({ word, count }));

    // Top 20 extra words
    const extraWordMap = {};
    parsedWords.forEach(w => {
      if (!originalWordSet.has(w)) {
        extraWordMap[w] = (extraWordMap[w] || 0) + 1;
      }
    });
    const extraWords = Object.entries(extraWordMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word, count]) => ({ word, count }));

    clearTimeout(globalTimeout);

    if (wasTruncated) {
      addLog('warn', '⚠️ Texte tronqué: Le PDF dépassait 5MB.');
    }

    if (allLines.length === 0 && allCharacters.size === 0) {
      addLog('error', 'Aucune réplique détectée');
      return Response.json(
        { error: 'Aucune réplique détectée. Vérifiez le format du fichier.', logs },
        { status: 400 }
      );
    }

    addLog('info', 'Succès: Analyse complète');

    return Response.json({
      title,
      characters: [...allCharacters],
      lines: allLines,
      rawText: rawText,
      wasTruncated: wasTruncated,
      extractionMethod: extractionMethod,
      logs,
      stats: {
        originalLength,
        parsedLength,
        originalWordCount: originalWords.length,
        parsedWordCount: parsedWords.length,
        capturedWordCount: capturedWords,
        captureRate: captureRate.toFixed(1),
        wordDifference,
        percentDifference: percentDifference.toFixed(2),
        missingWords,
        extraWords,
        chunksProcessed: chunks.length,
        chunksSuccessful: successCount
      }
    });
  } catch (error) {
    addLog('error', `Erreur inattendue: ${error.message}`);
    return Response.json({ error: error.message, logs }, { status: 500 });
  }
});