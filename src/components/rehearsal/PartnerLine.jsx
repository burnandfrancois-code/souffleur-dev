import React from 'react';
import { motion } from 'framer-motion';
import { Volume2, Loader2 } from 'lucide-react';

export default function PartnerLine({ line, isSpeaking, onSpeak }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex gap-3 items-start"
    >
      {/* Avatar */}
      <div className="shrink-0 mt-1">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isSpeaking ? 'bg-primary/30 ring-2 ring-primary animate-pulse' : 'bg-secondary'}`}>
          <span className="text-xs font-semibold text-muted-foreground">
            {line.character?.charAt(0)?.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        {/* Character name */}
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          {line.character}
        </p>

        {/* Bubble */}
        <div className={`rounded-2xl rounded-tl-sm px-4 py-3 border transition-all ${isSpeaking ? 'bg-secondary border-primary/40 shadow-lg shadow-primary/10' : 'bg-secondary/50 border-border'}`}>
          {/* Sound wave indicator when speaking */}
          {isSpeaking && (
            <div className="flex items-center gap-1 mb-2">
              {[1, 2, 3, 4, 3].map((h, i) => (
                <motion.div
                  key={i}
                  className="w-0.5 bg-primary rounded-full"
                  animate={{ height: [h * 3, h * 6, h * 3] }}
                  transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.08 }}
                  style={{ height: h * 3 }}
                />
              ))}
              <span className="text-xs text-primary ml-1">Lecture…</span>
            </div>
          )}
          <p className="text-foreground leading-relaxed">{line.text}</p>
        </div>

        {/* Listen button */}
        <div className="mt-2">
          <button
            onClick={onSpeak}
            disabled={isSpeaking}
            className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border transition-all ${
              isSpeaking
                ? 'border-primary/30 text-primary bg-primary/5 cursor-not-allowed'
                : 'border-border text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5'
            }`}
          >
            {isSpeaking
              ? <><Loader2 className="w-3 h-3 animate-spin" /> En cours...</>
              : <><Volume2 className="w-3 h-3" /> Réécouter</>
            }
          </button>
        </div>
      </div>
    </motion.div>
  );
}