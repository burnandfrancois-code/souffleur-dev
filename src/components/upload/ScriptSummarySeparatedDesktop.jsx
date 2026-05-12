import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { BookOpen, Users, ChevronRight } from 'lucide-react';

export default function ScriptSummarySeparatedDesktop({ parsedScript, onContinue }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Texte détecté</p>
          <h2 className="text-2xl font-bold text-foreground">{parsedScript.title}</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-background rounded-xl p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Répliques</p>
            <p className="text-2xl font-bold text-primary">
              {parsedScript.lines?.length || 0}
            </p>
          </div>
          <div className="bg-background rounded-xl p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Personnages</p>
            <p className="text-2xl font-bold text-primary">
              {parsedScript.characters?.length || 0}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Users className="w-4 h-4" />
            Personnages détectés
          </p>
          <div className="flex flex-wrap gap-2">
            {parsedScript.characters?.slice(0, 6).map((char) => (
              <span
                key={char}
                className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full font-medium"
              >
                {char}
              </span>
            ))}
            {parsedScript.characters?.length > 6 && (
              <span className="text-xs text-muted-foreground px-3 py-1.5">
                +{parsedScript.characters.length - 6} autres
              </span>
            )}
          </div>
        </div>
      </div>

      <Button
        size="lg"
        onClick={onContinue}
        className="w-full bg-primary text-primary-foreground gap-2"
      >
        Continuer
        <ChevronRight className="w-4 h-4" />
      </Button>
    </motion.div>
  );
}