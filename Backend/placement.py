"""
Placement engine — turns a student's mastery profile into a placement decision.

Implements the core vision loop (see PRODUCT_VISION.md):

1. **Level**        — grade band derived from the composite mastery score.
2. **Track**        — specialization category (Developer / Designer / Tester /
                      Researcher) derived from the *shape* of the mastery profile,
                      with a stigma-free "Foundations" on-ramp for low composites.
3. **Velocity**     — measured rate of mastery gain (points per week) across
                      evaluations; quantifies "quick learner" instead of labelling.
4. **Focus areas**  — the two weakest dimensions, surfaced as the
                      "you are here; work on these next" statement.
5. **Confidence**   — how much we trust the placement, based on evidence volume.
"""

from __future__ import annotations

import math
from datetime import date

# ============================================================
#  Constants
# ============================================================

#: Mastery dimensions (column names) → human labels.
DIMENSIONS: dict[str, str] = {
    "mastery_logic_and_syntax": "Logic & Syntax",
    "mastery_api_architecture": "API Architecture",
    "mastery_frontend_state": "Frontend State",
    "mastery_database_integration": "Database Integration",
}

#: Grade levels (threshold is the *minimum* composite score for the level).
LEVELS: list[tuple[int, str]] = [
    (85, "Expert"),
    (65, "Advanced"),
    (45, "Intermediate"),
    (25, "Foundation"),
    (0, "Novice"),
]

#: Composite score below which the student is routed to the Foundations on-ramp.
FOUNDATIONS_THRESHOLD = 35

#: Track fitness weights per dimension (how each specialization uses the skills).
TRACK_WEIGHTS: dict[str, dict[str, float]] = {
    "Developer": {
        "mastery_logic_and_syntax": 0.35,
        "mastery_api_architecture": 0.35,
        "mastery_frontend_state": 0.10,
        "mastery_database_integration": 0.20,
    },
    "Designer": {
        "mastery_logic_and_syntax": 0.15,
        "mastery_api_architecture": 0.15,
        "mastery_frontend_state": 0.55,
        "mastery_database_integration": 0.15,
    },
    "Tester": {
        "mastery_logic_and_syntax": 0.30,
        "mastery_api_architecture": 0.25,
        "mastery_frontend_state": 0.10,
        "mastery_database_integration": 0.35,
    },
    "Researcher": {
        "mastery_logic_and_syntax": 0.25,
        "mastery_api_architecture": 0.25,
        "mastery_frontend_state": 0.25,
        "mastery_database_integration": 0.25,
    },
}

#: Bonus added to Researcher fitness for a balanced profile (low spread).
RESEARCHER_BALANCE_BONUS = 15.0


# ============================================================
#  Helpers
# ============================================================

def _scores_vector(scores: dict[str, int]) -> list[int]:
    """Return the 4 mastery values in canonical DIMENSIONS order."""
    return [int(scores.get(dim, 0)) for dim in DIMENSIONS]


def composite_score(scores: dict[str, int]) -> int:
    """Average mastery across all dimensions (0-100)."""
    values = _scores_vector(scores)
    return round(sum(values) / len(values))


def level_for(composite: int) -> str:
    """Map a composite score to its grade level."""
    for threshold, label in LEVELS:
        if composite >= threshold:
            return label
    return "Novice"


def track_fitness(scores: dict[str, int]) -> dict[str, float]:
    """
    Compute a 0-100 fitness per specialization track.

    Researcher additionally rewards a *balanced* profile: a student whose
    dimensions are all similarly strong fits research better than a spiky one.
    """
    values = _scores_vector(scores)
    mean = sum(values) / len(values)
    spread = math.sqrt(sum((v - mean) ** 2 for v in values) / len(values))

    fitness: dict[str, float] = {}
    for track, weights in TRACK_WEIGHTS.items():
        fit = sum(scores.get(dim, 0) * w for dim, w in weights.items())
        if track == "Researcher":
            fit += max(0.0, RESEARCHER_BALANCE_BONUS - spread)
        fitness[track] = round(fit, 1)
    return fitness


