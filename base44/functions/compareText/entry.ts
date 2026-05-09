import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

function stripPunctuation(text) {
  return text.replace(/[.,;:!?«»"''""\-–—…()[\]]/g, '').replace(/\s+/g, ' ').trim();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { expected, spoken } = await req.json();
    
    if (!expected) {
      return Response.json({ error: 'expected text required' }, { status: 400 });
    }

    const cleanExpected = stripPunctuation(expected);
    const cleanSpoken = stripPunctuation(spoken || '');

    console.log('[compareText] Request:', { 
      expectedLength: cleanExpected.length,
      spokenLength: cleanSpoken.length,
      userId: user.email,
      areIdentical: cleanExpected === cleanSpoken
    });

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Tu es un assistant de répétition théâtrale. Compare TRÈS ATTENTIVEMENT ce que l'acteur a dit avec le texte original.

TEXTE ORIGINAL: "${cleanExpected}"
TEXTE DIT PAR L'ACTEUR: "${cleanSpoken}"

ANALYSE DÉTAILLÉE REQUISE :
1. Pour CHAQUE mot du texte original (dans l'ordre exact):
   - "correct" : mot présent et identique (ignorer casse/accents/apostrophes)
   - "phonetic" : phonétiquement très proche mais orthographe différente
   - "wrong" : mot DIFFÉRENT (mets EXACTEMENT le mot réel prononcé dans "got")
   - "missing" : mot ABSENT de la parole de l'acteur

2. CAPTURE TOUS LES MOTS FAUX - AUCUN NE DOIT ÊTRE OUBLIÉ:
   - Chaque mot mal dit = une entrée "wrong" avec le mot réel dans "got"
   - Les mots supplémentaires (non dans l'original) → les inclure dans "got"
   - Vérifier 2-3 fois qu'aucun mot faux n'est manquant

3. RÈGLES ABSOLUES:
   - 1 entrée = 1 mot original (structure fixe)
   - TOUS les mots du texte original, dans l'ordre exact
   - Chaque mot a EXACTEMENT 1 statut (correct/phonetic/wrong/missing)
   - "got" = EXACTEMENT le(s) mot(s) réellement prononcé(s) si status="wrong"
   - Ne JAMAIS inventer, utiliser EXACTEMENT ce qui a été dit

EXEMPLES:
- Original: "bonjour monde" | Dit: "bon jour monde"
  → [{word:"bonjour", status:"wrong", got:"bon jour"}, {word:"monde", status:"correct"}]

- Original: "hello world" | Dit: "hello beautiful world"
  → [{word:"hello", status:"correct"}, {word:"world", status:"wrong", got:"beautiful world"}]`,
      response_json_schema: {
        type: "object",
        properties: {
          accuracy: { type: "number" },
          perfect: { type: "boolean" },
          word_results: {
            type: "array",
            items: {
              type: "object",
              properties: {
                word: { type: "string" },
                status: { type: "string" },
                got: { type: "string" }
              }
            }
          },
          feedback: { type: "string" }
        }
      }
    });

    if (result?.word_results && result.word_results.length > 0) {
      const nonMissing = result.word_results.filter(w => w.status !== 'missing');
      const missing = result.word_results.filter(w => w.status === 'missing');
      result.word_results = [...nonMissing, ...missing];
      
      const totalWords = result.word_results.length;
      const correctCount = result.word_results.filter(w => w.status === 'correct' || w.status === 'phonetic').length;
      result.accuracy = totalWords > 0 ? Math.round((correctCount / totalWords) * 100) : 0;
      result.perfect = result.word_results.every(w => w.status === 'correct' || w.status === 'phonetic');
    }

    console.log('[compareText] LLM response:', {
      accuracy: result?.accuracy,
      perfect: result?.perfect,
      wordCount: result?.word_results?.length || 0
    });

    return Response.json(result);
  } catch (error) {
    console.error('[compareText] Error:', error.message);
    return Response.json({ error: error?.message || 'Analysis failed' }, { status: 500 });
  }
});