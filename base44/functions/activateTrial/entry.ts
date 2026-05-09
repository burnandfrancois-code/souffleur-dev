import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.trial_used_date) {
      return Response.json(
        { error: 'Essai gratuit déjà utilisé.' },
        { status: 400 }
      );
    }

    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 7);

    await base44.auth.updateMe({
      subscription_status: 'trial',
      subscription_plan: 'free_trial',
      subscription_end_date: trialEnd.toISOString().split('T')[0],
      trial_used_date: new Date().toISOString().split('T')[0],
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});