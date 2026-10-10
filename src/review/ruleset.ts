// Feature 002 · data-model §7 — ruleset "main protegida" (D1 = A, repositório público).
import { ACTIONS_INTEGRATION_ID, RULESET_NAME, STATUS_CONTEXT } from "./catalog";

export interface RulesetRule {
  type:
    | "deletion"
    | "non_fast_forward"
    | "required_linear_history"
    | "pull_request"
    | "required_status_checks";
  parameters?: Record<string, unknown>;
}
export interface Ruleset {
  name: string;
  target: "branch";
  enforcement: "active";
  bypass_actors: never[];
  conditions: { ref_name: { include: string[]; exclude: string[] } };
  rules: RulesetRule[];
}

/** Monta o ruleset a partir das verificações de PR do ci.yml (requiredChecksFromCi). */
export function buildRuleset(ciChecks: string[]): Ruleset {
  return {
    name: RULESET_NAME,
    target: "branch",
    enforcement: "active",
    bypass_actors: [],
    conditions: { ref_name: { include: ["refs/heads/main"], exclude: [] } },
    rules: [
      { type: "deletion" },
      { type: "non_fast_forward" },
      { type: "required_linear_history" },
      {
        type: "pull_request",
        parameters: {
          required_approving_review_count: 0,
          dismiss_stale_reviews_on_push: false,
          require_code_owner_review: false,
          require_last_push_approval: false,
          required_review_thread_resolution: false,
          allowed_merge_methods: ["squash"],
        },
      },
      {
        type: "required_status_checks",
        parameters: {
          strict_required_status_checks_policy: true,
          do_not_enforce_on_create: false,
          required_status_checks: [...ciChecks, STATUS_CONTEXT].map((context) => ({
            context,
            integration_id: ACTIONS_INTEGRATION_ID,
          })),
        },
      },
    ],
  };
}
