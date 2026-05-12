import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const logs = [];
  const addLog = (level, message) => {
    const timestamp = new Date().toLocaleTimeString('fr-CH', { hour12: false });
    logs.push({ level, message, timestamp });
    console.log(`[parseScriptV2] ${level.toUpperCase()}: ${message}`);
  };

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url, file_name } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url requis' }, { status: 400 });

    addLog('info', `Démarrage: ${file_name}`);

    // ==========================================
    // STEP 1: EXTRACTION DU TEXTE VIA LLM VISION
    // ==========================================
    addLog('info', 'Phase 1: Extraction du texte via LLM Vision');
    let rawText = '';

    const extractResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Extract ALL text from this theatre script PDF, page by page, from start to end. Keep everything as-is: character names (usually CAPS), stage directions in parentheses/brackets, all dialogues complete. Return only raw text in "raw_text" field with no formatting.`,
      file_urls: [file_url],
      response_json_schema: {
        type: 'object',
        properties: { raw_text: { type: 'string' } }
      }
    });

    rawText = extractResult?.raw_text || '';
    addLog('info', `Extraction: ${rawText.length} caractères`);

    if (!rawText || rawText.length < 50) {
      return Response.json({ error: 'Impossible de lire le fichier. Vérifiez que le PDF contient du texte sélectionnable.', logs }, { status: 400 });
    }

    // Tronquer si nécessaire
    if (rawText.length > 4000000) {
      rawText = rawText.substring(0, 4000000);
      addLog('warn', 'Texte tronqué à 4MB');
    }

    // ==========================================
    // STEP 2: CHUNKING ADAPTATIF
    // ==========================================
    const textSize = rawText.length;
    let CHUNK_SIZE;
    if (textSize < 15000) CHUNK_SIZE = textSize;
    else if (textSize < 80000) CHUNK_SIZE = 25000;
    else if (textSize < 200000) CHUNK_SIZE = 35000;
    else CHUNK_SIZE = 50000;

    const OVERLAP = Math.ceil(CHUNK_SIZE * 0.05);
    const chunks = [];
    let pos = 0;
    while (pos < rawText.length) {
      const end = Math.min(pos + CHUNK_SIZE, rawText.length);
      chunks.push(rawText.slice(pos, end));
      if (end === rawText.length) break;
      pos = end - OVERLAP;
    }

    addLog('info', `Chunking: ${textSize} chars → ${chunks.length} chunks`);

    // ==========================================
    // STEP 3: ANALYSE LLM SÉQUENTIELLE (évite les timeouts serveur)
    // ==========================================
    let allCharacters = new Set();
    let allLines = [];
    const seenLineSignatures = new Set();
    let title = (file_name || '').replace(/\.[^.]+$/, '') || 'Sans titre';

    for (let ci = 0; ci < chunks.length; ci++) {
      addLog('info', `Analyse chunk ${ci + 1}/${chunks.length}...`);
      try {
        const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Extract every dialogue line from this theatre script chunk. Keep the COMPLETE text of each line.
Character names should be in CAPS. Remove stage directions in parentheses/brackets, but keep all dialogue text.
Return JSON: {characters: ["NAME1", ...], lines: [{character: "NAME", text: "complete dialogue text"}, ...]}
IMPORTANT: Keep FULL dialogue text, no truncation.

${chunks[ci]}`,
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
        });

        if (Array.isArray(result?.characters)) {
          result.characters.forEach(c => { if (c) allCharacters.add(c); });
        }
        if (Array.isArray(result?.lines)) {
          result.lines.forEach(line => {
            if (line.character && line.text) {
              const sig = `${line.character}|${line.text.substring(0, 30)}`;
              if (!seenLineSignatures.has(sig)) {
                seenLineSignatures.add(sig);
                allLines.push({ character: line.character, text: line.text, act: '', scene: '' });
              }
            }
          });
        }

        addLog('info', `Chunk ${ci + 1}: ${result?.lines?.length || 0} répliques`);
      } catch (chunkErr) {
        addLog('error', `Chunk ${ci + 1} échoué: ${chunkErr.message}`);
      }
    }

    // Nettoyer les personnages
    const cleanedChars = new Set();
    allCharacters.forEach(c => {
      const clean = (c || '').replace(/^@/, '').trim();
      if (clean) cleanedChars.add(clean);
    });
    allLines.forEach(l => { if (l.character) cleanedChars.add(l.character); });

    addLog('info', `Consolidation: ${cleanedChars.size} personnages, ${allLines.length} répliques`);

    if (allLines.length === 0) {
      return Response.json({ error: 'Aucune réplique détectée. Vérifiez le format du fichier.', logs }, { status: 400 });
    }

    addLog('info', 'Analyse complète avec succès');

    return Response.json({
      title,
      characters: [...cleanedChars],
      lines: allLines,
      rawText,
      logs,
      stats: {
        originalLength: rawText.length,
        parsedWordCount: allLines.map(l => l.text).join(' ').split(/\s+/).length,
        chunksProcessed: chunks.length,
        chunksSuccessful: chunks.length
      }
    });

  } catch (error) {
    addLog('error', `Erreur: ${error.message}`);
    return Response.json({ error: error.message, logs }, { status: 500 });
  }
});