import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const audioBase64 = body.audio;
    if (!audioBase64) return Response.json({ error: 'No audio provided' }, { status: 400 });

    const apiKey = Deno.env.get('OPENAI_API_KEY') || '';
    console.log('[V5] API key exists:', apiKey.length > 0, 'Length:', apiKey.length, 'Starts with:', apiKey.substring(0, 10));

    if (!apiKey || apiKey.length < 20) {
      return Response.json({ error: 'API key not configured or invalid' }, { status: 500 });
    }

    // Décoder base64
    const cleanBase64 = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;
    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    if (bytes.length === 0) {
      return Response.json({ error: 'Audio is empty' }, { status: 400 });
    }

    console.log('[V5] Audio decoded, size:', bytes.length, 'bytes');

    // Créer FormData
    const formData = new FormData();
    const blob = new Blob([bytes], { type: 'audio/webm' });
    formData.append('file', blob, 'audio.webm');
    formData.append('model', 'whisper-1');
    formData.append('language', 'fr');

    // Appeler OpenAI
    console.log('[V5] Calling OpenAI with key:', apiKey.substring(0, 20) + '...');
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });

    console.log('[V5] OpenAI response status:', response.status);
    const data = await response.json();
    console.log('[V5] OpenAI response data:', JSON.stringify(data).substring(0, 200));

    if (!response.ok) {
      return Response.json({ 
        error: 'OpenAI failed', 
        details: data,
        status: response.status
      }, { status: response.status });
    }

    return Response.json({ 
      text: data.text || '', 
      success: true 
    });
  } catch (error) {
    console.error('[V5] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});