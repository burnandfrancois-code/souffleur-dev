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

    console.log('[parseScript] Téléchargement du PDF...');
    let pdfContent;
    try {
      const pdfResponse = await fetch(file_url, { signal: controller.signal });
      const pdfBuffer = await pdfResponse.arrayBuffer();
      pdfContent = Buffer.from(pdfBuffer).toString('base64');
      console.log(`[parseScript] PDF téléchargé: ${pdfContent.length} chars base64`);
    } catch (dlErr) {
      console.warn('[parseScript] Téléchargement PDF échoué:', dlErr.message);
      return Response.json(
        { error: 'Impossible de télécharger le fichier PDF.' },
        { status: 400 }
      );
    }

    console.log('[parseScript] Extraction via LLM vision (Gemini 3.1 Pro)...');
    try {
      const extractResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Tu es un expert en transcription de pièces de théâtre au format PDF. Lis le PDF en pièce jointe et extrais INTÉGRALEMENT le texte, page par page, du début à la fin.

INSTRUCTIONS CRITIQUES:
1. Extrait TOUT le texte visible du PDF - aucune partie ne doit être omise
2. Préserve exactement:
   - Les noms de personnages (généralement en MAJUSCULES)
   - Les didascalies (entre parenthèses ou crochets)
   - Tous les dialogues complets, même très longs
3. Maintiens l'ordre et la structure exactement comme dans le document
4. Si c'est un scan image, utilise la reconnaissance optique de caractères (OCR)

Retourne le texte intégral brut dans "raw_text" sans formatage supplémentaire.`,
        file_urls: [`data:application/pdf;base64,${pdfContent}`],
        model: 'gemini_3_1_pro',
        response_json_schema: {
          type: 'object',
          properties: {
            raw_text: { type: 'string', description: 'Texte intégral du PDF, toutes pages' }
          }
        }
      });

      rawText = extractResult?.raw_text || '';
      console.log(`[parseScript] Texte extrait via LLM vision: ${rawText.length} chars`);
    } catch (llmErr) {
      console.warn('[parseScript] LLM vision échoué:', llmErr.message);
      return Response.json(
        { error: 'Impossible de lire le fichier PDF. Vérifiez que le PDF contient du texte sélectionnable (pas un scan image).' },
        { status: 400 }
      );
    }

    if (!rawText || rawText.length < 50) {
      clearTimeout(timeout);
      return Response.json(
        { error: 'Impossible de lire le fichier. Vérifiez que le PDF contient du texte sélectionnable (pas un scan image).' },
        { status: 400 }
      );
    }

    let wasTruncated = false;
    if (rawText.length > 5000000) {
      rawText = rawText.substring(0, 5000000);
      wasTruncated = true;
      console.log(`[parseScript] Texte tronqué à 5MB`);
    }

    const textSize = rawText.length;
    let CHUNK_SIZE;
    let OVERLAP_PERCENT;
    
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
          console.log(`[parseScript] Chunk ${ci + 1} OK: ${result?.lines?.length || 0} lignes`);
          return { success: true, data: result, ci };
        })
        .catch(err => {
          console.warn(`[parseScript] Chunk ${ci + 1} erreur: ${err.message}`);
          return { success: false, ci };
        });
    });

    console.log(`[parseScript] Lancement de ${chunkPromises.length} chunks en parallèle...`);
    const settledPromise = Promise.allSettled(chunkPromises);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 240000));
    
    let settled;
    try {
      settled = await Promise.race([settledPromise, timeoutPromise]);
    } catch (err) {
      if (err.message === 'TIMEOUT') {
        console.error('[parseScript] AllSettled timeout après 240s');
        return Response.json({ error: 'Parsing timeout - fichier trop grand' }, { status: 504 });
      }
      throw err;
    }
    console.log(`[parseScript] AllSettled complété avec ${settled.length} résultats`);
    const chunkResults = [];
    for (let i = 0; i < settled.length; i++) {
      const r = settled[i];
      console.log(`[parseScript] Processing result ${i}: status=${r.status}`);
      if (r.status === 'fulfilled') {
        chunkResults.push(r.value);
        console.log(`[parseScript]   → Chunk ${r.value.ci} succès`);
      } else {
        console.warn(`[parseScript]   → Chunk ${i} rejeté: ${r.reason?.message || String(r.reason)}`);
        chunkResults.push({ success: false, ci: i, data: null });
      }
    }
    console.log(`[parseScript] ${chunkResults.filter(r => r.success).length}/${chunkResults.length} chunks réussis`);

    const chunkAnalysis = [];
    chunkResults
     .filter(r => r.success && r.data && r.ci >= 0)
     .sort((a, b) => a.ci - b.ci)
     .forEach((res) => {
       const result = res.data;
       const idx = res.ci;

       if (idx === 0 && result?.title) title = result.title;

       if (Array.isArray(result?.characters)) {
         result.characters.forEach(c => { if (c) allCharacters.add(c); });
       }

       let linesInChunk = 0;
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
               linesInChunk++;
             }
           }
         });
       }
       console.log(`[parseScript] Chunk ${idx} OK: ${linesInChunk} nouvelles répliques (total: ${result?.lines?.length || 0} brutes)`);
       chunkAnalysis.push({ chunk: idx, extracted: result?.lines?.length || 0, dedup: linesInChunk });
     });

    allLines.forEach(l => { if (l.character) allCharacters.add(l.character); });

    const cleanedChars = new Set();
    allCharacters.forEach(c => {
      const clean = (c || '').replace(/^@/, '').trim();
      if (clean) cleanedChars.add(clean);
    });
    allCharacters = cleanedChars;

    console.log(`[parseScript] FINAL: ${allCharacters.size} personnages, ${allLines.length} répliques, ${rawText.length} chars`);

    clearTimeout(timeout);
    
    if (wasTruncated) {
      console.warn('[parseScript] ⚠️ TEXTE TRONQUÉ: Le PDF dépassait 500KB. Les dernières parties n\'ont pas été traitées.');
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
      wasTruncated: wasTruncated
    });

  } catch (error) {
    console.error('[parseScript] Erreur inattendue:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});