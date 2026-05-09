import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import { ArrowLeft, Mic, Play, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function AndroidMyScripts() {
  const navigate = useNavigate();
  const [scripts, setScripts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    loadScripts();
  }, []);

  const loadScripts = async () => {
    try {
      setIsLoading(true);
      const data = await base44.entities.Script.list('-created_date');
      setScripts(data || []);
    } catch (e) {
      toast.error('Erreur lors du chargement des textes');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (scriptId) => {
    if (!confirm('Supprimer ce texte ?')) return;
    setDeleting(scriptId);
    try {
      await base44.entities.Script.delete(scriptId);
      setScripts(scripts.filter(s => s.id !== scriptId));
      toast.success('Texte supprimé');
    } catch (e) {
      toast.error('Erreur lors de la suppression');
      console.error(e);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/30 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/android/')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold text-foreground">Mes textes</h1>
        </div>
      </header>

      {/* Contenu */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : scripts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground text-sm">Aucun texte importé</p>
            <Button
              onClick={() => navigate('/android/')}
              className="mt-4 bg-primary text-primary-foreground"
            >
              Importer un texte
            </Button>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-3">
            {scripts.map((script, i) => (
              <motion.div
                key={script.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-card border border-border rounded-lg p-4 space-y-3"
              >
                <div>
                  <p className="font-semibold text-foreground">{script.title}</p>
                  {script.file_name && (
                    <p className="text-xs text-muted-foreground/80 mt-0.5">
                      📄 {script.file_name}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {script.my_character} · {script.lines?.length} répliques
                  </p>
                </div>

                <div className="flex gap-2">
                   <Button
                     size="sm"
                     className="flex-1 text-xs gap-1"
                     onClick={() => navigate(`/android/rehearsal?scriptId=${script.id}`)}
                   >
                     <Mic className="w-3 h-3" /> Répéter
                   </Button>
                   <Button
                     size="sm"
                     variant="outline"
                     className="flex-1 text-xs gap-1"
                     onClick={() => navigate(`/android/read-through?scriptId=${script.id}`)}
                   >
                     <Play className="w-3 h-3" /> Lire
                   </Button>

                   <Button
                     size="sm"
                     variant="ghost"
                     onClick={() => handleDelete(script.id)}
                     disabled={deleting === script.id}
                     className="text-destructive hover:text-destructive"
                   >
                     {deleting === script.id ? (
                       <Loader2 className="w-4 h-4 animate-spin" />
                     ) : (
                       <Trash2 className="w-4 h-4" />
                     )}
                   </Button>
                 </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}