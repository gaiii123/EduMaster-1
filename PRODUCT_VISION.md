# VivaLoop — Product Vision & Concept Refinement

> A research-based AI Institute platform that evaluates every student, places them on
> the path where they can achieve excellence, and continuously re-measures their growth.
>
> This document: (1) captures the current idea as stated, (2) corrects its weak points,
> and (3) adds unique features. It is grounded in the existing VivaLoop architecture
> (`architecture_context.txt`).

---

## 1. The Core Idea (as stated)

1. When a new student joins the institute, they face a **Viva interview with an AI interviewer**.
2. Based on the student's answers, the AI **evaluates a score**.
3. Based on that score, the AI **assigns a grade/level**.
4. The student is then moved into a **grade/track category** — e.g. quick learner, researcher, developer, tester, designer.
5. The system tells the student: *"You are based on this knowledge — focus on these areas."*
6. The student **mainly studies those track modules**, plus a few important cross-track modules.
7. After a few months, the student is **re-evaluated on those modules and re-graded** to see whether their knowledge increased.
8. This is a **student-wise platform**: the admin can evaluate all students and view each student's knowledge one by one.
9. Students **stay focused on their correct path**.
10. All lecture material is delivered as **30-minute videos + quizzes**.
11. The AI's questions are designed to **genuinely measure knowledge** (finalized from prior research).
12. **Philosophy:** this is not a simple education system — it is a **research-based AI institute** that routes each student to their **best path, not merely their interested path**.

---

## 2. What is Strong (keep as-is)

- **Conversational viva over written exams** — measures real reasoning, not memorization.
- **Placement before content** — meet each student at their actual level.
- **Longitudinal re-measurement** — growth is tracked, not assumed.
- **Per-student admin drill-down** — every learner is individually visible.
- **Evidence-first philosophy** — route on demonstrated ability, not self-report.

These align directly with the existing 3-stage loop and Bayesian Knowledge Tracing (BKT).

---

## 3. Refinements — Correcting the Weak Points

Each item below states the original assumption, why it is risky, and the corrected approach.

### 3.1 Single intake viva → permanent grade
- **Problem:** One high-stakes interview can misplace a student (nerves, language, a bad day). A fixed label creates a self-fulfilling prophecy and a fixed mindset.
- **Correction:** Treat the intake viva as **placement (starting coordinates), not destiny.** Use continuous BKT to update mastery after every interaction. Attach a **confidence interval** to the placement — if the AI is uncertain, it asks more probing questions before finalizing. The grade is a **live, evolving value**, not a stamp.

### 3.2 Mixed category taxonomy ("quick learner" vs "developer/tester/designer")
- **Problem:** These are different *kinds* of attribute. "Quick learner" is a **learning-rate trait**; "developer/tester/designer/researcher" are **specialization roles**. Mixing them in one "grade category" is a category error.
- **Correction:** Split into two orthogonal axes:
  - **Profile dimensions (how they think):** learning velocity, depth vs. breadth, theoretical vs. applied, abstraction level.
  - **Specialization tracks (where they apply it):** Developer, Tester/QA, Designer, Researcher, Data, DevOps, Security, etc.
  - A placement = **a profile + a recommended track**, never a single label.

### 3.3 "Best path, not the interested path"
- **Problem:** Fully ignoring interest risks demotivation, dropout, and opaque paternalism. Learning-science evidence (self-determination theory) shows autonomy and buy-in materially affect persistence. Intake aptitude is also noisy.
- **Correction:** **Aptitude-led, interest-informed.** The system *defaults* to the evidence-based best path (preserving the core philosophy), but it:
  - also captures the student's stated interest,
  - **transparently shows the reasoning** when aptitude and interest diverge,
  - offers a structured **"challenge window"** where a student can argue for a different path with evidence.
  Excellence leads; interest is a signal, not the driver.

### 3.4 Content = 30-min videos + quizzes only
- **Problem:** Passive watching contradicts the platform's active-assessment philosophy. A fixed 30-minute length is arbitrary; cognitive science favors shorter focused segments + active recall + spaced repetition. Quizzes alone can be gamed.
- **Correction:** Deliver **micro-learning modules** (short core segments) interleaved with **active recall, hands-on labs, and viva check-ins**. Keep long-form video as an optional deep-dive, but every content item is **mapped to a mastery node** and followed by an active task.

### 3.5 Re-evaluation only "after a few months"
- **Problem:** Too infrequent. Gaps compound while waiting; course-correction arrives late.
- **Correction:** **Continuous formative signals** (short weekly micro-vivas / quiz-driven BKT updates) **plus periodic milestone re-grading** (e.g. monthly placement review). Growth is visible in near-real-time; the formal re-grade is a checkpoint, not the only measurement.

### 3.6 Reducing a student to one score
- **Problem:** A single number hides the skill profile — two students with the same score can have opposite strengths.
- **Correction:** Use a **multi-dimensional mastery vector** (already 4 dimensions; extend to a knowledge graph). Derive the track from the **shape of the profile**. Keep one composite number only for quick admin scanning, always drillable.

### 3.7 Question validity ("AI asks questions to measure knowledge")
- **Problem:** Without psychometric rigor, scores are noise. Questions must be calibrated, and answers must be verified as genuine.
- **Correction:** Maintain a **calibrated item bank** using **Item Response Theory (IRT)** and **computerized adaptive testing** (difficulty adapts in real time). Add **follow-up probing** and **teach-back** to confirm genuine understanding and defeat rehearsed/AI-assisted answers.

