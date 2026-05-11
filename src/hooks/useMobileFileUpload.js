import { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export function useMobileFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadFile = useCallback(async (file) => {
    if (!file) return null;

    const validTypes = [
      'application/pdf',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ];

    if (!validTypes.includes(file.type)) {
      toast.error('Format non supporté. Utilisez PDF, TXT ou Word.');
      return null;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (max 50 MB).');
      return null;
    }

    const isAndroid = /Android/i.test(navigator.userAgent);
    const funcName = isAndroid ? 'uploadScriptMobile' : 'uploadScript';

    console.log(`[useMobileFileUpload] Using ${funcName} for ${file.name} (${file.size} bytes)`);
    setIsUploading(true);
    setUploadProgress(0);
    toast.loading('Téléchargement en cours...');

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Appeler la fonction appropriée
      const result = await base44.functions.invoke(funcName, formData);

      if (!result?.data?.file_url) {
        throw new Error('No file_url returned from upload');
      }

      console.log(`[useMobileFileUpload] Upload successful: ${result.data.file_url}`);
      toast.dismiss();
      setIsUploading(false);
      setUploadProgress(100);

      return {
        file_url: result.data.file_url,
        file_name: result.data.file_name || file.name,
        size: result.data.size || file.size
      };
    } catch (error) {
      console.error('[useMobileFileUpload] Upload failed:', error);
      toast.dismiss();
      setIsUploading(false);
      setUploadProgress(0);

      const errorMsg = error?.response?.data?.error || error?.message || 'Erreur lors du téléchargement';
      const userMsg = errorMsg.includes('timeout')
        ? 'Connexion instable. Essayez avec un fichier plus petit (max 20MB).'
        : errorMsg.includes('volumineux')
        ? 'Fichier trop volumineux. Essayez avec un plus petit fichier.'
        : 'Erreur lors du téléchargement. Vérifiez que le PDF est valide.';

      toast.error(userMsg);
      return null;
    }
  }, []);

  return {
    uploadFile,
    isUploading,
    uploadProgress
  };
}