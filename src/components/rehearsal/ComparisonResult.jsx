import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertTriangle, XCircle, RotateCcw } from 'lucide-react';

export default function ComparisonResult({ result, onRetry, onContinue }) {
  if (!result) return null;

  const wordResults = (result.word_results || []).map(w => ({ ...w, got: w.got || '' }));
  const wrongWords   = wordResults.map((w, i) => ({ ...w, _idx: i })).filter(w => w.status === 'wrong');
  const missingWords = wordResults.map((w, i) => ({ ...w, _idx: i })).filter(w => w.status === 'missing');

  // Tous les mots parlés non-matchés : ceux associés aux wrong + les extras
  const spokenUnmatched = [
    ...wrongWords.map(w => w.got).filter(Boolean),
    ...(result.extra_spoken || [])
  ];
  const hasWrongOrExtra = spokenUnmatched.length > 0;

  const isPerfect       = result.perfect;
  const accuracy        = result.accuracy || 0;
  const hasMissingWords = missingWords.length > 0;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className={`rounded-2xl border-2 p-6 space-y-4 bg-black ${
        isPerfect ? 'border-green-500/40' : 'border-primary/40'
      }`}>
        {/* Score */}
        <div className="flex items-center justify-center gap-3">
          {isPerfect ? (
            <CheckCircle className="w-8 h-8 text-green-500" />
          ) : accuracy >= 70 ? (
            <AlertTriangle className="w-8 h-8 text-primary" />
          ) : (
            <XCircle className="w-8 h-8 text-destructive" />
          )}
          <span className="text-3xl font-bold text-foreground">{Math.round(accuracy)}%</span>
        </div>

        {/* Feedback */}
        {result.feedback && (
          <p className="text-muted-foreground text-center text-sm">{result.feedback}</p>
        )}

        {/* Texte complet avec points d'erreur */}
        {wordResults.length > 0 && (() => {
          // Regrouper les mots consécutifs en blocs
          const blocks = [];
          wordResults.forEach((w, i) => {
            const status = (w.status === 'correct' || w.status === 'phonetic') ? 'correct' : w.status;
            const last = blocks[blocks.length - 1];
            if (last && last.status === status) {
              last.words.push(w);
            } else {
              blocks.push({ status, words: [w] });
            }
          });
          return (
            <div style={{ borderRadius: '12px', border: '1px solid rgba(74,222,128,0.4)', backgroundColor: 'rgba(20,83,45,0.7)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.08em' }}>✓ Votre texte</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                {blocks.map((block, bi) => {
                  if (block.status === 'correct') {
                    return (
                      <React.Fragment key={bi}>
                        {block.words.map((w, wi) => (
                          <span key={wi} style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.875rem', fontWeight: 500, backgroundColor: 'rgba(74,222,128,0.25)', color: '#bbf7d0', border: '1px solid rgba(74,222,128,0.5)' }}>
                            {w.word}
                          </span>
                        ))}
                      </React.Fragment>
                    );
                  } else if (block.status === 'wrong') {
                    return (
                      <span key={bi} title={block.words.map(w => `Dit : "${w.got}" au lieu de "${w.word}"`).join(' | ')} style={{ display: 'inline-flex', gap: '2px', alignItems: 'center' }}>
                        {block.words.map((w, wi) => (
                          <React.Fragment key={wi}>
                            <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444', flexShrink: 0 }} />
                            <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#eab308', flexShrink: 0 }} />
                          </React.Fragment>
                        ))}
                      </span>
                    );
                  } else {
                    return (
                      <span key={bi} title={block.words.map(w => `Manquant : "${w.word}"`).join(' | ')} style={{ display: 'inline-flex', gap: '3px', alignItems: 'center' }}>
                        {block.words.map((w, wi) => (
                          <span key={wi} style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#eab308', flexShrink: 0 }} />
                        ))}
                      </span>
                    );
                  }
                })}
              </div>
            </div>
          );
        })()}

        {/* Mots faux */}
        {hasWrongOrExtra && (
          <div className="rounded-xl border border-red-500/40 bg-red-950/60 p-3 space-y-2">
            <p className="text-xs font-bold text-red-400 uppercase tracking-wider">✗ Faux — vous avez dit :</p>
            <div className="flex flex-wrap gap-1.5 items-center">
              {spokenUnmatched.map((word, i) => {
                const isGap = i > 0 && result.unmatchedSpokenIndices && 
                  (result.unmatchedSpokenIndices[i] - result.unmatchedSpokenIndices[i - 1] > 1);
                return (
                  <React.Fragment key={i}>
                    {isGap && <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#4ade80', flexShrink: 0 }} />}
                    <span className="px-2 py-0.5 rounded-md text-sm font-medium bg-red-500/30 text-red-200 border border-red-400/50">
                      {word}
                    </span>
                  </React.Fragment>
                );
              })}
            </div>
            {wrongWords.length > 0 && (
              <p className="text-xs text-gray-400">
                Attendu : <span className="text-gray-200 italic">{wrongWords.map(w => w.word).join(', ')}</span>
              </p>
            )}
          </div>
        )}

        {/* Mots manquants (missing + attendus des wrong) */}
        {(missingWords.length > 0 || wrongWords.length > 0) && (
          <div className="rounded-xl border border-yellow-500/40 bg-yellow-950/60 p-3 space-y-2">
            <p className="text-xs font-bold text-yellow-400 uppercase tracking-wider">— Attendu mais absent / faux</p>
            <div className="flex flex-wrap gap-1.5 items-center">
              {wordResults.map((w, i) => {
                if (w.status === 'wrong' || w.status === 'missing') {
                  const prevW = i > 0 ? wordResults[i - 1] : null;
                  const isGap = prevW && prevW.status !== 'wrong' && prevW.status !== 'missing';
                  return (
                    <React.Fragment key={i}>
                      {isGap && i > 0 && <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#4ade80', flexShrink: 0 }} />}
                      <span className={`px-2 py-0.5 rounded-md text-sm font-medium border line-through ${
                        w.status === 'wrong'
                          ? 'bg-red-500/10 text-yellow-200 border-yellow-400/30'
                          : 'bg-yellow-500/20 text-yellow-200 border-yellow-400/50'
                      }`}>
                        {w.word}
                      </span>
                    </React.Fragment>
                  );
                }
                return null;
              })}
            </div>
          </div>
        )}

        {/* Hint vocal */}
        <p className="text-center text-xs text-muted-foreground italic">
          Dites <span className="text-primary font-semibold not-italic">"passer"</span> pour continuer ou <span className="text-yellow-400 font-semibold not-italic">"réessayer"</span>
        </p>

        {/* Boutons */}
        <div className="flex gap-3 justify-center pt-2">
          <Button variant="outline" onClick={onRetry} className="gap-2 text-yellow-400 border-yellow-400/50 hover:text-yellow-300">
            <RotateCcw className="w-4 h-4" />
            Réessayer
          </Button>
          <Button onClick={onContinue} className="bg-primary text-primary-foreground gap-2">
            {isPerfect && !hasMissingWords ? 'Réplique suivante' : 'Passer quand même'}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}