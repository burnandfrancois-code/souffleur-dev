import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const audioBase64 = body.audio;
    if (!audioBase64) return Response.json({ error: 'No audio provided' }, { status: 400 });

    console.log('[V3] Starting transcription, base64 length:', audioBase64.length);

    // Décoder base64 en bytes
    const cleanBase64 = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;
    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    console.log('[V3] Decoded audio, bytes length:', bytes.length);

    // Upload le fichier audio
    const uploadResult = await base44.integrations.Core.UploadFile({
      file: new File([bytes], 'audio.webm', { type: 'audio/webm' })
    });

    const fileUrl = uploadResult.file_url;
    console.log('[V3] Uploaded audio to:', fileUrl);

    // Utilise InvokeLLM avec vision pour transcrire
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: 'Transcribe the following audio file in French. Return ONLY the transcribed text, nothing else.',
      file_urls: [fileUrl],
      model: 'gemini_3_flash'
    });

    console.log('[V3] Transcription result:', result);

    return Response.json({ 
      text: result || '', 
      success: true 
    });
  } catch (error) {
    console.error('[V3] Error:', error.message);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});