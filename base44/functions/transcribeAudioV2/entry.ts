import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const audioBase64 = body.audio;
    if (!audioBase64) return Response.json({ error: 'No audio provided' }, { status: 400 });

    // Nettoyer la clé API : ne garder que les caractères ASCII imprimables valides
    const rawKey = Deno.env.get('OPENAI_API_KEY') || '';
    const apiKey = Array.from(rawKey)
      .filter(c => c.charCodeAt(0) >= 33 && c.charCodeAt(0) <= 126)
      .join('');

    if (!apiKey) return Response.json({ error: 'API key not configured' }, { status: 500 });

    // Décoder base64 → bytes
    const cleanBase64 = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;
    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

    const formData = new FormData();
    formData.append('file', new File([bytes], 'audio.webm', { type: 'audio/webm' }));
    formData.append('model', 'whisper-1');
    formData.append('language', 'fr');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.text();
      return Response.json({ error: 'Transcription failed', details: err }, { status: 500 });
    }

    const data = await response.json();
    return Response.json({ text: data.text || '', success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});