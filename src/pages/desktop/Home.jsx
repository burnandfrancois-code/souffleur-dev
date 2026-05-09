import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Theater, Sparkles, Mic, BookOpen, Volume2, History, Play, Pencil, HelpCircle, CreditCard, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import FileUploader from '@/components/upload/FileUploader';
import CharacterSelector from '@/components/upload/CharacterSelector';
import ParseProgress from '@/components/upload/ParseProgress';
import ScriptSummary from '@/components/upload/ScriptSummary';
import { parseScriptWithLLM, verifyScriptIntegrity } from '@/lib/scriptParser';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';
import { useAuth } from '@/lib/AuthContext';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const subStatus = user?.subscription_status || 'none';
  const urlParams = new URLSearchParams(window.location.search);
  const initialStep = urlParams.get('step') || 'upload';
  const [step, setStep] = useState(initialStep);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [parsedScript, setParsedScript] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [selectedCharacter, setSelectedCharacter] = useState('');
  const [characterGenders, setCharacterGenders] = useState({});
  const [showDiffDetails, setShowDiffDetails] = useState(false);
  const [lastScript, setLastScript] = useState(null);
  const [isLoadingLast, setIsLoadingLast] = useState(true);
  const [isAndroid, setIsAndroid] = useState(false);
  const [editingScriptId, setEditingScriptId] = useState(null);
  const [integrityReport, setIntegrityReport] = useState(null);
  const [fileName, setFileName] = useState('');
  const [logs, setLogs] = useState([]);
  
  useEffect(() => {
    setIsAndroid(/Android/i.test(navigator.userAgent));
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
    const newStep = new URLSearchParams(window.location.search).get('step');
    if (newStep && newStep !== step) {
      setStep(newStep);
    }
  }, [window.location.search]);

  const handleGenderChange = (char, gender) => {
    setCharacterGenders(prev => ({ ...prev, [char]: gender }));
  };

  const handleFileUploaded = async (url, uploadedFileName) => {
    setFileUrl(url);
    setFileName(uploadedFileName);
    setIsProcessing(true);
    setProgress(0);
    setLogs([]);
    const startTime = Date.now();
    try {
      const result = await parseScriptWithLLM(url, uploadedFileName, (progressValue) => {
        setProgress(progressValue);
      }, (fileLogs) => {
        setLogs(fileLogs);
      });
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[Home] Parsing completed in ${duration}s`, result);
      
      if (!result) {
        toast.error('Aucune réponse du serveur. Le fichier est peut-être trop volumineux.');
        setIsProcessing(false);
        return;
      }
      
      if (!result.characters) {
        result.characters = [];
      }
      
      const parsed = {
        title: fileName,
        characters: result.characters,
        lines: result.lines || [],
        stats: result.stats || {}
      };
      
      const integrity = await verifyScriptIntegrity(result.rawText || '', parsed);
      setIntegrityReport(integrity);
      
      setParsedScript(parsed);
      setIsProcessing(false);
      setStep('summary');
      navigate('/desktop/?step=summary', { replace: true });
    } catch (err) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`[Home] Erreur analyse après ${duration}s:`, err);
      
      let message = err?.message || 'Impossible d\'analyser le fichier';
      if (err?.response?.status === 504) {
        message = 'Le fichier est trop volumineux ou le parsing a pris trop longtemps. Essayez un fichier plus court.';
      } else if (err?.code === 'ECONNABORTED') {
        message = 'Timeout lors de l\'analyse. Le fichier est peut-être trop grand.';
      }
      
      toast.error('Erreur : ' + message);
    } finally {
      // setIsProcessing(false) - handled after step change
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
    navigate('/desktop/?step=character', { replace: true });
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
      script = { ...script, id: editingScriptId };
      toast.success('Rôle et genres mis à jour !');
    } else {
      script = await base44.entities.Script.create({
        title: parsedScript.title,
        file_url: fileUrl,
        characters: parsedScript.characters,
        character_genders: characterGenders,
        lines: parsedScript.lines,
        my_character: selectedCharacter
      });
      toast.success('Texte analysé avec succès !');
    }
    setEditingScriptId(null);
    navigate(`/desktop/rehearsal?scriptId=${script.id}`);
  };

  return (
    <div className="min-h-screen flex flex-col pb-20 overflow-x-hidden">
      <header className="px-6 py-4 border-b border-border/50">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Theater className="w-7 h-7 text-primary" />
            <h1 className="text-xl font-bold text-foreground">
              SOUFFLEUR <span className="text-primary text-sm font-normal">by Happy Good Lines</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {!isAndroid && (
              <a href="/desktop/voice-test" className="text-xs text-muted-foreground hover:text-primary underline">Test des voix</a>
            )}
            <button
              onClick={() => navigate('/desktop/tarifs')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold text-xs transition-colors border ${
                subStatus === 'active'
                  ? 'border-green-500/40 text-green-400 bg-green-500/10 hover:bg-green-500/20'
                  : 'border-primary/40 text-primary bg-primary/10 hover:bg-primary/20'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              {subStatus === 'active' ? 'Mon abonnement' : subStatus === 'trial' ? 'Essai gratuit' : 'Voir les offres'}
            </button>
            <button
              onClick={() => navigate('/desktop/help')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-400 hover:bg-yellow-300 text-yellow-900 font-bold text-sm transition-colors shadow-md"
            >
              <HelpCircle className="w-4 h-4" />
              MODE D'EMPLOI
            </button>
          </div>
        </div>
      </header>

      {isProcessing && <ParseProgress fileName={fileName} progress={progress} logs={logs} />}

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-4xl mx-auto space-y-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-3"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Répétez votre texte
              <span className="text-primary"> sans partenaire</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-md mx-auto">
              Importez votre pièce, indiquez votre rôle, l'app vous donne la réplique, analyse et corrige vos erreurs
            </p>
          </motion.div>

          {!isLoadingLast && lastScript && step === 'upload' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-primary/40 rounded-xl p-4 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <History className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{lastScript.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Rôle : {lastScript.my_character} · {lastScript.lines?.length} répliques
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <Button
                  size="sm"
                  className="bg-primary text-primary-foreground"
                  onClick={() => navigate(`/desktop/rehearsal?scriptId=${lastScript.id}`)}
                >
                  <Mic className="w-3 h-3 mr-1" /> Répéter
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-primary/40 text-primary text-xs"
                  onClick={() => navigate(`/desktop/read-through?scriptId=${lastScript.id}`)}
                >
                  <Play className="w-3 h-3 mr-1" /> Lire
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10 text-xs"
                  onClick={() => handleEditLastScript(lastScript)}
                >
                  <Pencil className="w-3 h-3 mr-1" /> Modifier les voix
                </Button>
              </div>
            </motion.div>
          )}

          <div className="space-y-6">
            <div className="flex items-center justify-center gap-2">
              {[
                { key: 'upload', icon: BookOpen, label: 'Importer' },
                { key: 'summary', icon: Sparkles, label: 'Vérifier' },
                { key: 'character', icon: Sparkles, label: 'Personnage' },
                { key: 'ready', icon: Mic, label: 'Répéter' }
              ].map((s, i) => (
                <div key={s.key} className="flex items-center gap-2">
                  {i > 0 && (
                    <div className={`w-8 h-px ${step === s.key || (i === 1 && step === 'ready') ? 'bg-primary' : 'bg-border'}`} />
                  )}
                  <div className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-full text-sm
                    ${step === s.key ? 'bg-primary/10 text-primary border border-primary/30' : 'text-muted-foreground'}
                  `}>
                    <s.icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{s.label}</span>
                  </div>
                </div>
              ))}
            </div>

            {step === 'upload' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  <FileUploader onFileUploaded={handleFileUploaded} isProcessing={isProcessing} progress={progress} />
              </motion.div>
            )}

            {step === 'summary' && parsedScript && (
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                 <ScriptSummary 
                    parsedScript={parsedScript}
                    integrityReport={integrityReport}
                    onContinue={() => {
                      if (parsedScript.characters?.length > 0 && !selectedCharacter) {
                        setSelectedCharacter(parsedScript.characters[0]);
                      }
                      setTimeout(() => {
                        setStep('character');
                        navigate('/desktop/?step=character', { replace: true });
                      }, 50);
                    }}
                  />
               </motion.div>
             )}

            {step === 'character' && parsedScript && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    {editingScriptId ? 'Modifier le rôle et les genres :' : 'Pièce détectée :'}
                  </p>
                  <p className="text-xl font-bold text-foreground mt-1">{parsedScript.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {parsedScript.lines?.length} répliques · {parsedScript.characters?.length} personnages
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
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground text-center">
                      Saisissez le nom de votre personnage (tel qu'écrit dans le texte) :
                    </p>
                    <Input
                      placeholder="Ex: ALBERT, Albert, albert..."
                      value={selectedCharacter}
                      onChange={(e) => setSelectedCharacter(e.target.value)}
                      className="text-center"
                    />
                  </div>
                )}

                {!isAndroid && (
                  <div className="flex justify-center">
                    <a href="/desktop/voice-test" target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="gap-2 border-primary/40 text-primary hover:bg-primary/10">
                        <Volume2 className="w-4 h-4" />
                        🎙 Tester les voix avant de commencer
                      </Button>
                    </a>
                  </div>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center gap-3"
                  style={{ display: selectedCharacter ? 'flex' : 'none' }}
                >
                    <Button
                      size="lg"
                      onClick={handleStart}
                      disabled={isProcessing}
                      className="bg-primary text-primary-foreground text-base px-8 gap-2"
                    >
                      {isProcessing ? <span className="animate-spin">⏳</span> : <Mic className="w-5 h-5" />}
                      Commencer la répétition
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
                          const id = editingScriptId;
                          setEditingScriptId(null);
                          navigate(`/desktop/read-through?scriptId=${id}`);
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
                        navigate(`/desktop/read-through?scriptId=${script.id}`);
                      }}
                      disabled={isProcessing}
                      className="border-primary/40 text-primary hover:bg-primary/10 text-base px-8 gap-2"
                    >
                      <Play className="w-5 h-5" />
                      Lire sans interruption
                    </Button>
                    </motion.div>
              </motion.div>
            )}
          </div>

          {step === 'upload' && !isProcessing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4"
            >
              {[
                { icon: BookOpen, title: 'Import intelligent', desc: 'SOUFFLEUR détecte les personnages' },
                { icon: Mic, title: 'Reconnaissance vocale', desc: 'Dites votre texte, SOUFFLEUR le transcrit en temps réel' },
                { icon: Sparkles, title: 'Comparaison IA', desc: 'Analyse intelligente de vos erreurs et progression' }
              ].map((f) => (
                <div key={f.title} className="p-4 rounded-xl bg-card border border-border text-center space-y-2">
                  <f.icon className="w-6 h-6 text-primary mx-auto" />
                  <p className="font-semibold text-sm text-foreground">{f.title}</p>
                  <p className="text-xs text-muted-foreground">{f.desc}</p>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}