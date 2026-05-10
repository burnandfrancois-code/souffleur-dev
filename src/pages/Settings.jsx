import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Theater, Trash2, Volume2, CreditCard, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import BottomNav from '@/components/BottomNav';

const PLAN_LABELS = {
  trial: { label: 'Essai gratuit', color: 'text-muted-foreground' },
  active: { label: 'Abonnement actif', color: 'text-green-400' },
  none: { label: 'Aucun abonnement', color: 'text-destructive' },
};

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [deleting, setDeleting] = useState(false);

  const subStatus = user?.subscription_status || 'none';
  const planInfo = PLAN_LABELS[subStatus] || PLAN_LABELS['none'];

  const handleDeleteAccount = async () => {
    if (!window.confirm('Supprimer définitivement votre compte et toutes vos données ? Cette action est irréversible.')) return;
    setDeleting(true);
    try {
      const scripts = await base44.entities.Script.list('-created_date', 100);
      for (const s of scripts) {
        await base44.entities.Script.delete(s.id);
      }
      base44.auth.logout('/');
    } catch (e) {
      alert('Erreur lors de la suppression : ' + e.message);
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col pb-20">
      <header className="px-6 py-4 border-b border-border/50">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Theater className="w-7 h-7 text-primary" />
          <h1 className="font-display text-xl font-bold text-foreground">Paramètres</h1>
        </div>
      </header>

      <main className="flex-1 px-4 py-8">
        <div className="w-full max-w-2xl mx-auto space-y-8">

          {/* Subscription */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground">Abonnement</h2>
            <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Crown className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-body font-semibold text-foreground">Formule actuelle</p>
                  <p className={`text-xs font-body ${planInfo.color}`}>{planInfo.label}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/tarifs')}
                className="border-primary/40 text-primary hover:bg-primary/10 font-body gap-2 shrink-0"
              >
                <CreditCard className="w-4 h-4" />
                {subStatus === 'active' ? 'Changer' : 'Voir les offres'}
              </Button>
            </div>
          </section>

          {/* Voice Test */}
          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground">Outils</h2>
            <div className="bg-card border border-border rounded-xl p-4">
              <Link to="/voice-test">
                <Button variant="outline" className="w-full gap-2 border-primary/40 text-primary hover:bg-primary/10 font-body">
                  <Volume2 className="w-4 h-4" />
                  Tester les voix (debug)
                </Button>
              </Link>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-lg font-bold text-foreground">Compte</h2>
            <div className="bg-card border border-destructive/40 rounded-xl p-4 space-y-3">
              <p className="text-sm text-muted-foreground font-body">
                Supprimer votre compte effacera tous vos textes et données de façon permanente.
              </p>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="w-full gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Suppression...' : 'Supprimer mon compte'}
              </Button>
            </div>
          </section>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}