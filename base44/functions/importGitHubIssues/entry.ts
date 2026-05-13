import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('github');

    // Récupérer les repos
    const reposRes = await fetch('https://api.github.com/user/repos?type=owner&per_page=100', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const repos = await reposRes.json();

    // Récupérer toutes les issues
    const allIssues = [];
    for (const repo of repos) {
      const issuesRes = await fetch(
        `https://api.github.com/repos/${repo.owner.login}/${repo.name}/issues?state=all&per_page=100`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      const issues = await issuesRes.json();
      
      allIssues.push(...issues.filter(issue => !issue.pull_request).map(issue => ({
        github_id: issue.id,
        title: issue.title,
        description: issue.body || '',
        repo: repo.name,
        author: issue.user.login,
        url: issue.html_url,
        state: issue.state,
        labels: issue.labels.map(l => l.name),
        created_at: issue.created_at
      })));
    }

    // Insérer les issues en base de données
    if (allIssues.length > 0) {
      await base44.entities.Issue.bulkCreate(allIssues);
    }

    return Response.json({ 
      message: `${allIssues.length} issues importées avec succès`,
      count: allIssues.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});