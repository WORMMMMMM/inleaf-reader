import { randomUUID } from 'crypto';
import * as path from 'path';
import * as vscode from 'vscode';
import { AtomicJsonFile } from './atomicJsonFile';
import { fingerprintPdf } from './pdfIdentity';
import {
  createDefaultResearchProfile,
  normalizeResearchProfile,
  type PaperBibliography,
  type PaperClassification,
  type ResearchArtifact,
  type ResearchFact,
  type ResearchFactStatus,
  type ResearchProfile,
  type ResearchRelation
} from './researchTypes';

export class ResearchStorage {
  private readonly file: AtomicJsonFile<ResearchProfile>;
  private fingerprintPromise?: Promise<string>;

  constructor(private readonly pdfUri: vscode.Uri) {
    const uri = vscode.Uri.file(path.join(
      path.dirname(pdfUri.fsPath),
      '.inleaf-reader',
      `${path.basename(pdfUri.fsPath)}.research.json`
    ));
    this.file = new AtomicJsonFile(
      uri,
      () => createDefaultResearchProfile('', pdfUri.fsPath),
      (value, fallback) => normalizeResearchProfile(value, fallback)
    );
  }

  get uri() {
    return this.file.uri;
  }

  fingerprint() {
    this.fingerprintPromise ??= fingerprintPdf(this.pdfUri.fsPath);
    return this.fingerprintPromise;
  }

  async readProfile(): Promise<ResearchProfile> {
    const [fingerprint, stored] = await Promise.all([this.fingerprint(), this.file.read()]);
    const fallback = createDefaultResearchProfile(fingerprint, this.pdfUri.fsPath);
    const profile = normalizeResearchProfile(stored, fallback);
    if (!profile.paperFingerprint) {
      profile.paperFingerprint = fingerprint;
    }
    if (profile.paperFingerprint !== fingerprint) {
      throw new Error(
        `Research profile fingerprint mismatch for ${path.basename(this.pdfUri.fsPath)}. ` +
        'The sidecar was not applied to this PDF.'
      );
    }
    return profile;
  }

  async updateProfile(input: {
    bibliography?: Partial<PaperBibliography>;
    classification?: Partial<PaperClassification>;
  }) {
    const fingerprint = await this.fingerprint();
    return this.file.mutate(stored => {
      const current = normalizeResearchProfile(
        stored,
        createDefaultResearchProfile(fingerprint, this.pdfUri.fsPath)
      );
      assertFingerprint(current, fingerprint);
      const next = normalizeResearchProfile({
        ...current,
        bibliography: { ...current.bibliography, ...input.bibliography },
        classification: { ...current.classification, ...input.classification },
        updatedAt: new Date().toISOString()
      }, current);
      next.paperFingerprint = fingerprint;
      return next;
    });
  }

  async addFact(input: Omit<ResearchFact, 'id' | 'createdAt' | 'updatedAt'>) {
    const fingerprint = await this.fingerprint();
    return this.file.mutate(stored => {
      const current = normalizedForMutation(stored, fingerprint, this.pdfUri.fsPath);
      const now = new Date().toISOString();
      const fact: ResearchFact = {
        ...input,
        id: randomUUID(),
        createdAt: now,
        updatedAt: now
      };
      return { ...current, facts: [fact, ...current.facts], updatedAt: now };
    });
  }

  async setFactStatus(id: string, status: ResearchFactStatus) {
    const fingerprint = await this.fingerprint();
    return this.file.mutate(stored => {
      const current = normalizedForMutation(stored, fingerprint, this.pdfUri.fsPath);
      const now = new Date().toISOString();
      let found = false;
      const facts = current.facts.map(fact => {
        if (fact.id !== id) return fact;
        found = true;
        return { ...fact, status, updatedAt: now };
      });
      if (!found) throw new Error('Research fact not found.');
      return { ...current, facts, updatedAt: now };
    });
  }

  async addArtifact(input: Omit<ResearchArtifact, 'id' | 'createdAt' | 'updatedAt'>) {
    const fingerprint = await this.fingerprint();
    return this.file.mutate(stored => {
      const current = normalizedForMutation(stored, fingerprint, this.pdfUri.fsPath);
      const now = new Date().toISOString();
      const artifact: ResearchArtifact = {
        ...input,
        id: randomUUID(),
        createdAt: now,
        updatedAt: now
      };
      return { ...current, artifacts: [artifact, ...current.artifacts], updatedAt: now };
    });
  }

  async updateArtifact(id: string, patch: Partial<Omit<ResearchArtifact, 'id' | 'createdAt'>>) {
    const fingerprint = await this.fingerprint();
    return this.file.mutate(stored => {
      const current = normalizedForMutation(stored, fingerprint, this.pdfUri.fsPath);
      const now = new Date().toISOString();
      let found = false;
      const artifacts = current.artifacts.map(artifact => {
        if (artifact.id !== id) return artifact;
        found = true;
        return { ...artifact, ...patch, id: artifact.id, createdAt: artifact.createdAt, updatedAt: now };
      });
      if (!found) throw new Error('Research artifact not found.');
      return { ...current, artifacts, updatedAt: now };
    });
  }

  async deleteArtifact(id: string) {
    const fingerprint = await this.fingerprint();
    return this.file.mutate(stored => {
      const current = normalizedForMutation(stored, fingerprint, this.pdfUri.fsPath);
      if (!current.artifacts.some(artifact => artifact.id === id)) {
        return current;
      }
      const now = new Date().toISOString();
      return {
        ...current,
        artifacts: current.artifacts.filter(artifact => artifact.id !== id),
        updatedAt: now
      };
    });
  }

  async addRelation(input: Omit<ResearchRelation, 'id' | 'createdAt'>) {
    const fingerprint = await this.fingerprint();
    return this.file.mutate(stored => {
      const current = normalizedForMutation(stored, fingerprint, this.pdfUri.fsPath);
      const relation: ResearchRelation = {
        ...input,
        id: randomUUID(),
        createdAt: new Date().toISOString()
      };
      return {
        ...current,
        relations: [relation, ...current.relations],
        updatedAt: relation.createdAt
      };
    });
  }
}

function normalizedForMutation(value: unknown, fingerprint: string, pdfPath: string) {
  const current = normalizeResearchProfile(
    value,
    createDefaultResearchProfile(fingerprint, pdfPath)
  );
  if (!current.paperFingerprint) current.paperFingerprint = fingerprint;
  assertFingerprint(current, fingerprint);
  return current;
}

function assertFingerprint(profile: ResearchProfile, fingerprint: string) {
  if (profile.paperFingerprint && profile.paperFingerprint !== fingerprint) {
    throw new Error('Research profile fingerprint does not match the active PDF.');
  }
}
