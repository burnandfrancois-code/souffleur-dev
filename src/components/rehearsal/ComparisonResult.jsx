import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle, RotateCcw, ChevronRight } from 'lucide-react';

export default function ComparisonResult({ result, onRetry, onContinue }) {
  if (!result) return null;

  const accuracy = result.accuracy ?? 0;
  const isGood = accuracy >= 80;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Score */}
      <div className={`rounded-2xl p-6 text-center space-y-3 ${
        isGood ? 'bg-green-500/10 border border-green-500/30' : 'bg-orange-500/10 border border-orange-500/30'
      }`}>
        <div className="flex items-center justify-center gap-3">
          {isGood ? (
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          ) : (
            <AlertCircle className="w-8 h-8 text-orange-500" />
          )}
          <p className={`text-4xl font-bold ${isGood ? 'text-green-500' : 'text-orange-500'}`}>
            {accuracy}%
          </p>
        </div>
        <p className={`text-sm font-semibold ${isGood ? 'text-green-600' : 'text-orange-600'}`}>
          {result.perfect ? '✨ Parfait !' : isGood ? 'Très bon !' : 'À améliorer'}
        </p>
      </div>

      {/* Word results */}
      {result.word_results && result.word_results.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-2 max-h-48 overflow-y-auto">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Détail des mots</p>
          <div className="space-y-1">
            {result.word_results.slice(0, 10).map((wr, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center font-semibold ${
                  wr.status === 'correct' ? 'bg-green-500/20 text-green-600' :
                  wr.status === 'phonetic' ? 'bg-blue-500/20 text-blue-600' :
                  wr.status === 'wrong' ? 'bg-red-500/20 text-red-600' :
                  'bg-gray-500/20 text-gray-600'
                }`}>
                  {wr.status === 'correct' ? '✓' : wr.status === 'phonetic' ? '≈' : wr.status === 'wrong' ? '✗' : '-'}
                </span>
                <span className="text-foreground font-medium">{wr.word}</span>
                {wr.got && <span className="text-muted-foreground">→ {wr.got}</span>}
              </div>
            ))}
            {result.word_results.length > 10 && (
              <p className="text-xs text-muted-foreground">+{result.word_results.length - 10} autres</p>
            )}
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={onRetry}
          className="flex-1 gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Réessayer
        </Button>
        <Button
          onClick={onContinue}
          className="flex-1 bg-primary text-primary-foreground gap-2"
        >
          Continuer
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}