import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, File, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function FileUploader({ onFileUploaded, isProcessing, progress }) {
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
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (max 10 MB).');
      return;
    }

    try {
      console.log(`[FileUploader] Uploading: ${file.name} (${file.size} bytes, ${file.type})`);
      
      const { base44 } = await import('@/api/base44Client');
      
      // Create FormData for proper file upload
      const formData = new FormData();
      formData.append('file', file);
      
      const result = await base44.integrations.Core.UploadFile(formData);
      
      if (!result?.data?.file_url) {
        throw new Error('No file_url returned from upload');
      }
      
      console.log(`[FileUploader] Upload successful: ${result.data.file_url}`);
      onFileUploaded(result.data.file_url, file.name);
    } catch (error) {
      console.error('[FileUploader] Upload failed:', error);
      toast.error('Erreur lors du téléchargement. Vérifiez que le PDF est valide.');
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
            <p className="text-xs text-muted-foreground">
              PDF, TXT, Word · Max 10 MB
            </p>
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