import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertTriangle, XCircle, RotateCcw } from 'lucide-react';

export default function ComparisonResultAndroid({ result, onRetry, onContinue }) {
  if (!result) return null;

  const wordResults = (result.word_results || []).map(w => ({ ...w, got: w.got || '' }));
  const correctWords = wordResults.filter(w => w.status === 'correct' || w.status === 'phonetic');
  const wrongWords   = wordResults.map((w, i) => ({ ...w, _idx: i })).filter(w => w.status === 'wrong');
  const missingWords = wordResults.map((w, i) => ({ ...w, _idx: i })).filter(w => w.status === 'missing');

  const spokenUnmatched = [
    ...wrongWords.map(w => w.got).filter(Boolean),
    ...(result.extra_spoken || [])
  ];
  const hasWrongOrExtra = spokenUnmatched.length > 0;

  const isPerfect       = result.perfect;
  const accuracy        = result.accuracy || 0;
  const hasMissingWords = missingWords.length > 0;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className={`rounded-2xl border-2 p-4 space-y-3 bg-black ${
        isPerfect ? 'border-green-500/40' : 'border-primary/40'
      }`}>
        {/* Score */}
        <div className="flex items-center justify-center gap-3">
          {isPerfect ? (
            <CheckCircle className="w-7 h-7 text-green-500" />
          ) : accuracy >= 70 ? (
            <AlertTriangle className="w-7 h-7 text-primary" />
          ) : (
            <XCircle className="w-7 h-7 text-destructive" />
          )}
          <span className="text-3xl font-bold text-foreground">{Math.round(accuracy)}%</span>
        </div>

        {/* Feedback */}
        {result.feedback && (
          <p className="text-muted-foreground text-center text-xs">{result.feedback}</p>
        )}

        {/* Mots faux */}
        {hasWrongOrExtra && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-2.5 space-y-1.5">
            <p className="text-xs font-bold text-red-400 uppercase tracking-wider">✗ Faux — vous avez dit :</p>
            <div className="flex flex-wrap gap-1 items-center">
              {spokenUnmatched.map((word, i) => {
                const isGap = i > 0 && result.unmatchedSpokenIndices && 
                  (result.unmatchedSpokenIndices[i] - result.unmatchedSpokenIndices[i - 1] > 1);
                return (
                  <React.Fragment key={i}>
                    {isGap && <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#4ade80', flexShrink: 0 }} />}
                    <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-red-500/20 text-red-300 border border-red-500/30">
                      {word}
                    </span>
                  </React.Fragment>
                );
              })}
            </div>
            {wrongWords.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Attendu : {wrongWords.map(w => w.word).join(', ')}
              </p>
            )}
          </div>
        )}

        {/* Texte complet avec points d'erreur */}
        {wordResults.length > 0 && (() => {
          const blocks = [];
          wordResults.forEach((w) => {
            const status = (w.status === 'correct' || w.status === 'phonetic') ? 'correct' : w.status;
            const last = blocks[blocks.length - 1];
            if (last && last.status === status) {
              last.words.push(w);
            } else {
              blocks.push({ status, words: [w] });
            }
          });
          return (
            <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-2.5 space-y-1.5">
              <p className="text-xs font-bold text-green-400 uppercase tracking-wider">✓ Votre texte</p>
              <div className="flex flex-wrap gap-1.5 items-center">
                {blocks.map((block, bi) => {
                  if (block.status === 'correct') {
                    return (
                      <React.Fragment key={bi}>
                        {block.words.map((w, wi) => (
                          <span key={wi} className="px-1.5 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-300 border border-green-500/30">
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
                            <span style={{ display: 'inline-block', width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#ef4444', flexShrink: 0 }} />
                            <span style={{ display: 'inline-block', width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#eab308', flexShrink: 0 }} />
                          </React.Fragment>
                        ))}
                      </span>
                    );
                  } else {
                    return (
                      <span key={bi} title={block.words.map(w => `Manquant : "${w.word}"`).join(' | ')} style={{ display: 'inline-flex', gap: '3px', alignItems: 'center' }}>
                        {block.words.map((w, wi) => (
                          <span key={wi} style={{ display: 'inline-block', width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#eab308', flexShrink: 0 }} />
                        ))}
                      </span>
                    );
                  }
                })}
              </div>
            </div>
          );
        })()}

        {/* Mots manquants (missing + attendus des wrong) */}
        {(missingWords.length > 0 || wrongWords.length > 0) && (
          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-2.5 space-y-1.5">
            <p className="text-xs font-bold text-yellow-400 uppercase tracking-wider">— Attendu mais absent / faux</p>
            <div className="flex flex-wrap gap-1 items-center">
              {wordResults.map((w, i) => {
                if (w.status === 'wrong' || w.status === 'missing') {
                  const prevW = i > 0 ? wordResults[i - 1] : null;
                  const isGap = prevW && prevW.status !== 'wrong' && prevW.status !== 'missing';
                  return (
                    <React.Fragment key={i}>
                      {isGap && i > 0 && <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#4ade80', flexShrink: 0 }} />}
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium border line-through ${
                        w.status === 'wrong'
                          ? 'bg-red-500/10 text-yellow-300 border-yellow-500/30'
                          : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
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
          Dites <span className="text-white font-semibold not-italic">"passer"</span> pour continuer
        </p>

        {/* Boutons */}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onRetry} className="flex-1 gap-1 text-xs text-yellow-400 border-yellow-400/50 hover:text-yellow-300">
            <RotateCcw className="w-3 h-3" />
            Réessayer
          </Button>
          <Button size="sm" onClick={onContinue} className="flex-1 bg-primary text-primary-foreground text-xs">
            {isPerfect && !hasMissingWords ? 'Réplique suivante' : 'Passer quand même'}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}