import React from 'react';
import { Progress } from '@/components/ui/progress';

export default function RehearsalProgress({ currentIndex, totalLines, myLineCount, completedMyLines }) {
  const progress = totalLines > 0 ? ((currentIndex + 1) / totalLines) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Réplique {currentIndex + 1} / {totalLines}
        </span>
        <span className="text-primary font-semibold">
          {completedMyLines} / {myLineCount} validées
        </span>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  );
}