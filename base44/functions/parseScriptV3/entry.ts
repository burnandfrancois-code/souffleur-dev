import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const logs = [];
  const addLog = (level, message) => {
    const timestamp = new Date().toLocaleTimeString('fr-CH', { hour12: false });
    logs.push({ level, message, timestamp });
    console.log(`[parseScriptV3] ${level.toUpperCase()}: ${message}`);
  };

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { file_url, file_name } = await req.json();
    if (!file_url) return Response.json({ error: 'file_url requis' }, { status: 400 });

    addLog('info', `Démarrage: ${file_name}`);
    const title = (file_name || '').replace(/\.[^.]+$/, '') || 'Sans titre';

    // ==========================================
    // ÉTAPE 1 : Extraction du texte brut via LLM Vision
    // ==========================================
    addLog('info', 'Étape 1: Extraction du texte brut...');

    const extractionResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Extract ALL the raw text from this theatre script PDF, page by page, maintaining the original layout as closely as possible.
- Keep character names exactly as they appear (usually CAPS or followed by colon/period).
- Keep all dialogue text.
- Keep stage directions in parentheses or brackets.
- Do NOT interpret or summarize - just extract raw text.
- Separate pages with "---PAGE---".
Return only the raw extracted text, nothing else.`,
      file_urls: [file_url],
      model: 'gemini_3_flash',
    });

    const rawText = typeof extractionResult === 'string' ? extractionResult : JSON.stringify(extractionResult);
    addLog('info', `Texte extrait: ${rawText.length} caractères`);

    if (!rawText || rawText.length < 100) {
      return Response.json({ error: 'Impossible d\'extraire le texte du fichier. Vérifiez que c\'est un PDF texte (pas une image).', logs }, { status: 400 });
    }

    // ==========================================
    // ÉTAPE 2 : Découper en chunks et parser en parallèle
    // ==========================================
    const CHUNK_SIZE = 12000;
    const OVERLAP = 300;
    const chunks = [];

    for (let i = 0; i < rawText.length; i += CHUNK_SIZE - OVERLAP) {
      chunks.push(rawText.substring(i, i + CHUNK_SIZE));
    }

    addLog('info', `Étape 2: Parsing en ${chunks.length} chunks...`);

    const PARSE_PROMPT = `Parse this French theatre script excerpt. Extract ALL spoken dialogue lines.

Rules:
- Character names appear in CAPS (e.g. "HAMLET", "LE CHIRURGIEN", "MARIE")
- Return character names in CAPS without trailing punctuation
- Remove stage directions (parentheses/brackets) from the spoken text
- Keep complete spoken text
- Skip scene titles, act titles, stage directions that are not dialogue

Return ONLY this JSON (no explanation, no markdown):
{"lines": [{"character": "NAME", "text": "spoken text"}, ...]}`;

    const parseChunk = async (chunk, idx) => {
      try {
        const rawStr = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: PARSE_PROMPT + `\n\n---\n${chunk}\n---`,
          model: 'claude_sonnet_4_6',
        });
        // rawStr is a string when no response_json_schema is provided
        let lines = [];
        try {
          const jsonMatch = String(rawStr).match(/\{[\s\S]*"lines"[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            lines = Array.isArray(parsed?.lines) ? parsed.lines : [];
          }
        } catch (parseErr) {
          addLog('warn', `Chunk ${idx + 1} JSON parse error: ${parseErr.message}`);
        }
        addLog('info', `Chunk ${idx + 1}/${chunks.length}: ${lines.length} répliques`);
        return lines;
      } catch (err) {
        addLog('warn', `Chunk ${idx + 1} échoué: ${err.message}`);
        return [];
      }
    };

    // Traiter les chunks par batch de 4 max en parallèle
    const BATCH_SIZE = 4;
    const allRawLines = [];
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map((chunk, j) => parseChunk(chunk, i + j)));
      results.forEach(lines => allRawLines.push(...lines));
    }

    // ==========================================
    // ÉTAPE 3 : Déduplication et consolidation
    // ==========================================
    addLog('info', `Étape 3: Déduplication (${allRawLines.length} répliques brutes)...`);

    const seenSigs = new Set();
    const cleanedChars = new Set();
    const finalLines = [];

    for (const line of allRawLines) {
      if (!line.character || !line.text) continue;
      const cleanChar = (line.character || '').replace(/^@/, '').replace(/[.:–\-]+$/, '').trim().toUpperCase();
      const cleanText = (line.text || '').trim();
      if (!cleanChar || !cleanText) continue;

      const sig = `${cleanChar}|${cleanText.substring(0, 40)}`;
      if (!seenSigs.has(sig)) {
        seenSigs.add(sig);
        cleanedChars.add(cleanChar);
        finalLines.push({ character: cleanChar, text: cleanText, act: '', scene: '' });
      }
    }

    addLog('info', `Résultat final: ${cleanedChars.size} personnages, ${finalLines.length} répliques`);

    if (finalLines.length === 0) {
      return Response.json({ error: 'Aucune réplique détectée. Vérifiez le format du fichier.', logs }, { status: 400 });
    }

    return Response.json({
      title,
      characters: [...cleanedChars],
      lines: finalLines,
      rawText: rawText.substring(0, 5000), // limité pour ne pas surcharger
      logs,
      stats: {
        originalLength: rawText.length,
        parsedWordCount: finalLines.map(l => l.text).join(' ').split(/\s+/).length,
        chunksProcessed: chunks.length,
        chunksSuccessful: chunks.length
      }
    });

  } catch (error) {
    addLog('error', `Erreur: ${error.message}`);
    return Response.json({ error: error.message, logs }, { status: 500 });
  }
});