import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse JSON body
    const body = await req.json();
    const audioBase64 = body.audio;

    if (!audioBase64) {
      return Response.json({ error: 'No audio provided' }, { status: 400 });
    }

    // Convertir base64 en Uint8Array
    const binaryString = atob(audioBase64.split(',')[1] || audioBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Créer FormData avec le fichier audio
    const formData = new FormData();
    formData.append('file', new File([bytes], 'audio.webm', { type: 'audio/webm' }));
    formData.append('model', 'whisper-1');
    formData.append('language', 'fr');

    // Appeler OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[Whisper] Error:', err);
      return Response.json({ error: 'Transcription failed', details: err }, { status: 500 });
    }

    const data = await response.json();

    return Response.json({
      text: data.text || '',
      success: true,
    });
  } catch (error) {
    console.error('[transcribeAudio] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});