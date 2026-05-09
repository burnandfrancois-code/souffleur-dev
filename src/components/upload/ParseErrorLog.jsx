import React, { useState } from 'react';
import { ChevronDown, Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function ParseErrorLog({ logs }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasErrors = logs.some(log => log.level === 'error');
  const hasWarnings = logs.some(log => log.level === 'warn');

  const handleCopyLogs = () => {
    const text = logs
      .map(log => `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    toast.success('Logs copiés');
  };

  const getLevelColor = (level) => {
    switch (level) {
      case 'error':
        return 'text-destructive';
      case 'warn':
        return 'text-yellow-500';
      case 'info':
        return 'text-primary';
      default:
        return 'text-muted-foreground';
    }
  };

  const getLevelBg = (level) => {
    switch (level) {
      case 'error':
        return 'bg-destructive/10';
      case 'warn':
        return 'bg-yellow-500/10';
      case 'info':
        return 'bg-primary/10';
      default:
        return 'bg-secondary/50';
    }
  };

  if (logs.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 pt-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
          hasErrors ? 'bg-destructive/10 border border-destructive/20' :
          hasWarnings ? 'bg-yellow-500/10 border border-yellow-500/20' :
          'bg-secondary/50 border border-border'
        }`}
      >
        <ChevronDown
          className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        />
        <span className="text-xs font-medium text-foreground flex-1 text-left">
          Journal détaillé ({logs.length})
        </span>
        {hasErrors && <span className="text-xs text-destructive font-semibold">Erreurs</span>}
        {hasWarnings && !hasErrors && <span className="text-xs text-yellow-500 font-semibold">Avertissements</span>}
        <Copy className="w-3 h-3 text-muted-foreground" />
      </button>

      {isExpanded && (
        <div className="space-y-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-card p-3">
          {logs.map((log, i) => (
            <div
              key={i}
              className={`px-2 py-1 rounded text-xs font-mono ${getLevelBg(log.level)}`}
            >
              <span className={`${getLevelColor(log.level)} font-semibold`}>
                [{log.timestamp}] {log.level.toUpperCase()}
              </span>
              <span className="text-muted-foreground ml-2">{log.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}