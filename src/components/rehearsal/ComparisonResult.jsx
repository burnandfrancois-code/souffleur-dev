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

        {/* Mots faux */}
        {wrongWords.length > 0 && (
          <div className="rounded-xl border border-red-500/40 bg-red-950/60 p-3 space-y-2">
            <p className="text-xs font-bold text-red-400 uppercase tracking-wider">✗ Faux — vous avez dit :</p>
            <div className="flex flex-wrap gap-1.5">
              {wrongWords.map((w, i) => (
                <span key={i} className="px-2 py-0.5 rounded-md text-sm font-medium bg-red-500/30 text-red-200 border border-red-400/50">
                  {w.got || '?'}
                </span>
              ))}
            </div>
            <p className="text-xs text-gray-400">
              Attendu : <span className="text-gray-200 italic">{wrongWords.map(w => w.word).join(', ')}</span>
            </p>
          </div>
        )}

        {/* Mots manquants */}
        {missingWords.length > 0 && (
          <div className="rounded-xl border border-yellow-500/40 bg-yellow-950/60 p-3 space-y-2">
            <p className="text-xs font-bold text-yellow-400 uppercase tracking-wider">— Manquants</p>
            <div className="flex flex-wrap gap-1.5">
              {missingWords.map((w, i) => (
                <span key={i} className="px-2 py-0.5 rounded-md text-sm font-medium bg-yellow-500/20 text-yellow-200 border border-yellow-400/50 line-through">
                  {w.word}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Mots corrects — en bas */}
        {correctWords.length > 0 && (
          <div className="rounded-xl border border-green-500/40 bg-green-950/60 p-3 space-y-2">
            <p className="text-xs font-bold text-green-400 uppercase tracking-wider">✓ Corrects</p>
            <div className="flex flex-wrap gap-1.5">
              {correctWords.map((w, i) => (
                <span key={i} className="px-2 py-0.5 rounded-md text-sm font-medium bg-green-500/25 text-green-200 border border-green-400/50">
                  {w.word}
                </span>
              ))}
            </div>
          </div>
        )}

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