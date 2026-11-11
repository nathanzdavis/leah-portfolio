const api = 'https://api.github.com';

function config() {
  const token = process.env.GITHUB_EDITOR_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY || 'nathanzdavis/leah-portfolio';
  const [owner, repo] = repository.split('/');
  if (!token || !owner || !repo) throw new Error('GitHub editor storage is not configured.');
  return { token, owner, repo, branch: process.env.GITHUB_PRODUCTION_BRANCH || 'master', draftBranch: process.env.GITHUB_DRAFT_BRANCH || 'editor-drafts' };
}

async function request(path, init = {}) {
  const { token } = config();
  const response = await fetch(`${api}${path}`, { ...init, headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', ...init.headers }, cache: 'no-store' });
  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`GitHub API ${response.status}: ${body.slice(0, 500)}`);
    error.status = response.status; throw error;
  }
  return response.status === 204 ? null : response.json();
}

export function githubConfigured() { try { config(); return true; } catch { return false; } }

export async function ensureDraftBranch() {
  const { owner, repo, branch, draftBranch } = config();
  try { await request(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(draftBranch)}`); }
  catch (error) {
    if (error.status !== 404) throw error;
    const base = await request(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
    await request(`/repos/${owner}/${repo}/git/refs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: `refs/heads/${draftBranch}`, sha: base.object.sha }) });
  }
}

export async function readJsonFile(filePath, branch) {
  const { owner, repo } = config();
  const data = await request(`/repos/${owner}/${repo}/contents/${filePath}?ref=${encodeURIComponent(branch)}`);
  return { value: JSON.parse(Buffer.from(data.content, 'base64').toString('utf8')), sha: data.sha };
}

export async function writeJsonFile(filePath, value, branch, message) {
  const { owner, repo } = config();
  let sha;
  try { sha = (await request(`/repos/${owner}/${repo}/contents/${filePath}?ref=${encodeURIComponent(branch)}`)).sha; } catch (error) { if (error.status !== 404) throw error; }
  return request(`/repos/${owner}/${repo}/contents/${filePath}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, branch, content: Buffer.from(`${JSON.stringify(value, null, 2)}\n`).toString('base64'), ...(sha ? { sha } : {}) }) });
}

export async function writeBinaryFile(filePath, base64, branch, message) {
  const { owner, repo } = config();
  let sha;
  try { sha = (await request(`/repos/${owner}/${repo}/contents/${filePath}?ref=${encodeURIComponent(branch)}`)).sha; } catch (error) { if (error.status !== 404) throw error; }
  return request(`/repos/${owner}/${repo}/contents/${filePath}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, branch, content: base64, ...(sha ? { sha } : {}) }) });
}

export async function readBinaryFile(filePath, branch) {
  const { owner, repo } = config();
  return request(`/repos/${owner}/${repo}/contents/${filePath}?ref=${encodeURIComponent(branch)}`);
}

export async function saveDraftToGithub(doc) {
  const { draftBranch } = config(); await ensureDraftBranch();
  return writeJsonFile('.editor/draft.json', doc, draftBranch, 'Save visual editor draft');
}

export async function loadDraftFromGithub() {
  const { draftBranch } = config(); await ensureDraftBranch();
  try { return (await readJsonFile('.editor/draft.json', draftBranch)).value; } catch (error) { if (error.status === 404) return null; throw error; }
}

export async function publishToGithub(doc) {
  const { owner, repo, branch, draftBranch } = config();
  await ensureDraftBranch();
  await writeJsonFile('content/site.json', doc, draftBranch, `Prepare website revision ${doc.revision}`);
  const merge = await request(`/repos/${owner}/${repo}/merges`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ base: branch, head: draftBranch, commit_message: `Publish website from visual editor (revision ${doc.revision})` }) });
  return merge || request(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
}

export async function uploadMediaToGithub(filePath, base64) {
  const { draftBranch } = config(); await ensureDraftBranch();
  return writeBinaryFile(filePath, base64, draftBranch, `Upload media ${filePath.split('/').pop()}`);
}

export async function loadDraftMedia(filePath) { const { draftBranch } = config(); return readBinaryFile(filePath, draftBranch); }

export async function listPublishedVersions(limit = 20) {
  const { owner, repo, branch } = config();
  return request(`/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(branch)}&path=content/site.json&per_page=${limit}`);
}

export async function readPublishedVersion(sha) {
  return (await readJsonFile('content/site.json', sha)).value;
}
