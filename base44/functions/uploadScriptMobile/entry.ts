import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log(`[uploadScriptMobile] Mobile upload: ${file.name} (${file.size} bytes)`);

    // Timeout de 60s pour éviter les blocages sur mobile
    const uploadPromise = base44.asServiceRole.integrations.Core.UploadFile({ file });
    
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Upload timeout: connexion instable. Essayez avec un fichier plus petit.')), 60000)
    );

    const result = await Promise.race([uploadPromise, timeoutPromise]);

    console.log(`[uploadScriptMobile] Upload successful: ${result.file_url}`);

    return Response.json({
      file_url: result.file_url,
      file_name: file.name,
      size: file.size
    });
  } catch (error) {
    console.error('[uploadScriptMobile] Error:', error.message);
    const errorMsg = error.message.includes('timeout') 
      ? 'Connexion instable. Essayez avec un fichier plus petit (max 20MB).'
      : error.message;
    return Response.json({ error: errorMsg }, { status: 500 });
  }
});