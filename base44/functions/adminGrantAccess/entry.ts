import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { email, grantType, planId } = await req.json();

    if (!email || !grantType) {
      return Response.json({ error: 'Missing email or grantType' }, { status: 400 });
    }

    const users = await base44.asServiceRole.entities.User.filter({ email });
    if (users.length === 0) {
      return Response.json({ error: 'Utilisateur introuvable' }, { status: 404 });
    }

    const targetUser = users[0];
    const updates = {};

    if (grantType === 'trial') {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 7);
      updates.subscription_status = 'trial';
      updates.subscription_plan = 'free_trial';
      updates.subscription_end_date = trialEnd.toISOString().split('T')[0];
    } else if (grantType === 'paid') {
      if (!planId) {
        return Response.json({ error: 'planId required for paid grant' }, { status: 400 });
      }
      updates.subscription_status = 'active';
      updates.subscription_plan = planId;
      updates.subscription_end_date = null;
    }

    await base44.asServiceRole.entities.User.update(targetUser.id, updates);

    return Response.json({ success: true, targetUser: targetUser.email });
  } catch (error) {
    console.error('[adminGrantAccess]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});