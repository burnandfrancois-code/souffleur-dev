import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, AlertCircle } from 'lucide-react';

export default function GitHubPRs() {
  const [prs, setPRs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPRs = async () => {
      try {
        setLoading(true);
        const response = await base44.functions.invoke('getPendingPullRequests', {});
        setPRs(response.data.pull_requests || []);
      } catch (err) {
        setError(err.message || 'Erreur lors du chargement des PRs');
      } finally {
        setLoading(false);
      }
    };

    fetchPRs();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">Pull Requests en Attente</h1>
        <p className="text-muted-foreground mb-8">PRs nécessitant votre révision</p>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-destructive">Erreur</p>
              <p className="text-sm text-destructive/80">{error}</p>
            </div>
          </div>
        )}

        {prs.length === 0 ? (
          <Card>
            <CardContent className="pt-8 text-center text-muted-foreground">
              <p className="mb-2">Aucune PR en attente de révision</p>
              <p className="text-sm">Vous êtes à jour ! 🎉</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {prs.map((pr) => (
              <Card key={pr.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-2">{pr.title}</CardTitle>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{pr.repo}</Badge>
                        <Badge variant="secondary">Par {pr.author}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(pr.created_at).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(pr.url, '_blank')}
                      className="flex-shrink-0"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Voir
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    <p className="font-semibold mb-2">Demandeurs de révision:</p>
                    <div className="flex flex-wrap gap-2">
                      {pr.requested_reviewers.map((reviewer) => (
                        <Badge key={reviewer} variant="outline">
                          @{reviewer}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}