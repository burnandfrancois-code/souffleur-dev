import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { repoName, repoOwner } = await req.json();

    if (!repoName || !repoOwner) {
      return Response.json({ error: 'Repo name and owner required' }, { status: 400 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('github');

    // Récupérer les issues du repo spécifique
    const issuesRes = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/issues?state=all&per_page=100`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    const issues = await issuesRes.json();

    // Filtrer les issues (pas les PRs) et préparer les données
    const allIssues = issues
      .filter(issue => !issue.pull_request)
      .map(issue => ({
        github_id: issue.id,
        title: issue.title,
        description: issue.body || '',
        repo: repoName,
        author: issue.user.login,
        url: issue.html_url,
        state: issue.state,
        labels: issue.labels.map(l => l.name),
        created_at: issue.created_at
      }));

    // Insérer en base
    if (allIssues.length > 0) {
      await base44.entities.Issue.bulkCreate(allIssues);
    }

    return Response.json({ 
      message: `${allIssues.length} issues importées depuis ${repoName}`,
      count: allIssues.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});