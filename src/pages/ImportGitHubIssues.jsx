import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Download } from 'lucide-react';

export default function ImportGitHubIssues() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  const handleImport = async () => {
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
          <CardContent>
            {error && (
              <div className="mb-6 p-4 bg-destructive/10 border border-destructive rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {success && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-green-700">{success}</p>
              </div>
            )}

            <Button
              onClick={handleImport}
              disabled={loading}
              className="gap-2"
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
                  Importer les issues
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}