import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, CheckCircle2, Download } from 'lucide-react';

export default function ImportGitHubIssues() {
  const [loading, setLoading] = useState(false);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState(null);

  useEffect(() => {
    const fetchRepos = async () => {
      try {
        setLoadingRepos(true);
        const response = await base44.functions.invoke('getGitHubRepos', {});
        setRepos(response.data.repos || []);
      } catch (err) {
        setError('Erreur lors du chargement des repos');
      } finally {
        setLoadingRepos(false);
      }
    };

    fetchRepos();
  }, []);

  const handleImportAll = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const response = await base44.functions.invoke('importGitHubIssues', {});
      setSuccess(response.data.message);
    } catch (err) {
      setError(err.message || 'Erreur lors de l\'importation');
    } finally {
      setLoading(false);
    }
  };

  const handleImportRepo = async () => {
    if (!selectedRepo) {
      setError('Veuillez sélectionner un repo');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const response = await base44.functions.invoke('importGitHubIssuesByRepo', {
        repoName: selectedRepo.name,
        repoOwner: selectedRepo.owner
      });
      setSuccess(response.data.message);
    } catch (err) {
      setError(err.message || 'Erreur lors de l\'importation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">Importer les Issues GitHub</h1>
        <p className="text-muted-foreground mb-8">Synchronise toutes les issues de tes repos GitHub</p>

        <Card>
          <CardHeader>
            <CardTitle>Synchroniser les issues</CardTitle>
            <CardDescription>
              Cette action va importer toutes les issues (ouvertes et fermées) de tous tes repos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {success && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-green-700">{success}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-3">Importer un repo spécifique</h3>
                {loadingRepos ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
                    Chargement des repos...
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Select value={selectedRepo?.name || ''} onValueChange={(name) => {
                      const repo = repos.find(r => r.name === name);
                      setSelectedRepo(repo);
                    }}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Sélectionner un repo" />
                      </SelectTrigger>
                      <SelectContent>
                        {repos.map((repo) => (
                          <SelectItem key={repo.name} value={repo.name}>
                            {repo.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleImportRepo}
                      disabled={loading || !selectedRepo}
                      variant="outline"
                      className="gap-2"
                    >
                      {loading ? (
                        <div className="w-4 h-4 border-2 border-slate-800 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Importer
                    </Button>
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold mb-3">Importer tous les repos</h3>
                <Button
                  onClick={handleImportAll}
                  disabled={loading}
                  className="gap-2 w-full"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Importation en cours...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Importer tous les repos
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}