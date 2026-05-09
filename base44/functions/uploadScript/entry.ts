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

    console.log(`[uploadScript] Uploading file: ${file.name} (${file.size} bytes)`);

    // Upload file using the Base44 SDK
    const result = await base44.asServiceRole.integrations.Core.UploadFile({ file });

    console.log(`[uploadScript] Upload successful:`, result);

    return Response.json({
      file_url: result.file_url,
      file_name: file.name
    });
  } catch (error) {
    console.error('[uploadScript] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});