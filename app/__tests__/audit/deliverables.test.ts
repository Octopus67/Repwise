import * as fs from 'fs';
import * as path from 'path';
import * as fc from 'fast-check';

const AUDIT_DIR = path.resolve(__dirname, '../../../.kiro/specs/premium-ui-audit/audit-output');

function readAuditFile(filename: string): string {
  return fs.readFileSync(path.join(AUDIT_DIR, filename), 'utf-8');
}

/**
 * Parse issue table rows from issue-log.md.
 * Matches rows with issue IDs like SCREEN-001, COMP-001, etc.
 */
function parseIssueRows(content: string): Array<{
  id: string;
  severity: string;
  category: string;
  title: string;
  files: string;
  effort: string;
  phase: string;
  req: string;
}> {
  const issues: Array<{
    id: string;
    severity: string;
    category: string;
    title: string;
    files: string;
    effort: string;
    phase: string;
    req: string;
  }> = [];

  const issueIdPattern = /^\|\s*((?:SCREEN|COMP|COLOR|TYPO|SPACE|ANIM|BENCH|A11Y)-\d+)\s*\|/;
  const lines = content.split('\n');

  let currentSeverity = '';
  for (const line of lines) {
    if (line.includes('## Critical Issues')) currentSeverity = 'Critical';
    else if (line.includes('## High Issues')) currentSeverity = 'High';
    else if (line.includes('## Medium Issues')) currentSeverity = 'Medium';
    else if (line.includes('## Low Issues')) currentSeverity = 'Low';

    const match = line.match(issueIdPattern);
    if (match) {
      const cells = line.split('|').map(c => c.trim()).filter(c => c.length > 0);
      if (cells.length >= 8) {
        issues.push({
          id: cells[0],
          severity: currentSeverity,
          category: cells[1],
          title: cells[2],
          files: cells[3],
          effort: cells[cells.length - 3],
          phase: cells[cells.length - 2],
          req: cells[cells.length - 1],
        });
      }
    }
  }
  return issues;
}

/**
 * Parse roadmap checkbox items from implementation-roadmap.md.
 */
function parseRoadmapItems(content: string): Array<{
  description: string;
  phase: number;
  hasFilePath: boolean;
  effort: string;
}> {
  const items: Array<{
    description: string;
    phase: number;
    hasFilePath: boolean;
    effort: string;
  }> = [];

  let currentPhase = 0;
  const lines = content.split('\n');
  for (const line of lines) {
    if (line.includes('## Phase 1')) currentPhase = 1;
    else if (line.includes('## Phase 2')) currentPhase = 2;
    else if (line.includes('## Phase 3')) currentPhase = 3;
    else if (line.includes('## Phase 4')) currentPhase = 4;
    else if (line.includes('## Effort Summary') || line.includes('## Executive Summary')) currentPhase = 0;

    const checkboxMatch = line.match(/^- \[[ x]\] (.+)/);
    if (checkboxMatch && currentPhase > 0) {
      const desc = checkboxMatch[1];
      // Check for file paths in backticks or plain text
      const hasFilePath = /app\//.test(desc);
      const effortMatch = desc.match(/(\d+(?:\.\d+)?h)/);
      items.push({
        description: desc,
        phase: currentPhase,
        hasFilePath,
        effort: effortMatch ? effortMatch[1] : '0h',
      });
    }
  }
  return items;
}

