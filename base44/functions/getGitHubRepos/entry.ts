import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('github');

    const reposRes = await fetch('https://api.github.com/user/repos?type=owner&per_page=100', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const repos = await reposRes.json();

    const formattedRepos = repos.map(repo => ({
      name: repo.name,
      owner: repo.owner.login,
      description: repo.description || ''
    }));

    return Response.json({ repos: formattedRepos });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});