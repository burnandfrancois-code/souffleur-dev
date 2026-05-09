import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url, file_name } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url requis' }, { status: 400 });

    const timeoutMs = 1800000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    console.log(`[parseScript] Démarrage: ${file_name}`);

    let rawText = '';
    let extractionMethod = '';

    // ==========================================
    // STEP 2: EXTRACTION PHASE 1 (FAST)
    // ==========================================
    console.log('[parseScript] Phase 1: ExtractDataFromUploadedFile...');
    try {
      const fileResponse = await fetch(file_url);
      if (!fileResponse.ok) {
        throw new Error(`Failed to fetch file: ${fileResponse.status}`);
      }
      const fileBuffer = await fileResponse.arrayBuffer();
      const fileBlob = new Blob([fileBuffer], { type: 'application/pdf' });
      
      const extracted = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
        file: fileBlob,
        json_schema: {
          type: 'object',
          properties: {
            raw_text: {
              type: 'string',
              description: 'Tout le texte brut du document intégral'
            }
          }
        }
      });

      if (extracted?.status === 'success' && extracted?.output?.raw_text && extracted.output.raw_text.length > 50) {
        rawText = extracted.output.raw_text;
        extractionMethod = 'extract';
        console.log(`[parseScript] Phase 1 succès: ${rawText.length} chars`);
      }
    } catch (extractErr) {
      console.warn('[parseScript] Phase 1 échouée:', extractErr.message);
    }

    // ==========================================
    // STEP 3: EXTRACTION PHASE 2 (FALLBACK - LLM VISION)
    // ==========================================
    if (!rawText || rawText.length < 50) {
      console.log('[parseScript] Phase 2: LLM Vision (fallback)...');
      try {
        const fileResponse = await fetch(file_url);
        if (!fileResponse.ok) {
          throw new Error(`Failed to fetch file: ${fileResponse.status}`);
        }
        const fileBuffer = await fileResponse.arrayBuffer();
        const fileBlob = new Blob([fileBuffer], { type: 'application/pdf' });
        
        const extractResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Tu es un expert en transcription de pièces de théâtre. Extrais TOUT le texte du PDF, page par page, du début à la fin, sans rien omettre ni résumer.

INSTRUCTIONS CRITIQUES:
1. Extrait TOUT le texte visible du PDF - aucune partie ne doit être omise
2. Préserve exactement:
   - Les noms de personnages (généralement en MAJUSCULES)
   - Les didascalies (entre parenthèses ou crochets)
   - Tous les dialogues complets, même très longs
3. Maintiens l'ordre et la structure exactement comme dans le document
4. Si c'est un scan image, utilise la reconnaissance optique de caractères (OCR)

Retourne le texte intégral brut dans "raw_text" sans formatage supplémentaire.`,
          file_urls: [fileBlob],
          model: 'gemini_3_1_pro',
          response_json_schema: {
            type: 'object',
            properties: {
              raw_text: { type: 'string', description: 'Texte intégral du PDF, toutes pages' }
            }
          }
        });

        rawText = extractResult?.raw_text || '';
        extractionMethod = 'llm_vision';
        console.log(`[parseScript] Phase 2 succès: ${rawText.length} chars`);
      } catch (llmErr) {
        console.warn('[parseScript] Phase 2 échouée:', llmErr.message);
        return Response.json(
          { error: 'Impossible de lire le fichier PDF. Vérifiez que le PDF contient du texte sélectionnable (pas un scan image).' },
          { status: 400 }
        );
      }
    }

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
      console.log(`[parseScript] Texte tronqué à 5MB`);
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

    console.log(`[parseScript] Texte: ${textSize} chars → ${chunks.length} chunks de ${CHUNK_SIZE}c (overlap ${OVERLAP}c)`);

    // ==========================================
    // STEP 6: ANALYSE LLM PARALLÈLE
    // ==========================================
    let title = (file_name || '').replace(/\.[^.]+$/, '') || 'Sans titre';
    let allCharacters = new Set();
    let allLines = [];
    const seenLineSignatures = new Set();

    const CHUNK_TIMEOUT = 120000;

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

    console.log(`[parseScript] Lancement de ${chunkPromises.length} chunks en parallèle...`);
    const settledPromise = Promise.allSettled(chunkPromises);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 240000)
    );

    let settled;
    try {
      settled = await Promise.race([settledPromise, timeoutPromise]);
    } catch (err) {
      if (err.message === 'TIMEOUT') {
        console.error('[parseScript] AllSettled timeout après 240s');
        clearTimeout(timeout);
        return Response.json({ error: 'Parsing timeout - fichier trop grand' }, { status: 504 });
      }
      throw err;
    }

    console.log(`[parseScript] AllSettled complété avec ${settled.length} résultats`);
    const chunkResults = [];
    for (let i = 0; i < settled.length; i++) {
      const r = settled[i];
      if (r.status === 'fulfilled') {
        chunkResults.push(r.value);
        console.log(`[parseScript]   → Chunk ${r.value.ci + 1} succès`);
      } else {
        console.warn(`[parseScript]   → Chunk ${i + 1} rejeté: ${r.reason?.message || String(r.reason)}`);
        chunkResults.push({ success: false, ci: i, data: null });
      }
    }

    const successCount = chunkResults.filter(r => r.success).length;
    console.log(`[parseScript] ${successCount}/${chunkResults.length} chunks réussis`);

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

    console.log(`[parseScript] FINAL: ${allCharacters.size} personnages, ${allLines.length} répliques, ${rawText.length} chars`);

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

    clearTimeout(timeout);

    if (wasTruncated) {
      console.warn('[parseScript] ⚠️ TEXTE TRONQUÉ: Le PDF dépassait 5MB. Les dernières parties n\'ont pas été traitées.');
    }

    if (allLines.length === 0 && allCharacters.size === 0) {
      return Response.json(
        { error: 'Aucune réplique détectée. Vérifiez le format du fichier.' },
        { status: 400 }
      );
    }

    return Response.json({
      title,
      characters: [...allCharacters],
      lines: allLines,
      rawText: rawText,
      wasTruncated: wasTruncated,
      extractionMethod: extractionMethod,
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
    console.error('[parseScript] Erreur inattendue:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});