### 3.8 Admin reviews every student one-by-one
- **Problem:** Does not scale; manual review of everyone defeats the purpose of AI.
- **Correction:** **AI-assisted admin view** — auto summaries, momentum/anomaly flags, and a **ranked attention queue**. One-by-one deep-dive remains available on demand, but the admin is pulled toward who needs them most.

---

## 4. New & Unique Features

Grouped by theme. Items marked ★ are the strongest differentiators for a "research-based AI institute."

### Measurement & Validity
- ★ **Skill Knowledge Graph** — skills as nodes with prerequisite edges; the AI navigates it to find the *root* gap, not just the symptom.
- ★ **Computerized Adaptive Testing (IRT)** — each viva adapts question difficulty live for fast, precise measurement.
- **Confidence Calibration** — measures the gap between a student's self-reported confidence and actual mastery (metacognition signal).
- **Misconception Mapping** — detects and tracks specific wrong mental models, not just right/wrong answers.

### Placement & Pathing
- ★ **Learning Velocity metric** — quantified rate of mastery gain. Turns "quick learner" from a label into a measured, observable number.
- **Dual-Signal Intake (Aptitude + Interest)** with mismatch transparency (see 3.3).
- ★ **Explainable Placement Report** — per-student rationale for the assigned track (trust + research artifact).
- **Re-routing / Escape Valves** — structured triggers to change track: exceptional growth, persistent struggle, or evidenced interest.
- **"Foundations" on-ramp** — missing prerequisites route to a stigma-free foundations track first.

### Learning Delivery
- **Micro-learning + Spaced Repetition** — auto-scheduled micro-quizzes on weak/forgotten nodes.
- **AI Socratic Coach** — targeted weak-area coaching between vivas.
- **Micro-credentials / Badges** — stackable per-mastery-node credentials.

### Anti-Gaming & Authenticity
- ★ **Authenticity Probing** — dynamic follow-ups, "explain why not the alternative," and teach-back to detect rehearsed or AI-generated answers.
- **Multi-modal Viva** — voice interview, code-along, and system-design whiteboard modes (harder to fake than text).

### Research & Analytics
- ★ **Cohort Research Analytics** — anonymized longitudinal data continuously validates and improves the placement model. The institute literally produces research from its own operation.
- **Peer Cohort Benchmarking** — privacy-preserving percentile context for each student.

### Student Experience & Trust
- Transparent reasoning + challenge window (see 3.3) so students understand and can contest their path.
- Clear "focus areas" statement after every re-grade: *"You are here; work on these next."*

---

## 5. The Revised End-to-End Student Journey

1. **Intake Viva** — adaptive, multi-modal AI interview; produces a mastery vector + confidence interval (not a single score).
2. **Placement** — profile dimensions + recommended specialization track; explainable report generated; interest captured and any mismatch surfaced.
3. **Focus Plan** — student is told their base level and focus areas; assigned primary track modules + essential cross-track modules, all mapped to mastery nodes.
4. **Active Learning** — micro-learning + labs + spaced-repetition quizzes; AI Socratic Coach supports weak areas.
5. **Continuous Formative Signals** — weekly micro-vivas and quiz results update BKT mastery in near-real-time.
6. **Milestone Re-grade** — periodic re-placement review; velocity measured; track confirmed, deepened, or re-routed via escape valves.
7. **Loop repeats** — the student's knowledge graph, velocity, and track evolve over their whole time at the institute.

---

## 6. Role Views

### Admin / Lecturer
- Cohort dashboard (Skills Heatmap) + **AI attention queue** (who needs review now).
- One-by-one deep-dive per student: mastery vector, knowledge graph, velocity, placement history, viva transcripts.
- Approve/override re-routing requests; review explainable placement reports.

### Student
- Personal focus plan and "you are here" statement.
- Transparent placement rationale + challenge window.
- Progress view: mastery growth, velocity, earned micro-credentials.

---

## 7. Alignment with the Current Architecture

| Vision element | Existing foundation | Work needed |
|---|---|---|
| Intake Viva | Baseline Viva stage, `VivaChat.jsx`, `POST /api/evaluate` | Add adaptive difficulty + confidence interval |
| Formative signals | Formative Check-ins stage | Increase cadence; wire quiz results into BKT |
| Re-grade | Capstone Defense stage | Add periodic milestone re-grade + velocity calc |
| Mastery profile | 4-dimension scores, Skills Heatmap (Recharts) | Extend to knowledge graph; keep heatmap drill-down |
| Qwen AI | `routers/evaluation.py`, dashscope SDK, Mock Mode | Prompt for IRT/probing/misconception outputs |
| Admin view | Lecturer dashboard | Add AI attention queue + explainable reports |
| Data | `Student` ↔ `EvaluationRecord` (SQLAlchemy/aiosqlite) | Add entities: MasteryNode, Track, Placement, Velocity |

---

## 8. Open Questions / Research Backlog

1. How to **calibrate the item bank** (IRT parameters) with a small initial cohort?
2. What is the right **velocity formula** that is robust to assessment frequency?
3. How much weight should **interest** get before it can override aptitude (challenge-window criteria)?
4. Which **authenticity-probing strategies** best detect AI-assisted answers without false accusations?
5. What **re-grade cadence** maximizes accuracy vs. student fatigue?
6. How to keep **cohort analytics privacy-preserving** while still research-useful?

---

*Last updated: 2026-08. This is a living document — refine as research findings land.*
