// github.js — minimal GitHub REST client.
// Reads via the branches/trees/blobs endpoints (raw.githubusercontent.com when
// no token is set), writes one atomic commit per save via the git data API.
//
// Errors carry a `code`; the UI translates known codes and falls back to the
// English `message` for anything unexpected.

import { b64DecodeUtf8, b64EncodeUtf8 } from './util.js';

export class GHError extends Error {
  constructor(message, code, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const encPath = p => p.split('/').map(encodeURIComponent).join('/');

export class GitHubClient {
  constructor({ owner, repo, branch, token }) {
    this.owner = owner;
    this.repo = repo;
    this.branch = branch || 'main';
    this.token = token || '';
  }

  async req(path, { method = 'GET', body } = {}) {
    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (this.token) headers.Authorization = 'Bearer ' + this.token;
    let res;
    try {
      res = await fetch(`https://api.github.com/${path}`, {
        method, headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new GHError('Network error — GitHub is unreachable (offline?).', 'network', 0);
    }
    if (res.ok) return res.status === 204 ? null : res.json();

    let detail = '';
    try { detail = (await res.json()).message || ''; } catch { }
    if (res.status === 401) throw new GHError('GitHub rejected the token (401).', 'auth', 401);
    if (res.status === 404) throw new GHError(`Not found: ${path.split('?')[0]}`, 'not-found', 404);
    if (res.status === 403 || res.status === 429) {
      if (res.headers.get('x-ratelimit-remaining') === '0') {
        const reset = res.headers.get('x-ratelimit-reset');
        const at = reset ? new Date(reset * 1000).toLocaleTimeString() : '';
        const e = new GHError('GitHub API rate limit reached.', 'rate-limit', res.status);
        e.resetAt = at;
        throw e;
      }
      if (/not accessible by (personal access token|integration)/i.test(detail)) {
        throw new GHError(`The token cannot access ${this.owner}/${this.repo}.`, 'forbidden', res.status);
      }
      throw new GHError(detail || 'GitHub denied the request (403).', 'forbidden', res.status);
    }
    if (/repository is empty/i.test(detail)) throw new GHError('The repository has no commits yet.', 'empty-repo', res.status);
    if (res.status === 409 || res.status === 422) throw new GHError(detail || 'GitHub reported a conflict.', 'conflict', res.status);
    throw new GHError(detail || `GitHub API error (${res.status}).`, 'api', res.status);
  }

  base() { return `repos/${this.owner}/${this.repo}`; }

  async getRepo() { return this.req(this.base()); }

  // Head of the configured branch, or null if the repo exists but is empty /
  // the branch doesn't exist yet.
  async getHead() {
    try {
      const b = await this.req(`${this.base()}/branches/${encodeURIComponent(this.branch)}`);
      return { sha: b.commit.sha, treeSha: b.commit.commit.tree.sha };
    } catch (e) {
      if (e.code === 'not-found' || e.code === 'conflict' || e.code === 'empty-repo') {
        await this.getRepo();
        return null;
      }
      throw e;
    }
  }

  async getTree(treeSha) {
    const r = await this.req(`${this.base()}/git/trees/${treeSha}?recursive=1`);
    return r.tree || [];
  }

  async getBlobText(sha) {
    const r = await this.req(`${this.base()}/git/blobs/${sha}`);
    return b64DecodeUtf8(r.content || '');
  }

  rawUrl(ref, path) {
    return `https://raw.githubusercontent.com/${this.owner}/${this.repo}/${ref}/${encPath(path)}`;
  }

  async getRawText(ref, path) {
    const res = await fetch(this.rawUrl(ref, path));
    if (!res.ok) throw new GHError(`Could not fetch ${path} (${res.status}).`, 'raw', res.status);
    return res.text();
  }

  // Real permission probes. `GET /repos/…` is useless as a test — it succeeds
  // for any public repo and reports the *user's* rights, not the token's.
  // Writing an unreferenced blob is invisible and garbage-collected, so it is a
  // safe write probe.
  async probe() {
    const out = { read: false, write: false };
    try {
      await this.getHead();
      out.read = true;
    } catch (e) {
      throw e;
    }
    if (!this.token) return out;
    try {
      await this.req(`${this.base()}/git/blobs`, {
        method: 'POST', body: { content: 'kanban probe', encoding: 'utf-8' },
      });
      out.write = true;
    } catch (e) {
      if (e.code === 'forbidden' || e.code === 'auth') return out;
      if (e.code === 'conflict' || e.code === 'empty-repo') { out.write = true; return out; }
      throw e;
    }
    return out;
  }

  // changes: [{path, text} | {path, base64} | {path, delete: true}]
  // parent: {sha, treeSha} or null for an empty repo (bootstraps the branch).
  async commitFiles({ message, parent, changes }) {
    if (!parent) {
      // A completely empty repository rejects every git-data call with
      // 409 "Git Repository is empty". The contents API is the one endpoint
      // that can create the first commit, so the first file goes through it
      // (creating the branch), and the rest follow as a normal commit.
      const creates = changes.filter(ch => !ch.delete);
      if (!creates.length) return null;
      const first = creates[0];
      await this.req(`${this.base()}/contents/${encPath(first.path)}`, {
        method: 'PUT',
        body: {
          message,
          content: first.base64 != null ? first.base64 : b64EncodeUtf8(first.text),
          branch: this.branch,
        },
      });
      const head = await this.getHead();
      if (!head) throw new GHError('The repository was initialized but its branch could not be found.', 'not-found', 404);
      const rest = creates.slice(1);
      if (!rest.length) return head;
      return this.commitFiles({ message, parent: head, changes: rest });
    }

    const tree = [];
    for (const ch of changes) {
      if (ch.delete) {
        tree.push({ path: ch.path, mode: '100644', type: 'blob', sha: null });
      } else if (ch.base64 != null) {
        const blob = await this.req(`${this.base()}/git/blobs`, {
          method: 'POST', body: { content: ch.base64, encoding: 'base64' },
        });
        tree.push({ path: ch.path, mode: '100644', type: 'blob', sha: blob.sha });
      } else {
        tree.push({ path: ch.path, mode: '100644', type: 'blob', content: ch.text });
      }
    }
    if (!tree.length) return null;
    const newTree = await this.req(`${this.base()}/git/trees`, {
      method: 'POST',
      body: { base_tree: parent.treeSha, tree },
    });
    const commit = await this.req(`${this.base()}/git/commits`, {
      method: 'POST',
      body: { message, tree: newTree.sha, parents: [parent.sha] },
    });
    await this.req(`${this.base()}/git/refs/heads/${encodeURIComponent(this.branch)}`, {
      method: 'PATCH', body: { sha: commit.sha },
    });
    return { sha: commit.sha, treeSha: newTree.sha };
  }
}
