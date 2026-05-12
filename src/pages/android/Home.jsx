import React, { useState, useEffect } from 'react';
import ParseProgress from '@/components/upload/ParseProgress';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Theater, Sparkles, Mic, BookOpen, Play, Pencil, HelpCircle, CreditCard, AlertCircle, ChevronRight, List, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import FileUploader from '@/components/upload/FileUploader';
import CharacterSelector from '@/components/upload/CharacterSelector';
import ScriptSummary from '@/components/upload/ScriptSummary';
import { parseScriptWithLLM, verifyScriptIntegrity } from '@/lib/scriptParser';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

export default function AndroidHome() {
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();
  const subStatus = user?.subscription_status || 'none';
  const urlParams = new URLSearchParams(window.location.search);
  const initialStep = urlParams.get('step') || 'upload';
  
  // Rediriger vers /desktop/ si pas Android
  const isAndroidDevice = /Android/i.test(navigator.userAgent);
  
  useEffect(() => {
    if (!isAndroidDevice) {
      navigate('/desktop/');
    }
  }, [isAndroidDevice, navigate]);
  
  const [step, setStep] = useState(initialStep);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [parsedScript, setParsedScript] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [selectedCharacter, setSelectedCharacter] = useState('');
  const [characterGenders, setCharacterGenders] = useState({});
  const [lastScript, setLastScript] = useState(null);
  const [isLoadingLast, setIsLoadingLast] = useState(true);
  const [editingScriptId, setEditingScriptId] = useState(null);
  const [fileName, setFileName] = useState('');
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const scripts = await base44.entities.Script.list('-created_date', 1);
        if (scripts && scripts.length > 0) setLastScript(scripts[0]);
      } catch (e) {
        // no last script
      } finally {
        setIsLoadingLast(false);
      }
    })();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const newStep = params.get('step');
    const scriptIdParam = params.get('scriptId');
    
    if (newStep && newStep !== step) {
      setStep(newStep);
    }
    
    // Si on vient de la rehearsal pour changer de rôle
    if (scriptIdParam && newStep === 'character') {
      (async () => {
        try {
          const script = await base44.entities.Script.filter({ id: scriptIdParam });
          if (script && script.length > 0) {
            const s = script[0];
            setEditingScriptId(s.id);
            setParsedScript({
              title: s.title,
              characters: s.characters || [],
              lines: s.lines || []
            });
            setSelectedCharacter(s.my_character || '');
            setCharacterGenders(s.character_genders || {});
            setFileUrl(s.file_url || '');
          }
        } catch (e) {
          console.error('Error loading script:', e);
        }
      })();
    }
  }, [window.location.search]);

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // Debug: Version visible
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2 px-4">
          <p className="text-primary font-bold">Home v2 chargée</p>
          <p className="text-xs text-muted-foreground">Redirection en cours...</p>
        </div>
      </div>
    );
  }

  const handleGenderChange = (char, gender) => {
    setCharacterGenders(prev => ({ ...prev, [char]: gender }));
  };

  const handleFileUploaded = async (url, uploadedFileName) => {
    setFileUrl(url);
    setFileName(uploadedFileName);
    setIsProcessing(true);
    setProgress(0);
    setLogs([]);
    
    // Petit délai pour afficher le cadre de progression immédiatement
    await new Promise(resolve => setTimeout(resolve, 50));
    
    try {
      // Timeout global: 120s max
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Analyse bloquée — le backend ne répond pas. Essayez avec un fichier plus petit.')), 120000)
      );

      const parsePromise = parseScriptWithLLM(url, uploadedFileName, (progressValue) => {
        setProgress(progressValue);
      }, (fileLogs) => {
        setLogs(fileLogs);
      });

      const result = await Promise.race([parsePromise, timeoutPromise]);
      
      if (!result?.characters || result.characters.length === 0) {
        throw new Error('Aucun personnage trouvé. Vérifiez le format du fichier.');
      }
      
      if (!result?.lines || result.lines.length === 0) {
        throw new Error('Aucune réplique trouvée. Le fichier est peut-être vide.');
      }
      
      const initialGenders = {};
      result.characters.forEach(char => {
        const lowerChar = char.toLowerCase();
        const feminineSuffixes = ['ie', 'ée', 'elle', 'ette', 'ine', 'a', 'ia', 'ie'];
        initialGenders[char] = feminineSuffixes.some(suffix => lowerChar.endsWith(suffix)) ? 'female' : 'male';
      });
      setCharacterGenders(initialGenders);

      const parsed = {
        title: uploadedFileName,
        characters: result.characters,
        lines: result.lines || [],
        stats: result.stats || {}
      };
      
      await verifyScriptIntegrity(result.rawText || '', parsed);
      setParsedScript(parsed);
      setIsProcessing(false);
      setStep('summary');
      navigate('/android/?step=summary', { replace: true });
    } catch (err) {
      console.error('[Android Home] Error:', err);
      setIsProcessing(false);
      const errorMsg = err?.message || 'Impossible d\'analyser le fichier';
      toast.error(errorMsg);
    }
  };

  const handleCharacterSelect = (char) => {
    setSelectedCharacter(char);
  };

  const handleEditLastScript = (script) => {
    setEditingScriptId(script.id);
    setParsedScript({
      title: script.title,
      characters: script.characters || [],
      lines: script.lines || []
    });
    setSelectedCharacter(script.my_character || '');
    setCharacterGenders(script.character_genders || {});
    setFileUrl(script.file_url || '');
    setStep('character');
    navigate('/android/?step=character', { replace: true });
  };

  const handleStart = async () => {
    if (!selectedCharacter || !parsedScript) return;
    setIsProcessing(true);

    let script;
    if (editingScriptId) {
      script = await base44.entities.Script.update(editingScriptId, {
        character_genders: characterGenders,
        my_character: selectedCharacter
      });
      toast.success('Rôle mis à jour !');
    } else {
      script = await base44.entities.Script.create({
        title: parsedScript.title,
        file_url: fileUrl,
        characters: parsedScript.characters,
        character_genders: characterGenders,
        lines: parsedScript.lines,
        my_character: selectedCharacter
      });
      toast.success('Texte importé !');
    }
    
    setEditingScriptId(null);
    navigate(`/android/rehearsal?scriptId=${script.id}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background pb-4">
      {/* Header - Compact pour mobile */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/30 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Theater className="w-6 h-6 text-primary shrink-0" />
            <div>
              <h1 className="text-base font-bold text-foreground">SOUFFLEUR</h1>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate('/android/my-scripts')}
              className="px-3 py-1.5 rounded-full hover:bg-secondary transition-colors"
              title="Mes textes"
            >
              <span className="text-xs font-semibold text-yellow-400">Textes</span>
            </button>
            <button
              onClick={() => navigate('/android/help')}
              className="p-2 rounded-full hover:bg-secondary transition-colors"
            >
              <HelpCircle className="w-5 h-5 text-foreground" />
            </button>
            <button
              onClick={() => navigate('/android/tarifs')}
              className={`p-2 rounded-full transition-colors ${
                subStatus === 'active'
                  ? 'text-green-400'
                  : 'text-primary'
              }`}
            >
              <CreditCard className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {isProcessing && <ParseProgress fileName={fileName} progress={progress} logs={logs} />}

      <main className="flex-1 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-2xl mx-auto space-y-6">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-2"
          >
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              Répétez sans partenaire
            </h2>
            <p className="text-sm text-muted-foreground">
              Importez votre texte, choisissez votre rôle, l'app vous donne la réplique
            </p>
          </motion.div>

          {/* Dernier script */}
          {!isLoadingLast && lastScript && step === 'upload' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-primary/40 rounded-lg p-3 space-y-2"
            >
              <p className="text-sm font-semibold text-foreground">{lastScript.title}</p>
              <p className="text-xs text-muted-foreground">
                {lastScript.my_character} · {lastScript.lines?.length} répliques
              </p>
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => navigate(`/android/rehearsal?scriptId=${lastScript.id}`)}
                >
                  <Mic className="w-3 h-3 mr-1" /> Répéter
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={() => navigate(`/android/read-through?scriptId=${lastScript.id}`)}
                >
                  <Play className="w-3 h-3 mr-1" /> Lire
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs"
                  onClick={() => handleEditLastScript(lastScript)}
                >
                  <Pencil className="w-3 h-3" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Étapes */}
          <div className="flex items-center justify-center gap-1 text-xs">
            {['upload', 'summary', 'character'].map((s, i) => (
              <div key={s} className="flex items-center gap-1">
                {i > 0 && <div className="w-6 h-px bg-border" />}
                <div className={`px-2 py-1 rounded-full ${
                  step === s ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
                }`}>
                  {s === 'upload' ? '📄' : s === 'summary' ? '✓' : '🎭'}
                </div>
              </div>
            ))}
          </div>

          {/* Contenu par étape */}
          <AnimatePresence mode="wait">
            {step === 'upload' && (
              <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <FileUploader onFileUploaded={handleFileUploaded} isProcessing={isProcessing} progress={progress} />
              </motion.div>
            )}

            {step === 'summary' && parsedScript && (
              <motion.div key="summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <ScriptSummary 
                   parsedScript={parsedScript}
                   onContinue={() => {
                     if (parsedScript.characters?.length > 0 && !selectedCharacter) {
                       setSelectedCharacter(parsedScript.characters[0]);
                     }
                     setTimeout(() => {
                       setStep('character');
                       navigate('/android/?step=character', { replace: true });
                     }, 50);
                   }}
                 />
              </motion.div>
            )}

            {step === 'character' && parsedScript && (
              <motion.div key="character" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                <div className="text-center space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {editingScriptId ? 'Modifier le rôle :' : 'Sélectionnez votre rôle'}
                  </p>
                  <p className="text-lg font-bold text-foreground">{parsedScript.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {parsedScript.lines?.length} répliques
                  </p>
                </div>

                {parsedScript.characters?.length > 0 ? (
                  <CharacterSelector
                    characters={parsedScript.characters}
                    selected={selectedCharacter}
                    onSelect={handleCharacterSelect}
                    genders={characterGenders}
                    onGenderChange={handleGenderChange}
                  />
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground text-center">
                      Votre personnage :
                    </p>
                    <Input
                      placeholder="Ex: ALBERT"
                      value={selectedCharacter}
                      onChange={(e) => setSelectedCharacter(e.target.value)}
                      className="text-center text-sm"
                    />
                  </div>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2 pt-2"
                  style={{ display: selectedCharacter ? 'block' : 'none' }}
                >
                    <Button
                      size="lg"
                      onClick={handleStart}
                      disabled={isProcessing}
                      className="w-full bg-primary text-primary-foreground text-sm gap-2"
                    >
                      {isProcessing ? '⏳' : <Mic className="w-4 h-4" />}
                      Commencer
                    </Button>

                    <Button
                      size="lg"
                      variant="outline"
                      onClick={async () => {
                        if (!selectedCharacter || !parsedScript) return;
                        setIsProcessing(true);
                        if (editingScriptId) {
                          await base44.entities.Script.update(editingScriptId, {
                            character_genders: characterGenders,
                            my_character: selectedCharacter
                          });
                          navigate(`/android/read-through?scriptId=${editingScriptId}`);
                          return;
                        }
                        const script = await base44.entities.Script.create({
                          title: parsedScript.title,
                          file_url: fileUrl,
                          characters: parsedScript.characters,
                          character_genders: characterGenders,
                          lines: parsedScript.lines,
                          my_character: selectedCharacter
                        });
                        navigate(`/android/read-through?scriptId=${script.id}`);
                      }}
                      disabled={isProcessing}
                      className="w-full border-primary/40 text-primary hover:bg-primary/10 text-sm gap-2"
                    >
                      <Play className="w-4 h-4" />
                      Lire
                    </Button>
                    </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Features - Upload only */}
          {step === 'upload' && !isProcessing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-1 gap-3 pt-2"
            >
              {[
                { icon: BookOpen, title: 'Import intelligent', desc: 'Détecte les personnages' },
                { icon: Mic, title: 'Reconnaissance vocale', desc: 'Analyse en temps réel' },
                { icon: Sparkles, title: 'Comparaison IA', desc: 'Feedback sur vos erreurs' }
              ].map((f) => (
                <div key={f.title} className="p-3 rounded-lg bg-card border border-border space-y-1">
                  <p className="font-semibold text-xs text-foreground flex items-center gap-2">
                    <f.icon className="w-4 h-4 text-primary" /> {f.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{f.desc}</p>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}