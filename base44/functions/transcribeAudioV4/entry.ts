import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const audioBase64 = body.audio;
    if (!audioBase64) return Response.json({ error: 'No audio provided' }, { status: 400 });

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) return Response.json({ error: 'API key not configured' }, { status: 500 });

    console.log('[V4] Starting transcription, base64 length:', audioBase64.length, 'API key set:', !!apiKey);

    // Décoder base64 en bytes
    const cleanBase64 = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;
    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    console.log('[V4] Decoded audio, bytes length:', bytes.length);
    
    if (bytes.length === 0) {
      return Response.json({ error: 'Audio is empty' }, { status: 400 });
    }

    // Créer FormData avec le fichier audio
    const formData = new FormData();
    const blob = new Blob([bytes], { type: 'audio/webm' });
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'fr');

    console.log('[V4] Sending to OpenAI, blob size:', blob.size);

    // Appeler OpenAI Whisper
    const openaiResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });

    console.log('[V4] OpenAI response status:', openaiResponse.status);

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('[V4] OpenAI error:', errorText);
      return Response.json({ 
        error: 'Transcription failed', 
        details: errorText,
        status: openaiResponse.status
      }, { status: openaiResponse.status });
    }

    const result = await openaiResponse.json();
    console.log('[V4] OpenAI result:', result);

    return Response.json({ 
      text: result.text || '', 
      success: true 
    });
  } catch (error) {
    console.error('[V4] Error:', error.message, error.stack);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});