def recommend_track(scores: dict[str, int]) -> tuple[str, dict[str, float]]:
    """
    Recommend a specialization track from the profile shape.

    Returns (track, fitness_by_track). Low-composite students are routed to
    the "Foundations" on-ramp regardless of fitness.
    """
    fitness = track_fitness(scores)
    composite = composite_score(scores)

    if composite < FOUNDATIONS_THRESHOLD:
        return "Foundations", fitness

    return max(fitness, key=lambda t: fitness[t]), fitness


def velocity_per_week(evaluations: list) -> float | None:
    """
    Measured growth rate: composite points gained per week between the first
    and latest evaluation.  Returns None when fewer than two data points.
    """
    if len(evaluations) < 2:
        return None

    first, latest = evaluations[0], evaluations[-1]
    first_composite = composite_score(_eval_scores(first))
    latest_composite = composite_score(_eval_scores(latest))

    first_date = _eval_date(first)
    latest_date = _eval_date(latest)
    weeks = max((latest_date - first_date).days / 7.0, 0.5)  # avoid /0 spikes

    return round((latest_composite - first_composite) / weeks, 2)


def focus_areas(scores: dict[str, int], count: int = 2) -> list[str]:
    """The weakest dimensions — what the student should work on next."""
    ordered = sorted(DIMENSIONS, key=lambda d: scores.get(d, 0))
    return [DIMENSIONS[d] for d in ordered[:count]]


def placement_confidence(evaluation_count: int) -> float:
    """
    How much we trust the placement (0-1). More evidence → higher confidence.
    Simple saturating curve: 1 evaluation ≈ 0.5, 4+ ≈ 0.95.
    """
    return round(min(0.95, 0.35 + 0.15 * max(evaluation_count, 1)), 2)


# ============================================================
#  Placement summary
# ============================================================

def build_placement(evaluations: list) -> dict | None:
    """
    Build the full placement summary for a student from their evaluation
    history (ascending date order).  Returns None when there is no evidence.

    Each evaluation may be an ORM row or a dict with the mastery_* keys and
    an ``evaluation_date``.
    """
    if not evaluations:
        return None

    latest = evaluations[-1]
    scores = _eval_scores(latest)
    composite = composite_score(scores)
    level = level_for(composite)
    track, fitness = recommend_track(scores)
    n = len(evaluations)
    velocity = velocity_per_week(evaluations)
    focus = focus_areas(scores)

    if track == "Foundations":
        message = (
            f"You are placed on the Foundations on-ramp at {level} level. "
            f"Build core prerequisites first, focusing on: {', '.join(focus)}."
        )
    else:
        message = (
            f"You are placed on the {track} track at {level} level. "
            f"Focus on these areas next: {', '.join(focus)}."
        )

    return {
        "composite_score": composite,
        "level": level,
        "track": track,
        "track_fitness": fitness,
        "velocity_per_week": velocity,
        "confidence": placement_confidence(n),
        "focus_areas": focus,
        "evaluations_count": n,
        "message": message,
    }


# ============================================================
#  Internal adapters (ORM row or dict)
# ============================================================

def _eval_scores(evaluation) -> dict[str, int]:
    """Extract the mastery_* scores from an ORM row or a dict."""
    if isinstance(evaluation, dict):
        return {dim: int(evaluation.get(dim, 0)) for dim in DIMENSIONS}
    return {dim: int(getattr(evaluation, dim, 0)) for dim in DIMENSIONS}


def _eval_date(evaluation) -> date:
    """Extract evaluation_date from an ORM row or a dict."""
    if isinstance(evaluation, dict):
        value = evaluation.get("evaluation_date")
    else:
        value = getattr(evaluation, "evaluation_date", None)
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        return date.fromisoformat(value[:10])
    return date.today()
