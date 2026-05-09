import React from 'react';
import { motion } from 'framer-motion';
import { X, CheckCircle2 } from 'lucide-react';

export default function MyLinesPanel({ lines, myCharacter, currentLineIndex, onJumpTo, onClose }) {
  const normalize = (s) => s?.trim().toLowerCase();
  const myLines = lines.filter(l => normalize(l.character) === normalize(myCharacter));

  const stripDirections = (text) => text?.replace(/\([^)]*\)?/g, '').replace(/\[[^\]]*\]?/g, '').replace(/\s+/g, ' ').trim() || '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border rounded-t-2xl max-h-96 overflow-y-auto"
    >
      <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Mes répliques ({myLines.length})</h3>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-secondary transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-4 space-y-2">
        {myLines.map((line, i) => {
          const actualIndex = lines.indexOf(line);
          const isCurrent = actualIndex === currentLineIndex;
          
          return (
            <button
              key={actualIndex}
              onClick={() => {
                onJumpTo(actualIndex);
                onClose();
              }}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                isCurrent
                  ? 'bg-primary/20 border border-primary text-foreground font-semibold'
                  : 'bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="flex items-start gap-2">
                {isCurrent && <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />}
                <span className="truncate">{stripDirections(line.text)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}