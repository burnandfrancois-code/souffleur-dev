import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertTriangle, XCircle, RotateCcw } from 'lucide-react';

export default function ComparisonResult({ result, onRetry, onContinue }) {
  if (!result) return null;

  const wordResults = (result.word_results || []).map(w => ({ ...w, got: w.got || '' }));
  const correctWords = wordResults.filter(w => w.status === 'correct' || w.status === 'phonetic');
  const wrongWords   = wordResults.filter(w => w.status === 'wrong');
  const missingWords = wordResults.filter(w => w.status === 'missing');

  const wrongPhrase   = wrongWords.map(w => w.word).join(' ');
  const missingPhrase = missingWords.map(w => w.word).join(' ');

  const isPerfect       = result.perfect;
  const accuracy        = result.accuracy || 0;
  const hasMissingWords = missingWords.length > 0;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className={`rounded-2xl border-2 p-6 space-y-4 ${
        isPerfect ? 'border-green-500/30 bg-green-500/5' : 'border-primary/30 bg-primary/5'
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

        {/* Mots corrects */}
        {correctWords.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Corrects :</p>
            <div className="flex flex-wrap gap-1.5">
              {correctWords.map((w, i) => (
                <span key={i} style={{
                  color: '#4ade80',
                  backgroundColor: 'rgba(74,222,128,0.12)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                }}>
                  {w.word}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Mots faux */}
        {wrongWords.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Vous avez dit faux :</p>
            <span style={{
              color: '#f87171',
              backgroundColor: 'rgba(248,113,113,0.12)',
              padding: '4px 10px',
              borderRadius: '6px',
              fontWeight: 500,
              fontSize: '0.9rem',
              display: 'inline-block',
              lineHeight: '1.6',
            }}>
              {wrongWords.map(w => w.got).filter(Boolean).join(' ')}
            </span>
          </div>
        )}

        {/* Mots manquants */}
        {missingWords.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Manquants :</p>
            <span style={{
              color: '#ffeb3b',
              backgroundColor: 'rgba(255,235,59,0.15)',
              padding: '4px 10px',
              borderRadius: '6px',
              fontWeight: 500,
              fontSize: '0.9rem',
              textDecoration: 'line-through',
              display: 'inline-block',
              lineHeight: '1.6',
            }}>
              {missingWords.map(w => w.word).join(' ')}
            </span>
          </div>
        )}

        {/* Légende */}
        <div className="flex flex-wrap gap-3 pt-2 border-t border-border/50">
          <span className="flex items-center gap-1 text-xs text-green-400">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Correct
          </span>
          {wrongPhrase && (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Faux
            </span>
          )}
          {missingPhrase && (
            <span className="flex items-center gap-1 text-xs text-yellow-400">
              <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
              <span style={{ textDecoration: 'line-through' }}>Manquant</span>
            </span>
          )}
        </div>

        {/* Boutons */}
        <div className="flex gap-3 justify-center pt-2">
          <Button variant="outline" onClick={onRetry} className="gap-2">
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