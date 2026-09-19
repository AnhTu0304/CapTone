from app.agents.historical_incident_agent import HistoricalContext, normalize_cause
from app.agents.rca_agent import RCAConclusion
from app.schemas.kubernetes import KubernetesData
from app.schemas.rca import RecommendationResult


class RecommendationAgent:
    ALLOWED_ACTIONS = {
        "RESTART_POD", "REPLACE_POD", "RESTART_DEPLOYMENT", "SCALE_REPLICAS",
        "ROLLBACK_DEPLOYMENT", "CLEANUP_STORAGE", "TEMPORARY_IP_BLOCK", "NO_ACTION",
    }

    def recommend(
        self,
        conclusion: RCAConclusion,
        kubernetes: KubernetesData,
        historical: HistoricalContext | None = None,
        previous_action: str | None = None,
        previous_action_result: str | None = None,
    ) -> RecommendationResult:
        historical = historical or HistoricalContext()
        cause = conclusion.cause_code
        action = "NO_ACTION"
        reason = "No safe infrastructure action is justified by the available evidence"

        if cause == "deployment_failure":
            action = "ROLLBACK_DEPLOYMENT"
            reason = "The incident is correlated with the latest deployment or rollout"
        elif cause == "storage_exhaustion":
            action = "CLEANUP_STORAGE"
            reason = "Disk capacity is exhausted or approaching its critical limit"
        elif cause == "unstable_pod":
            action = "REPLACE_POD" if kubernetes.restart_count >= 3 else "RESTART_POD"
            reason = "The affected pod is unhealthy or repeatedly restarting"
        elif cause in {"traffic_overload", "cpu_saturation", "insufficient_replicas"}:
            action = "SCALE_REPLICAS"
            reason = "Additional replicas can distribute load and restore service capacity"
        elif cause == "memory_exhaustion":
            action = "REPLACE_POD"
            reason = "The affected container exhausted memory and should be replaced after policy review"
        elif cause == "application_failure" and kubernetes.restart_count > 0:
            action = "RESTART_POD"
            reason = "Application errors coincide with an unhealthy pod"

        # History may explain/support the action selected from current evidence,
        # but must never replace that action merely because it succeeded once.
        for incident in historical.incidents:
            historical_cause = normalize_cause(
                incident.confirmed_root_cause or incident.root_cause
            )
            historical_action = incident.executed_action or incident.recommended_action
            if (
                historical_cause == cause
                and incident.action_result == "SUCCESS"
                and historical_action == action
                and action != "NO_ACTION"
            ):
                reason = (
                    f"Current evidence independently supports {action}; similar confirmed "
                    f"incident {incident.incident_id} is supporting context where it succeeded"
                )
                break

        # Reassess an unsuccessful or partially successful action. It may still
        # be correct when strong new evidence or confirmed history supports it.
        if previous_action_result in {"FAILED", "PARTIAL"} and action == previous_action:
            successful_retry = any(
                (item.executed_action or item.recommended_action) == action
                and item.action_result == "SUCCESS"
                and normalize_cause(item.confirmed_root_cause or item.root_cause) == cause
                for item in historical.incidents
            )
            current_evidence = [
                item for item in conclusion.evidence
                if not item.startswith("Similar incident")
                and not item.startswith("Previous ")
            ]
            strong_new_evidence = (
                conclusion.result.confidence >= 0.75 and len(current_evidence) >= 2
            )
            if not successful_retry and not strong_new_evidence:
                action = "NO_ACTION"
                reason = (
                    f"Previous {previous_action} result was {previous_action_result}; "
                    "it is not prioritized because "
                    "current evidence is not strong enough to support repeating it"
                )
            elif strong_new_evidence:
                reason = (
                    f"Although previous {previous_action} result was "
                    f"{previous_action_result}, multiple strong current "
                    "signals independently support this action under the new conditions"
                )

        return RecommendationResult(
            action=action,
            reason=reason,
            priority=conclusion.result.severity,
        )
