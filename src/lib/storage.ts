// Storage utilities for artifacts and sessions
// Using localStorage for simplicity (could be upgraded to IndexedDB)

import type { Artifact, ArtifactRevision } from "@/types/artifacts";

const ARTIFACTS_KEY = "max_artifacts";
const REVISIONS_KEY = "max_revisions";
const MAX_ARTIFACT_SIZE = 5 * 1024 * 1024; // 5MB

// Generate unique IDs
export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
}

// Artifact CRUD operations
export function saveArtifact(artifact: Artifact): Artifact {
  // Validate size
  if (artifact.content.length > MAX_ARTIFACT_SIZE) {
    throw new Error(`Artifact exceeds maximum size of ${MAX_ARTIFACT_SIZE} bytes`);
  }

  const artifacts = getArtifacts();
  const existingIndex = artifacts.findIndex((a) => a.id === artifact.id);

  // Normalize
  const normalized: Artifact = {
    ...artifact,
    filename: artifact.filename.trim(),
    title: artifact.title.trim(),
    tags: artifact.tags ? [...new Set(artifact.tags.map((t) => t.trim()))] : undefined,
    updatedAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    // Update existing - create revision first
    const existing = artifacts[existingIndex];
    createRevision({
      id: generateId(),
      artifactId: existing.id,
      sessionId: existing.sessionId,
      filename: existing.filename,
      content: existing.content,
      createdAt: new Date().toISOString(),
      source: "update",
    });
    artifacts[existingIndex] = normalized;
  } else {
    // Create new
    normalized.createdAt = normalized.createdAt || new Date().toISOString();
    artifacts.push(normalized);
    // Create initial revision
    createRevision({
      id: generateId(),
      artifactId: normalized.id,
      sessionId: normalized.sessionId,
      filename: normalized.filename,
      content: normalized.content,
      createdAt: new Date().toISOString(),
      source: "create",
    });
  }

  localStorage.setItem(ARTIFACTS_KEY, JSON.stringify(artifacts));
  return normalized;
}

export function getArtifacts(): Artifact[] {
  try {
    const data = localStorage.getItem(ARTIFACTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function getArtifact(id: string): Artifact | null {
  const artifacts = getArtifacts();
  return artifacts.find((a) => a.id === id) || null;
}

export function getArtifactsBySession(sessionId: string): Artifact[] {
  return getArtifacts().filter((a) => a.sessionId === sessionId);
}

export function deleteArtifact(id: string): boolean {
  const artifacts = getArtifacts();
  const filtered = artifacts.filter((a) => a.id !== id);
  if (filtered.length < artifacts.length) {
    localStorage.setItem(ARTIFACTS_KEY, JSON.stringify(filtered));
    // Also delete revisions
    const revisions = getRevisions().filter((r) => r.artifactId !== id);
    localStorage.setItem(REVISIONS_KEY, JSON.stringify(revisions));
    return true;
  }
  return false;
}

// Revision operations
function createRevision(revision: ArtifactRevision): void {
  const revisions = getRevisions();
  revisions.push(revision);
  // Keep max 50 revisions per artifact
  const byArtifact = new Map<string, ArtifactRevision[]>();
  for (const r of revisions) {
    const list = byArtifact.get(r.artifactId) || [];
    list.push(r);
    byArtifact.set(r.artifactId, list);
  }
  const pruned: ArtifactRevision[] = [];
  for (const list of byArtifact.values()) {
    // Sort by date descending and keep latest 50
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    pruned.push(...list.slice(0, 50));
  }
  localStorage.setItem(REVISIONS_KEY, JSON.stringify(pruned));
}

export function getRevisions(): ArtifactRevision[] {
  try {
    const data = localStorage.getItem(REVISIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function getArtifactRevisions(artifactId: string): ArtifactRevision[] {
  return getRevisions()
    .filter((r) => r.artifactId === artifactId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function restoreRevision(revisionId: string): Artifact | null {
  const revisions = getRevisions();
  const revision = revisions.find((r) => r.id === revisionId);
  if (!revision) return null;

  const artifact = getArtifact(revision.artifactId);
  if (!artifact) return null;

  // Save with restored content
  return saveArtifact({
    ...artifact,
    content: revision.content,
    filename: revision.filename,
  });
}

// Search artifacts with fuzzy matching
export function searchArtifacts(
  query: string,
  sessionId?: string
): Artifact[] {
  const artifacts = sessionId ? getArtifactsBySession(sessionId) : getArtifacts();

  if (!query.trim()) return artifacts;

  const lowerQuery = query.toLowerCase();
  return artifacts.filter((a) => {
    return (
      a.filename.toLowerCase().includes(lowerQuery) ||
      a.title.toLowerCase().includes(lowerQuery) ||
      a.kind.toLowerCase().includes(lowerQuery) ||
      a.tags?.some((t) => t.toLowerCase().includes(lowerQuery)) ||
      a.content.toLowerCase().includes(lowerQuery)
    );
  });
}

// Diff utilities for showing changes
export function computeLineDiff(
  oldContent: string,
  newContent: string
): { type: "add" | "remove" | "same"; line: string }[] {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");
  const result: { type: "add" | "remove" | "same"; line: string }[] = [];

  // Simple LCS-based diff
  const lcs = computeLCS(oldLines, newLines);
  let oldIdx = 0;
  let newIdx = 0;
  let lcsIdx = 0;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    if (lcsIdx < lcs.length && oldLines[oldIdx] === lcs[lcsIdx] && newLines[newIdx] === lcs[lcsIdx]) {
      result.push({ type: "same", line: lcs[lcsIdx] });
      oldIdx++;
      newIdx++;
      lcsIdx++;
    } else if (oldIdx < oldLines.length && (lcsIdx >= lcs.length || oldLines[oldIdx] !== lcs[lcsIdx])) {
      result.push({ type: "remove", line: oldLines[oldIdx] });
      oldIdx++;
    } else if (newIdx < newLines.length) {
      result.push({ type: "add", line: newLines[newIdx] });
      newIdx++;
    }
  }

  return result;
}

// Compute Longest Common Subsequence
function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find LCS
  const lcs: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}
