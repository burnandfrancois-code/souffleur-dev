import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('github');

    // Récupérer les repos de l'utilisateur
    const reposRes = await fetch('https://api.github.com/user/repos?type=owner&per_page=100', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const repos = await reposRes.json();

    // Récupérer les PRs en attente de révision pour chaque repo
    const allPRs = [];
    for (const repo of repos) {
      const prsRes = await fetch(
        `https://api.github.com/repos/${repo.owner.login}/${repo.name}/pulls?state=open&per_page=100`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      const prs = await prsRes.json();
      
      // Filtrer les PRs en attente de révision (review_requested)
      const pendingReviewPRs = prs.filter(pr => pr.requested_reviewers && pr.requested_reviewers.length > 0);
      
      allPRs.push(...pendingReviewPRs.map(pr => ({
        id: pr.id,
        title: pr.title,
        url: pr.html_url,
        repo: repo.name,
        author: pr.user.login,
        created_at: pr.created_at,
        requested_reviewers: pr.requested_reviewers.map(r => r.login)
      })));
    }

    return Response.json({ pull_requests: allPRs });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});