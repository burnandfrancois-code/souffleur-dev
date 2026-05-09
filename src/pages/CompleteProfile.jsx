import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Theater, Loader2, CheckCircle2, AlertCircle, Smartphone, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

export default function CompleteProfile() {
  const navigate = useNavigate();
  const { isAuthenticated, user, isLoadingAuth, checkUserAuth } = useAuth();
  
  const [step, setStep] = useState('name');
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isLoadingAuth && !isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, isLoadingAuth, navigate]);

  useEffect(() => {
    if (user?.full_name && user.full_name.length > 2) {
      setFullName(user.full_name);
    }
  }, [user]);

  const validatePhone = (p) => !p || /^[\d\s\-\+\.()]{6,}$/.test(p);

  const handleNextStep = () => {
    const newErrors = {};
    
    if (step === 'name' && !fullName.trim()) {
      newErrors.fullName = 'Le nom est requis';
    }
    
    if (step === 'phone' && !validatePhone(phone)) {
      newErrors.phone = 'Format de téléphone invalide';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    if (step === 'name') {
      setStep('phone');
    } else if (step === 'phone') {
      setStep('platform');
    }
  };

  const handlePlatformSelect = async (platform) => {
    setIsProcessing(true);
    try {
      await base44.auth.updateMe({
        full_name: fullName,
        phone: phone || null,
        preferred_platform: platform,
        profile_completed: true
      });
      await checkUserAuth();
      navigate(`/${platform}/tarifs`);
    } catch (err) {
      toast.error('Erreur lors de la sauvegarde du profil');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-8 max-w-lg w-full"
      >
        {/* Header */}
        <div className="space-y-3">
          <Theater className="w-12 h-12 text-primary mx-auto" />
          <h1 className="text-3xl font-bold text-foreground">Bienvenue</h1>
          <p className="text-muted-foreground">Complétons votre profil SOUFFLEUR</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2">
          {['name', 'phone', 'platform'].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && (
                <div
                  className={`w-8 h-px transition-colors ${
                    (step === 'phone' && s !== 'name') ||
                    (step === 'platform' && s !== 'name' && s !== 'phone')
                      ? 'bg-primary'
                      : 'bg-border'
                  }`}
                />
              )}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                  step === s
                    ? 'bg-primary text-primary-foreground'
                    : (step === 'phone' && s !== 'name') ||
                      (step === 'platform' && s !== 'name' && s !== 'phone')
                    ? 'bg-primary/20 text-primary'
                    : 'bg-secondary text-muted-foreground'
                }`}
              >
                {i + 1}
              </div>
            </div>
          ))}
        </div>

        {/* Content */}
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="space-y-6 w-full"
        >
          {step === 'name' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Votre nom complet</label>
                <Input
                  type="text"
                  placeholder="Ex: Jean Dupont"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    setErrors({ ...errors, fullName: '' });
                  }}
                  className={`text-base ${errors.fullName ? 'border-destructive' : ''}`}
                  autoFocus
                />
                {errors.fullName && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.fullName}
                  </p>
                )}
              </div>

              <div className="bg-secondary/50 border border-border rounded-lg p-4 space-y-2">
                <p className="text-sm text-foreground font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Email
                </p>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                  <button
                    onClick={() => base44.auth.logout('/')}
                    className="text-xs text-primary underline hover:opacity-70"
                  >
                    Changer
                  </button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-left">
                Ces informations sont utilisées uniquement pour personnaliser votre expérience.
              </p>
            </div>
          )}

          {step === 'phone' && (
            <div className="space-y-4">
              <div className="bg-secondary/50 border border-border rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-sm text-foreground font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Nom
                  </p>
                  <p className="text-sm text-muted-foreground">{fullName}</p>
                </div>
                <div className="border-t border-border/50 pt-3">
                  <p className="text-sm text-foreground font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Email
                  </p>
                  <p className="text-sm text-muted-foreground">{user?.email}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Téléphone (optionnel)</label>
                <Input
                  type="tel"
                  placeholder="Ex: +33 6 12 34 56 78"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setErrors({ ...errors, phone: '' });
                  }}
                  className={`text-base ${errors.phone ? 'border-destructive' : ''}`}
                />
                {errors.phone && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.phone}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Nous ne partagerons jamais votre numéro avec des tiers.
                </p>
              </div>
            </div>
          )}

          {step === 'platform' && (
            <div className="space-y-4">
              <div className="bg-secondary/50 border border-border rounded-lg p-4 space-y-2 text-left text-sm">
                <p className="font-semibold text-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  {fullName}
                </p>
                <p className="font-semibold text-foreground flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  {user?.email}
                </p>
                {phone && (
                  <p className="font-semibold text-foreground flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    {phone}
                  </p>
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                Sélectionnez votre interface préférée pour commencer
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={() => handlePlatformSelect('desktop')}
                  disabled={isProcessing}
                  className="p-4 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all group disabled:opacity-50"
                >
                  <Monitor className="w-6 h-6 text-primary mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <p className="font-bold text-foreground text-sm">Desktop</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Voix personnalisées
                  </p>
                </motion.button>

                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={() => handlePlatformSelect('android')}
                  disabled={isProcessing}
                  className="p-4 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all group disabled:opacity-50"
                >
                  <Smartphone className="w-6 h-6 text-primary mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <p className="font-bold text-foreground text-sm">Mobile</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Optimisée pour Android
                  </p>
                </motion.button>
              </div>
            </div>
          )}
        </motion.div>

        {/* Action Buttons */}
        {step !== 'platform' && (
          <div className="flex gap-3 w-full">
            {step === 'phone' && (
              <Button
                variant="outline"
                className="flex-1 border-border text-foreground"
                onClick={() => setStep('name')}
                disabled={isProcessing}
              >
                Précédent
              </Button>
            )}
            <Button
              size="lg"
              className="flex-1 bg-primary text-primary-foreground gap-2"
              onClick={handleNextStep}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                'Continuer'
              )}
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}