import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Theater, BookOpen, Play, Trash2, Plus, Loader2, RefreshCw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import BottomNav from '@/components/BottomNav';
import { exportScriptToPDF } from '@/lib/pdfExport';
import { useAuth } from '@/lib/AuthContext';

export default function MyScripts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [exportingId, setExportingId] = useState(null);
  const touchStartY = useRef(0);
  const scrollRef = useRef(null);
  const PULL_THRESHOLD = 60;
  
  const subStatus = user?.subscription_status || 'none';
  const canExport = subStatus === 'trial' || subStatus === 'active';

  const { data: scripts, isLoading } = useQuery({
    queryKey: ['scripts'],
    queryFn: () => base44.entities.Script.list('-created_date', 50),
    initialData: [],
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Script.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['scripts'] });
      const previous = queryClient.getQueryData(['scripts']);
      queryClient.setQueryData(['scripts'], (old) => (old || []).filter((s) => s.id !== id));
      return { previous };
    },
    onError: (_err, _id, context) => {
      queryClient.setQueryData(['scripts'], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['scripts'] });
    },
  });

  const handleDelete = (id, e) => {
    e.stopPropagation();
    if (window.confirm('Supprimer ce texte ?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await queryClient.refetchQueries({ queryKey: ['scripts'] });
    setIsRefreshing(false);
  };

  const onTouchStart = (e) => {
    if (scrollRef.current?.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const onTouchMove = (e) => {
    if (scrollRef.current?.scrollTop > 0) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) setPullDistance(Math.min(delta, PULL_THRESHOLD + 20));
  };

  const onTouchEnd = async () => {
    if (pullDistance >= PULL_THRESHOLD) {
      await handleRefresh();
    }
    setPullDistance(0);
  };

  return (
    <div className="min-h-screen flex flex-col pb-20">
      <header className="px-6 py-4 border-b border-border/50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link to="/desktop/" className="flex items-center gap-3">
            <Theater className="w-7 h-7 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Souffleur</h1>
          </Link>
          <Link to="/desktop/">
            <Button size="sm" className="bg-primary text-primary-foreground gap-2">
              <Plus className="w-4 h-4" />
              Nouveau texte
            </Button>
          </Link>
        </div>
      </header>

      <main
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-8"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {pullDistance > 0 && (
          <div
            className="flex justify-center items-center transition-all"
            style={{ height: pullDistance, marginTop: -pullDistance }}
          >
            <RefreshCw
              className={`w-5 h-5 text-primary transition-transform ${pullDistance >= PULL_THRESHOLD ? 'rotate-180' : ''}`}
              style={{ transform: `rotate(${(pullDistance / PULL_THRESHOLD) * 180}deg)` }}
            />
          </div>
        )}
        {isRefreshing && (
          <div className="flex justify-center py-3">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          </div>
        )}

        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground mb-6">Mes textes</h2>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : scripts.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <BookOpen className="w-12 h-12 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">Aucun texte importé</p>
              <Link to="/desktop/">
                <Button className="bg-primary text-primary-foreground">Importer un texte</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {scripts.map((script, i) => (
                <motion.div
                  key={script.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => navigate(`/desktop/rehearsal?scriptId=${script.id}`)}
                  className="group p-4 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-secondary/30 cursor-pointer transition-all duration-300"
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1 flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                        {script.title}
                      </h3>
                      {script.file_name && (
                        <p className="text-xs text-muted-foreground/80">
                          📄 {script.file_name}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span>Rôle : {script.my_character}</span>
                        <span>·</span>
                        <span>{script.lines?.length} répliques</span>
                        <span>·</span>
                        <span>{format(new Date(script.created_date), 'd MMM yyyy', { locale: fr })}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!canExport) {
                            navigate('/tarifs');
                            return;
                          }
                          setExportingId(script.id);
                          const success = await exportScriptToPDF(script);
                          setExportingId(null);
                        }}
                        disabled={exportingId === script.id}
                        className={`opacity-0 group-hover:opacity-100 transition-opacity ${canExport ? 'text-muted-foreground hover:text-primary' : 'text-muted-foreground/50'}`}
                        title={canExport ? 'Télécharger en PDF' : 'Export PDF réservé aux abonnés'}
                      >
                        <Download className={`w-4 h-4 ${exportingId === script.id ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleDelete(script.id, e)}
                        className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <Play className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}