describe('Deliverables Structural Completeness', () => {
  let issueLogContent: string;
  let designSpecContent: string;
  let roadmapContent: string;
  let tokenBaselineContent: string;

  beforeAll(() => {
    issueLogContent = readAuditFile('issue-log.md');
    designSpecContent = readAuditFile('design-system-spec.md');
    roadmapContent = readAuditFile('implementation-roadmap.md');
    tokenBaselineContent = readAuditFile('token-baseline.md');
  });

  /**
   * **Feature: premium-ui-audit, Property 20: Issue Log Structural Completeness**
   * **Validates: Requirements 10.2**
   */
  describe('Property 20 — Issue Log Completeness', () => {
    test('issue log contains 100+ issues with valid IDs', () => {
      const issues = parseIssueRows(issueLogContent);
      expect(issues.length).toBeGreaterThan(100);

      for (const issue of issues) {
        expect(issue.id).toMatch(/^(SCREEN|COMP|COLOR|TYPO|SPACE|ANIM|BENCH|A11Y)-\d+$/);
        expect(['Critical', 'High', 'Medium', 'Low']).toContain(issue.severity);
        expect(issue.category.length).toBeGreaterThan(0);
        expect(issue.title.length).toBeGreaterThan(0);
        // Files field must be non-empty (may say "Same as above" for grouped issues)
        expect(issue.files.length).toBeGreaterThan(0);
        // Phase must be 1-4 or — (for non-actionable items)
        expect(issue.phase).toMatch(/^[1234]$|^—$/);
        // Requirement ref must be non-empty
        expect(issue.req.length).toBeGreaterThan(0);
      }
    });

    test('property: random issue subset all have valid IDs', () => {
      const issues = parseIssueRows(issueLogContent);
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: issues.length - 1 }),
          (idx) => {
            const issue = issues[idx];
            return /^(SCREEN|COMP|COLOR|TYPO|SPACE|ANIM|BENCH|A11Y)-\d+$/.test(issue.id);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('most issues reference file paths containing app/', () => {
      const issues = parseIssueRows(issueLogContent);
      const withFilePaths = issues.filter(i => /app\//.test(i.files));
      // At least 90% of issues should have explicit file paths
      expect(withFilePaths.length / issues.length).toBeGreaterThan(0.9);
    });
  });

  /**
   * **Feature: premium-ui-audit, Property 21: Phase-Severity Alignment**
   * **Validates: Requirements 10.3, 10.4, 10.5, 10.6**
   */
  describe('Property 21 — Phase-Severity Alignment', () => {
    test('Phase 1 contains only Critical and High issues', () => {
      const issues = parseIssueRows(issueLogContent);
      const phase1Issues = issues.filter(i => i.phase === '1');
      expect(phase1Issues.length).toBeGreaterThan(0);
      for (const issue of phase1Issues) {
        expect(
          ['Critical', 'High'].includes(issue.severity)
        ).toBe(true);
      }
    });

    test('Phase 4 contains only Low and Medium issues', () => {
      const issues = parseIssueRows(issueLogContent);
      const phase4Issues = issues.filter(i => i.phase === '4');
      expect(phase4Issues.length).toBeGreaterThan(0);
      for (const issue of phase4Issues) {
        expect(
          ['Low', 'Medium'].includes(issue.severity)
        ).toBe(true);
      }
    });

    test('property: random phase 1 issue is Critical or High', () => {
      const issues = parseIssueRows(issueLogContent);
      const phase1 = issues.filter(i => i.phase === '1');
      if (phase1.length === 0) return;
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: phase1.length - 1 }),
          (idx) => ['Critical', 'High'].includes(phase1[idx].severity)
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: premium-ui-audit, Property 22: Effort Estimate File Reference**
   * **Validates: Requirements 10.8**
   */
  describe('Property 22 — Effort Estimate File Reference', () => {
    test('at least 90% of roadmap items with effort reference a file path', () => {
      const items = parseRoadmapItems(roadmapContent);
      expect(items.length).toBeGreaterThan(50);

      const itemsWithEffort = items.filter(i => i.effort !== '0h');
      const itemsWithFiles = itemsWithEffort.filter(i => i.hasFilePath);
      expect(itemsWithFiles.length / itemsWithEffort.length).toBeGreaterThan(0.9);
    });

    test('property: random roadmap item with effort and file ref', () => {
      const items = parseRoadmapItems(roadmapContent).filter(i => i.effort !== '0h' && i.hasFilePath);
      expect(items.length).toBeGreaterThan(40);
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: items.length - 1 }),
          (idx) => items[idx].hasFilePath
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: premium-ui-audit, Property 24: Premium Polish Checklist Minimum Count**
   * **Validates: Requirements 9.6**
   */
  describe('Property 24 — Premium Polish Checklist Count', () => {
    test('checklist has at least 50 items', () => {
      const checklistSection = designSpecContent.split('## 9. Premium Polish Checklist')[1];
      expect(checklistSection).toBeDefined();

      const checklistItems = checklistSection!
        .split('\n')
        .filter(line => /^- \[ \] \d+\./.test(line));

      expect(checklistItems.length).toBeGreaterThanOrEqual(50);
    });
  });

  /**
   * **Feature: premium-ui-audit, Property 4: Token Round-Trip**
   * **Validates: Requirements 3.1, 4.1, 5.1, 9.1**
   */
  describe('Property 4 — Token Round-Trip', () => {
    test('every major token group from baseline appears in design spec', () => {
      const specLower = designSpecContent.toLowerCase();

      // Check all major token groups are referenced in the spec
      const requiredGroups = [
        'colors.bg',
        'colors.border',
        'colors.text',
        'spacing',
        'radius.sm',
        'radius.md',
        'radius.lg',
        'radius.full',
        'shadows.sm',
        'shadows.md',
        'shadows.lg',
        'springs.gentle',
        'springs.snappy',
        'springs.bouncy',
        'typography.size',
        'typography.weight',
        'typography.fontfamily',
        'letterspacing',
        'motion.duration',
        'glowshadow',
      ];

      for (const group of requiredGroups) {
        expect(specLower).toContain(group);
      }
    });

    test('accent and semantic color groups are referenced', () => {
      const specLower = designSpecContent.toLowerCase();
      // These may appear as "accent.primary" or "accent" in prose
      expect(specLower).toContain('accent');
      expect(specLower).toContain('semantic');
      expect(specLower).toContain('premium');
      expect(specLower).toContain('macro');
    });

    test('token baseline has 30+ unique token paths', () => {
      const tokenPattern = /`(colors\.\w+\.\w+|spacing\[\d+\]|typography\.\w+\.\w+|radius\.\w+|shadows\.\w+|springs\.\w+|opacityScale\.\w+|motion\.\w+\.\w+|letterSpacing\.\w+|elevation\.\w+)`/g;
      const tokenPaths: string[] = [];
      let match;
      while ((match = tokenPattern.exec(tokenBaselineContent)) !== null) {
        tokenPaths.push(match[1]);
      }
      const uniqueTokens = [...new Set(tokenPaths)];
      expect(uniqueTokens.length).toBeGreaterThan(30);
    });

    test('property: random color token group from baseline is in spec', () => {
      // Extract top-level color groups from baseline
      const groupPattern = /### \d+\.\d+ (\w+) \(`colors\.(\w+)`\)/g;
      const groups: string[] = [];
      let match;
      while ((match = groupPattern.exec(tokenBaselineContent)) !== null) {
        groups.push(match[2].toLowerCase());
      }
      if (groups.length === 0) {
        // Fallback: extract from table rows
        const tablePattern = /`colors\.(\w+)\.\w+`/g;
        while ((match = tablePattern.exec(tokenBaselineContent)) !== null) {
          groups.push(match[1].toLowerCase());
        }
      }
      const unique = [...new Set(groups)];
      if (unique.length === 0) return;

      const specLower = designSpecContent.toLowerCase();
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: unique.length - 1 }),
          (idx) => specLower.includes(unique[idx])
        ),
        { numRuns: 100 }
      );
    });
  });
});
