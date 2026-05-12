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

    const title = (file_name || '').replace(/\.[^.]+$/, '') || 'Sans titre';

    // ==========================================
    // UN SEUL APPEL LLM : extraction + parsing simultanés
    // Beaucoup plus rapide, évite les timeouts 502/504
    // ==========================================
    addLog('info', 'Analyse du script via LLM Vision (extraction + parsing en une passe)...');

    const rawResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are analysing a theatre script PDF. Do two things in one pass:
1. Extract ALL the text from every page.
2. Parse every dialogue line: identify character names (usually in CAPS or followed by a colon) and their spoken text.

Rules:
- Keep character names in CAPS.
- Remove stage directions (text in parentheses or brackets) from the spoken text.
- Keep the FULL spoken text, never truncate.
- Include every line from start to finish, in order.
- If the same character speaks several sentences in a row without interruption, keep them as ONE line entry.

Return ONLY valid JSON (no markdown, no explanation):
{"characters": ["NAME1", ...], "lines": [{"character": "NAME", "text": "full spoken text"}, ...]}`,
      file_urls: [file_url],
      model: 'claude_sonnet_4_6',
    });

    // Parse result - may be string or object depending on whether schema was used
    let result;
    if (typeof rawResult === 'object' && rawResult !== null && (rawResult.lines || rawResult.characters)) {
      result = rawResult;
    } else {
      const jsonMatch = String(rawResult).match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : { characters: [], lines: [] };
    }

    addLog('info', `LLM terminé: ${result?.characters?.length || 0} personnages, ${result?.lines?.length || 0} répliques`);

    // Nettoyer les personnages
    const allLines = [];
    const seenSigs = new Set();
    const cleanedChars = new Set();

    if (Array.isArray(result?.characters)) {
      result.characters.forEach(c => {
        const clean = (c || '').replace(/^@/, '').trim();
        if (clean) cleanedChars.add(clean);
      });
    }

    if (Array.isArray(result?.lines)) {
      result.lines.forEach(line => {
        if (line.character && line.text) {
          const sig = `${line.character}|${line.text.substring(0, 30)}`;
          if (!seenSigs.has(sig)) {
            seenSigs.add(sig);
            const cleanChar = (line.character || '').replace(/^@/, '').trim();
            cleanedChars.add(cleanChar);
            allLines.push({ character: cleanChar, text: line.text, act: '', scene: '' });
          }
        }
      });
    }

    addLog('info', `Consolidation finale: ${cleanedChars.size} personnages, ${allLines.length} répliques`);

    if (allLines.length === 0) {
      return Response.json({ error: 'Aucune réplique détectée. Vérifiez le format du fichier.', logs }, { status: 400 });
    }

    addLog('info', 'Analyse complète avec succès');

    return Response.json({
      title,
      characters: [...cleanedChars],
      lines: allLines,
      rawText: '',
      logs,
      stats: {
        originalLength: 0,
        parsedWordCount: allLines.map(l => l.text).join(' ').split(/\s+/).length,
        chunksProcessed: 1,
        chunksSuccessful: 1
      }
    });

  } catch (error) {
    addLog('error', `Erreur: ${error.message}`);
    return Response.json({ error: error.message, logs }, { status: 500 });
  }
});