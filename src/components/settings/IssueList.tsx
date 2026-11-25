"use client";

import { useNumberFormat } from "@/i18n/number-format";
import type { ImportIssue } from "@/lib/collection-csv";

const MAX_LISTED_ISSUES = 8;

export function IssueList({
  title,
  issues,
  more,
  reason,
  tone,
}: {
  title: string;
  issues: ImportIssue[];
  more: (n: string) => string;
  reason?: (issue: ImportIssue) => string;
  tone: string;
}) {
  const fmt = useNumberFormat();
  if (issues.length === 0) return null;
  const hidden = issues.length - MAX_LISTED_ISSUES;
  return (
    <div>
      <p className={tone}>{title}</p>
      <ul className="mt-1 space-y-0.5 text-xs text-muted">
        {issues.slice(0, MAX_LISTED_ISSUES).map((issue) => (
          <li key={issue.row}>
            L{issue.row} · {issue.label}
            {reason ? ` — ${reason(issue)}` : null}
          </li>
        ))}
        {hidden > 0 ? <li>{more(fmt.int(hidden))}</li> : null}
      </ul>
    </div>
  );
}
