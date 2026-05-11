import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export default function FileUploaderMobile({ onFileUploaded, isProcessing, progress }) {
  const fileInputRef = useRef(null);

  const handleFileSelect = async (file) => {
    if (!file) return;

    const validTypes = [
      'application/pdf',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];

    if (!validTypes.includes(file.type)) {
      toast.error('Format non supporté. Utilisez PDF, TXT ou Word.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (max 50 MB).');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    console.log(`[FileUploaderMobile] Starting upload: ${file.name} (${file.size} bytes, ${file.type})`);
    toast.loading('Téléchargement en cours...');

    try {
      // Utiliser le backend uploadScript pour la résilience sur mobile
      const formData = new FormData();
      formData.append('file', file);

      const result = await base44.functions.invoke('uploadScript', formData);

      console.log(`[FileUploaderMobile] Upload result:`, result);

      if (!result?.data?.file_url) {
        throw new Error('No file_url returned from upload');
      }

      console.log(`[FileUploaderMobile] Upload successful: ${result.data.file_url}`);
      toast.dismiss();
      onFileUploaded(result.data.file_url, result.data.file_name || file.name);
    } catch (error) {
      console.error('[FileUploaderMobile] Upload failed:', error);
      toast.dismiss();
      const errorMsg = error?.response?.data?.error || error?.message || 'Erreur lors du téléchargement';
      toast.error(
        errorMsg.includes('volumineux')
          ? 'Fichier trop volumineux. Essayez avec un plus petit fichier.'
          : 'Erreur lors du téléchargement. Vérifiez que le PDF est valide.'
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.doc,.docx"
        onChange={(e) => handleFileSelect(e.target.files?.[0])}
        className="hidden"
      />

      <motion.button
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={() => fileInputRef.current?.click()}
        disabled={isProcessing}
        className="w-full border-2 border-dashed border-primary/30 hover:border-primary/50 rounded-2xl p-8 text-center transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <Upload className="w-6 h-6 text-primary" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Déposer votre texte</p>
            <p className="text-xs text-muted-foreground">PDF texte (pas de PDF image)</p>
            <p className="text-xs text-muted-foreground">Max 50 MB</p>
          </div>
        </div>
      </motion.button>

      {progress > 0 && progress < 100 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-2 text-sm text-primary"
        >
          <span className="animate-spin">⏳</span>
          Upload en cours… {Math.round(progress)}%
        </motion.div>
      )}
    </div>
  );
}