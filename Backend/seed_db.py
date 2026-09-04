"""Seed the database with demo students and evaluation records.

Covers the placement spectrum: Developer, Designer, Researcher-leaning,
Tester and Foundations on-ramp students.
"""
import sqlite3
from datetime import date, datetime
from passlib.context import CryptContext

conn = sqlite3.connect("edumaster.db")
cursor = conn.cursor()

# Ensure the learning tables exist even if the API server has not run yet.
# Must run BEFORE any INSERTs below — pending writes hold a lock that would
# block DDL from a second connection.
from sqlalchemy import create_engine
from database import Base
import models  # noqa: F401  – registers learning ORM models with Base.metadata

_sync_engine = create_engine("sqlite:///edumaster.db")
Base.metadata.create_all(_sync_engine)
_sync_engine.dispose()

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
DEFAULT_PASSWORD = "password123"  # Demo password for all seeded users
password_hash = pwd_context.hash(DEFAULT_PASSWORD)

now = datetime.utcnow().isoformat()

# --- Admins ---
admins = [
    (1, "Admin User", "admin@edumaster.com", password_hash, now, now),
]
cursor.executemany(
    "INSERT OR IGNORE INTO admins (id, name, email, password_hash, created_at, updated_at) VALUES (?,?,?,?,?,?)",
    admins,
)

# --- Students ---
students = [
    (1, "Kasun Perera",      "kasun@example.com",   "IT-2024-001", password_hash, now, now),
    (2, "Nimali Silva",      "nimali@example.com",   "IT-2024-002", password_hash, now, now),
    (3, "Ravi Jayawardena",  "ravi@example.com",     "IT-2024-003", password_hash, now, now),
    (4, "Dinesh Fernando",   "dinesh@example.com",   "IT-2024-004", password_hash, now, now),
    (5, "Amara Wickrama",    "amara@example.com",    "IT-2024-005", password_hash, now, now),
]
cursor.executemany(
    "INSERT OR IGNORE INTO students (id, name, email, student_code, password_hash, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
    students,
)

# --- Lifecycle Evaluations ---
evaluations = [
    # Kasun – Baseline + Formative
    (1, 1, "Baseline Viva",        "2026-08-10", "Strong logic fundamentals. Needs more exposure to REST API design patterns.",                    72, 58, 45, 63, now, now),
    (2, 1, "Formative Check-in",   "2026-08-20", "Improved API understanding. Frontend state management still needs work – consider Redux exercises.", 78, 65, 55, 70, now, now),
    # Nimali – Baseline only
    (3, 2, "Baseline Viva",        "2026-08-12", "Excellent frontend skills. Database integration is the weakest area.",                            60, 50, 82, 35, now, now),
    # Ravi – Baseline + Formative (balanced → Researcher-leaning)
    (4, 3, "Baseline Viva",        "2026-08-11", "Well-rounded but logic & syntax needs tightening. Good API architecture intuition.",               48, 62, 55, 58, now, now),
    (5, 3, "Formative Check-in",   "2026-08-22", "Significant improvement in logic. Keep practicing algorithmic challenges.",                        65, 68, 60, 62, now, now),
    # Dinesh – Baseline + Formative (logic + database heavy → Tester)
    (6, 4, "Baseline Viva",        "2026-08-13", "Strong database reasoning and methodical edge-case thinking; frontend exposure minimal.",          66, 52, 28, 79, now, now),
    (7, 4, "Formative Check-in",   "2026-08-24", "Consolidated database strengths. API contract testing improving steadily.",                          70, 60, 34, 84, now, now),
    # Amara – Baseline only (below threshold → Foundations on-ramp)
    (8, 5, "Baseline Viva",        "2026-08-15", "Missing core prerequisites in logic and databases. Route to Foundations on-ramp first.",           22, 18, 30, 15, now, now),
]
cursor.executemany(
    "INSERT OR IGNORE INTO lifecycle_evaluations "
    "(id, student_id, stage, evaluation_date, ai_diagnostic_notes, "
    "mastery_logic_and_syntax, mastery_api_architecture, mastery_frontend_state, mastery_database_integration, created_at, updated_at) "
    "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    evaluations,
)

# ============================================================
#  Learning library — subjects, notes, quizzes
# ============================================================

LEARNING_PART_A = [
    {
        "id": 1, "title": "Logic & Syntax", "icon": "🧠", "skill_key": "logic",
        "description": "Programming fundamentals every track builds on: variables, control flow, and functions.",
        "notes": [
            {
                "id": 1, "title": "Variables, Types & Operators",
                "summary": "How programs store and transform data: variables, primitive types, and the operators that manipulate them.",
                "reading_minutes": 8,
                "content": """# Variables, Types & Operators

Every program is, at its core, a pipeline that **reads data, transforms it, and produces new data**. Variables are the named storage locations that make those transformations possible.

## Declaring variables

```javascript
const institute = 'EduMaster';   // immutable binding
let score = 72;                  // reassignable
var legacy = true;               // function-scoped, avoid in modern code
```

> **Tip:** default to `const`, use `let` only when reassignment is genuinely needed, and avoid `var`.

## Primitive types

| Type | Example | Notes |
| --- | --- | --- |
| number | `42`, `3.14` | double-precision float |
| string | `'hello'` | immutable sequence of characters |
| boolean | `true` / `false` | result of comparisons |
| null / undefined | — | intentional absence vs. not yet assigned |

## Operators behave differently per type

```javascript
5 + 3        // 8  → numeric addition
'5' + 3      // '53' → string concatenation wins
'5' - 3      // 2  → '-' coerces to number
5 === '5'    // false → strict: value AND type
5 == '5'     // true  → loose: coerces first
```

The strict equality operator `===` compares **value and type** without coercion, which eliminates an entire class of subtle bugs. Lint rules such as `eqeqeq` enforce this habit.

## Key takeaway

Types decide what an operator *means*. When you read `a + b`, the question is never 'what does plus do?' — it is 'what types are `a` and `b`?'.
""",
                "quiz": [
                    ("What does the strict equality operator `===` compare in JavaScript?",
                     "Only the values", "Both value and type", "Only memory references", "Only the types", 2),
                    ("What is the result of `'5' + 3` in JavaScript?",
                     "8", "'53'", "TypeError", "NaN", 2),
                    ("Which declaration creates a binding that cannot be reassigned?",
                     "var", "let", "const", "static", 3),
                ],
            },
            {
                "id": 2, "title": "Control Flow: Conditionals & Loops",
                "summary": "Branching and repetition — how a program decides what to run and how many times.",
                "reading_minutes": 7,
                "content": """# Control Flow: Conditionals & Loops

Control flow is the order in which statements execute. Two primitives shape everything else: **branching** (do this *or* that) and **looping** (do this *while* that holds).

## Conditionals

```python
if score >= 80:
    grade = 'A'
elif score >= 60:
    grade = 'B'
else:
    grade = 'C'
```

Conditions are evaluated **top to bottom, first match wins** — order matters. Placing `score >= 60` before `score >= 80` would silently misgrade high scores.

## Loops

```javascript
for (let i = 0; i < students.length; i++) {
  if (students[i].isInactive) continue;  // skip, next iteration
  evaluate(students[i]);
  if (students[i].finished) break;       // exit loop immediately
}
```

- `break` **exits the loop immediately**.
- `continue` **skips to the next iteration**.
- In Python, a `for` loop's `else:` block runs only when the loop completed **without** hitting `break` — handy for search loops.

## Guard clauses over deep nesting

```javascript
// ❌ nested
if (user) {
  if (user.isActive) {
    grantAccess(user);
  }
}

// ✅ guard clause
if (!user || !user.isActive) return;
grantAccess(user);
```

Early returns flatten logic and make the happy path readable.

## Key takeaway

Every loop needs a provable exit condition, and every conditional chain must be checked for ordering bugs. Infinite loops and wrong-branch bugs are the two most common control-flow failures.
""",
                "quiz": [
                    ("What does the `break` statement do inside a loop?",
                     "Skips to the next iteration", "Exits the loop immediately", "Restarts the loop", "Pauses the loop", 2),
                    ("In Python, when does a `for` loop's `else:` block execute?",
                     "After every iteration", "Only when the loop is skipped", "When the loop completes without hitting break", "When an exception occurs", 3),
                    ("Why prefer guard clauses over deep nesting?",
                     "They run faster at runtime", "They flatten logic and keep the happy path readable", "They avoid writing tests", "They are required by JavaScript", 2),
                ],
            },
            {
                "id": 3, "title": "Functions & Scope",
                "summary": "Functions as reusable units of logic, and scope rules that decide which variables they can see.",
                "reading_minutes": 6,
                "content": """# Functions & Scope

A function packages logic behind a name: give it inputs, it returns an output. Well-named small functions are the single biggest readability lever in any codebase.

## Defining functions

```javascript
function gradeFor(score) {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  return 'C';
}

const double = (n) => n * 2;   // arrow form
```

Prefer **pure functions** — same input always yields the same output, no hidden side effects. They are trivially testable.

## Scope: who can see what?

Scope is the region of code where a name is visible:

1. **Global scope** — visible everywhere.
2. **Function scope** — visible inside the function only.
3. **Block scope** (`let`/`const` inside `{}`) — visible inside that block only.

Inner scopes can read outer variables, but never the reverse.

## Closures

A closure is a function that **remembers variables from the scope where it was created**, even after that scope has finished executing:

```javascript
function makeCounter() {
  let count = 0;                    // captured by the closure
  return () => ++count;
}
const next = makeCounter();
next(); // 1
next(); // 2  — count persists between calls
```

Closures power private state, event handlers, and memoization.

## Key takeaway

Keep functions small and pure where possible, and when a variable 'mysteriously' has the wrong value, trace the scope chain — scope decides visibility.
""",
                "quiz": [
                    ("What is a closure?",
                     "A function that remembers variables from its enclosing scope",
                     "A loop that never terminates",
                     "A variable declared with const",
                     "A function without parameters", 1),
                    ("Which statement about scope is TRUE?",
                     "Outer scopes can read inner variables",
                     "Inner scopes can read outer variables",
                     "Block scope does not exist in JavaScript",
                     "All variables are global by default", 2),
                ],
            },
        ],
    },
    {
        "id": 2, "title": "API Architecture", "icon": "🔌", "skill_key": "api",
        "description": "How systems talk to each other: HTTP, REST design, and robust error handling.",
        "notes": [
            {
                "id": 4, "title": "HTTP Fundamentals & the Request Lifecycle",
                "summary": "The anatomy of an HTTP request: methods, headers, bodies, and the client-server round trip.",
                "reading_minutes": 8,
                "content": """# HTTP Fundamentals & the Request Lifecycle

HTTP is a request/response protocol: a **client** sends a request, a **server** answers. Nothing else — no open connection, no memory between requests by default.

## Anatomy of a request

```http
GET /api/students/42 HTTP/1.1
Host: edumaster.example.com
Authorization: Bearer eyJhbGciOi...
Accept: application/json
```

- **Method** — the verb: what kind of action.
- **Path** — the resource being acted on.
- **Headers** — metadata: auth tokens, content types, caching hints.
- **Body** — payload, present on POST/PUT/PATCH.

## The method vocabulary

| Method | Intent | Idempotent? |
| --- | --- | --- |
| GET | read | yes |
| POST | create | no |
| PUT | full replace | yes |
| PATCH | partial update | no |
| DELETE | remove | yes |

**Idempotent** means repeating the request yields the same server state — `GET /students/42` a thousand times changes nothing; `POST /students` a thousand times creates a thousand students.

## The lifecycle

1. Client resolves DNS, opens a TCP/TLS connection.
2. Request travels to the server (often through proxies/load balancers).
3. Server middleware checks auth, validates input.
4. Handler runs business logic and queries data stores.
5. Response (status + headers + body) travels back.

## Key takeaway

Pick the HTTP method for its *semantic meaning*, not convenience. `DELETE /students/42` inside a `GET` endpoint breaks caching, proxies, and every client that trusts HTTP semantics.
""",
                "quiz": [
                    ("Which HTTP method is idempotent?",
                     "POST", "GET", "PATCH (by default)", "None of them", 2),
                    ("Where does an authentication token typically travel in an API request?",
                     "In the URL path", "In the Authorization header", "In the HTTP method", "In DNS records", 2),
                    ("What does 'idempotent' mean?",
                     "The request is encrypted", "Repeating the request leaves server state unchanged", "The request has no body", "The server responds in under a second", 2),
                ],
            },
            {
                "id": 5, "title": "RESTful API Design",
                "summary": "Modeling an API around resources: naming, nesting, and predictable URL conventions.",
                "reading_minutes": 7,
                "content": """# RESTful API Design

REST styles an API around **resources** (nouns) manipulated by HTTP methods (verbs). The URL says *what*; the method says *how*.

## Resource naming

```text
GET    /api/students          → list students
POST   /api/students          → create a student
GET    /api/students/42       → one student
PUT    /api/students/42       → replace student 42
DELETE /api/students/42       → remove student 42
```

Conventions that matter:

- **Plural nouns** for collections (`/students`, not `/student`).
- No verbs in paths — `POST /students` not `POST /createStudent`.
- Nest only for genuine ownership, and keep it shallow: `/api/students/42/evaluations`.
- Filter with query params: `/api/students?track=developer`.

## Collection responses

```json
{
  "data": [
    { "id": 1, "name": "Kasun Perera", "student_code": "IT-2024-001" }
  ],
  "total": 5
}
```

A consistent envelope (`data`, `total`, pagination links) lets every client share one parsing routine.

## Versioning

Breaking changes happen. Prefix routes (`/api/v1/...`) so old clients keep working while `/api/v2/...` evolves.

## Key takeaway

A good REST API is *guessable*: once a developer understands one endpoint, the naming conventions let them predict the rest.
""",
                "quiz": [
                    ("Which URL follows REST naming conventions for fetching one student?",
                     "/api/getStudent?id=42", "/api/students/42", "/api/student/fetch/42", "/api/GET/students/42", 2),
                    ("How should you filter a collection by track?",
                     "/api/students-developer", "POST /api/filter", "Query param: /api/students?track=developer", "A custom header", 3),
                    ("Why version an API with a path prefix like /api/v1?",
                     "It improves database speed", "Old clients keep working while the API evolves", "It is required by HTTP", "It prevents authentication", 2),
                ],
            },
            {
                "id": 6, "title": "Status Codes & Error Handling",
                "summary": "Speaking the status-code language and returning errors clients can act on.",
                "reading_minutes": 6,
                "content": """# Status Codes & Error Handling

Status codes are the API's first word in any conversation. Clients branch on them before ever reading the body — get them wrong and no error message can save you.

## The five families

| Range | Meaning | Common examples |
| --- | --- | --- |
| 2xx | Success | 200 OK, 201 Created, 204 No Content |
| 3xx | Redirection | 301 Moved, 304 Not Modified |
| 4xx | **Client** did something wrong | 400, 401, 403, 404, 422 |
| 5xx | **Server** failed | 500, 502, 503 |

The ones you will use weekly:

- **400** — malformed request (bad JSON, missing field).
- **401** — who are you? (missing/invalid credentials).
- **403** — I know you, but you can't do that.
- **404** — resource not found.
- **422** — well-formed but semantically invalid (validation failures).
- **201** — created (pair with a `Location` header or the new resource).

## Error body contract

```json
{
  "error": "validation_failed",
  "message": "Email must be unique.",
  "details": [{ "field": "email", "issue": "duplicate" }]
}
```

A stable machine-readable `error` code plus a human `message` lets UIs show friendly text and logs stay searchable.

## Golden rule

**4xx means the client should change the request; 5xx means the server owes a fix.** Returning 200 with an error buried in the body defeats every proxy, cache, and monitoring tool in the chain.
""",
                "quiz": [
                    ("A request fails because the JWT is missing. Which status code fits?",
                     "403", "401", "404", "422", 2),
                    ("Which code signals a validation failure on a well-formed request?",
                     "400", "404", "422", "500", 3),
                    ("What should accompany a successful POST that creates a resource?",
                     "204 No Content", "201 Created", "301 Moved", "200 with an empty body", 2),
                ],
            },
        ],
    },
]

LEARNING_PART_B = [
    {
        "id": 3, "title": "Frontend & State", "icon": "🎨", "skill_key": "frontend",
        "description": "Building interfaces users love: the DOM, component thinking, and state management.",
        "notes": [
            {
                "id": 7, "title": "The DOM & Event Handling",
                "summary": "How the browser models a page as a tree and how your code reacts to user actions.",
                "reading_minutes": 7,
                "content": """# The DOM & Event Handling

The **Document Object Model (DOM)** is the browser's live, in-memory tree representation of the page. JavaScript reads and mutates this tree; the browser repaints what changed.

## Selecting and mutating

```javascript
const card = document.querySelector('.mastery-card');
card.textContent = 'Score: 82%';
card.classList.add('highlighted');
```

Every mutation has a cost: the browser may need to recalculate layout and repaint. Batch reads before writes to avoid layout thrashing.

## Events bubble upward

When a user clicks a button, the event travels: **target → ancestors → window**. That is bubbling, and it enables *event delegation*:

```javascript
document.querySelector('.note-list').addEventListener('click', (e) => {
  const item = e.target.closest('.note-item');
  if (item) openNote(item.dataset.id);
});
```

One listener on the parent handles clicks on any child — even children added later. This beats attaching a listener per row.

## Prevent defaults, stop propagation

- `e.preventDefault()` — cancel the browser's built-in action (form submit, link navigation).
- `e.stopPropagation()` — stop the bubble; use sparingly, it breaks delegation.

## Key takeaway

The DOM is a *projection* of state. If you find yourself imperatively poking dozens of nodes, you are probably fighting a framework's job — hold state, re-render.
""",
                "quiz": [
                    ("What is the DOM?",
                     "A CSS rendering engine",
                     "The browser's in-memory tree representation of the page",
                     "The HTML file on disk",
                     "A JavaScript framework", 2),
                    ("What does event delegation rely on?",
                     "Events bubbling up to ancestor listeners",
                     "Each element owning its own listener",
                     "CSS selectors at runtime",
                     "Blocking the main thread", 1),
                    ("Which call cancels a form's default submit behavior?",
                     "e.stopPropagation()", "e.preventDefault()", "e.cancelBubble()", "return null", 2),
                ],
            },
            {
                "id": 8, "title": "Component Thinking in React",
                "summary": "Decomposing UIs into reusable components, passing data down with props.",
                "reading_minutes": 8,
                "content": """# Component Thinking in React

React's core idea: describe UI as a **function of data**. Components are reusable functions that take `props` and return markup.

## Decompose by responsibility

```jsx
function Library({ subjects }) {
  return (
    <section className="library">
      {subjects.map((s) => (
        <SubjectCard key={s.id} subject={s} />
      ))}
    </section>
  );
}
```

Each component should do **one job**: `SubjectCard` displays one subject; the list, search, and progress ring live elsewhere. If a component needs a paragraph to explain, split it.

## Props flow down

```jsx
function SubjectCard({ subject }) {
  const percent = subject.note_count
    ? Math.round((subject.read_count / subject.note_count) * 100)
    : 0;
  return (
    <article>
      <h3>{subject.icon} {subject.title}</h3>
      <progress value={percent} max={100} />
    </article>
  );
}
```

Props are **read-only** from the child's perspective. Data moves one way: parent → child. When a child must notify the parent, the parent passes a callback prop.

## Keys make lists honest

`key={s.id}` tells React which items persist across re-renders. Using array indexes as keys causes state to attach to the wrong rows when the list reorders.

## Key takeaway

Think in components *before* writing markup: sketch the UI, draw boxes around each responsibility, name them, then implement from the smallest box outward.
""",
                "quiz": [
                    ("In React, how do props behave in the child component?",
                     "They are mutable local copies", "They are read-only inputs from the parent", "They sync to localStorage", "They replace state", 2),
                    ("Why should lists use a stable `key` like an id?",
                     "It improves CSS specificity",
                     "React matches items across renders; index keys misbind state on reorder",
                     "It is required for event handlers",
                     "Keys enable server rendering", 2),
                    ("A child needs to tell the parent a button was clicked. What is the idiomatic solution?",
                     "Mutate a prop", "Dispatch a global event", "Parent passes a callback prop", "Use window.postMessage", 3),
                ],
            },
            {
                "id": 9, "title": "State Management Patterns",
                "summary": "Local vs lifted vs global state, and the rules that keep updates predictable.",
                "reading_minutes": 8,
                "content": """# State Management Patterns

State is any data that changes over time and affects the UI. The hard part of frontend engineering is deciding **where** state lives.

## The placement ladder

1. **Local state** — one component needs it. `const [fontSize, setFontSize] = useState(16);`
2. **Lifted state** — siblings share it; move it to their closest common parent and pass down via props.
3. **Context** — many distant components need it (theme, auth user).
4. **Server cache** — data fetched from an API is a *cache*, not state; treat invalidation explicitly.

Start at the bottom rung and climb only when forced.

## Rules for predictable updates

```jsx
// ❌ mutating state in place
bookmarks.push(noteId);
setBookmarks(bookmarks);

// ✅ immutable update → new reference
setBookmarks([...bookmarks, noteId]);
```

Frameworks detect change by **reference comparison**; mutating in place keeps the same reference and the UI never re-renders.

## Derived values are not state

```jsx
// ❌ duplicate source of truth
const [readCount, setReadCount] = useState(0);

// ✅ compute during render
const readCount = notes.filter((n) => n.is_read).length;
```

Storing values you can compute invites drift between the copy and its source.

## Key takeaway

Every bug of the form 'the UI shows stale data' traces back to misplaced, mutated, or duplicated state. Minimize what you store; compute the rest.
""",
                "quiz": [
                    ("Two sibling components need the same value. Where should it live?",
                     "In both children, kept in sync manually",
                     "In their closest common parent, passed down via props",
                     "In a global variable",
                     "In localStorage", 2),
                    ("Why does mutating an array in state fail to re-render?",
                     "React forbids arrays in state",
                     "Change detection compares references; mutation keeps the same reference",
                     "setQueue is asynchronous",
                     "The browser blocks the update", 2),
                    ("A value can be computed from existing state. Should it be stored separately?",
                     "Yes, for performance", "No — derive it during render to avoid drift", "Only in context", "Only if it is numeric", 2),
                ],
            },
        ],
    },
    {
        "id": 4, "title": "Database Integration", "icon": "🗄️", "skill_key": "database",
        "description": "Persisting data correctly: relational modeling, SQL, and ORM pitfalls.",
        "notes": [
            {
                "id": 10, "title": "Relational Data Modeling",
                "summary": "Designing tables, keys, and relationships so data stays consistent by construction.",
                "reading_minutes": 8,
                "content": """# Relational Data Modeling

A relational schema is a contract: it decides what facts can be stored and which inconsistencies are *impossible* by construction.

## Tables, rows, keys

Each table models **one kind of entity**; each row is one instance:

```sql
CREATE TABLE students (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  student_code  TEXT NOT NULL UNIQUE
);
```

- **Primary key** — stable identity; never expose meaning in it (use surrogate ids, not emails).
- **Unique constraints** — declare business rules in the schema so no code path can violate them.

## Relationships

- **One-to-many**: foreign key on the many side.
  `evaluations.student_id → students.id`
- **Many-to-many**: a junction table holding two FKs.
  `enrollments(student_id, course_id)`

```sql
CREATE TABLE lifecycle_evaluations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  stage      TEXT NOT NULL,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);
```

`ON DELETE CASCADE` encodes ownership: delete the student, their evaluations go too — the database enforces it even if application code forgets.

## Normalize first, denormalize deliberately

Store each fact once (a student's name lives in `students`, nowhere else). Duplicate columns for performance only when measured, and document the trade-off.

## Key takeaway

A strong schema is documentation and enforcement in one artifact. If an invalid state can be expressed in your schema, make it **inexpressible**.
""",
                "quiz": [
                    ("Where does the foreign key live for a one-to-many relationship?",
                     "On the 'one' side", "On the 'many' side", "In a separate database", "Keys are not needed", 2),
                    ("What does ON DELETE CASCADE enforce?",
                     "Rows are archived instead of deleted",
                     "Deleting a parent also deletes its owned children",
                     "Deletes are forbidden",
                     "Child rows become orphans", 2),
                    ("Why prefer surrogate integer ids over emails as primary keys?",
                     "Integers encrypt better",
                     "Emails can change; stable identity should not depend on mutable data",
                     "SQLite requires integers",
                     "Strings cannot be indexed", 2),
                ],
            },
            {
                "id": 11, "title": "SQL Queries & Joins",
                "summary": "Reading and combining tables with SELECT, WHERE, JOIN, and aggregation.",
                "reading_minutes": 8,
                "content": """# SQL Queries & Joins

SQL is declarative: you describe **what** you want; the engine decides **how**. Mastering joins and aggregation unlocks almost any report.

## SELECT anatomy

```sql
SELECT name, email
FROM students
WHERE student_code LIKE 'IT-2024%'
ORDER BY name;
```

Logical order: `FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY`. Knowing this explains why you cannot reference a `SELECT` alias inside `WHERE`.

## Joins

```sql
SELECT s.name, e.stage, e.mastery_logic_and_syntax
FROM students s
JOIN lifecycle_evaluations e ON e.student_id = s.id
WHERE e.stage = 'Baseline Viva';
```

- **INNER JOIN** — only matching rows on both sides.
- **LEFT JOIN** — all rows from the left table; NULLs where no match. Use it to find students *without* evaluations:

```sql
SELECT s.name
FROM students s
LEFT JOIN lifecycle_evaluations e ON e.student_id = s.id
WHERE e.id IS NULL;
```

## Aggregation

```sql
SELECT stage, AVG(mastery_logic_and_syntax) AS avg_logic, COUNT(*) AS n
FROM lifecycle_evaluations
GROUP BY stage
HAVING COUNT(*) > 1;
```

`WHERE` filters rows **before** grouping; `HAVING` filters **after** aggregation.

## Key takeaway

Write joins with the relationship in mind — every FK is a bridge. If a query returns surprise duplicates, you have joined across a one-to-many without aggregating.
""",
                "quiz": [
                    ("Which join keeps all left-table rows, filling NULLs where no match exists?",
                     "INNER JOIN", "LEFT JOIN", "CROSS JOIN", "SELF JOIN", 2),
                    ("What is the difference between WHERE and HAVING?",
                     "They are aliases", "WHERE filters before grouping, HAVING after aggregation", "HAVING runs faster", "WHERE works only on numbers", 2),
                    ("A query joining students to evaluations returns duplicate student rows. Likely cause?",
                     "Missing index", "One student has many evaluations and no aggregation was applied", "SQLite bug", "Wrong data types", 2),
                ],
            },
            {
                "id": 12, "title": "ORMs & the N+1 Problem",
                "summary": "How ORMs map objects to tables, and the query-pattern that silently kills performance.",
                "reading_minutes": 7,
                "content": """# ORMs & the N+1 Problem

An ORM (Object-Relational Mapper) maps tables to classes and rows to objects — SQLAlchemy, in this project. It removes boilerplate, but it also hides the SQL it generates. Hidden SQL is where performance bugs live.

## The mapping

```python
class Student(Base):
    __tablename__ = "students"
    id = mapped_column(Integer, primary_key=True)
    evaluations = relationship("LifecycleEvaluation", lazy="selectin")
```

Accessing `student.evaluations` transparently runs queries for you.

## The N+1 problem

```python
students = await db.execute(select(Student))       # 1 query
for s in students.scalars():
    print(len(s.evaluations))                      # +1 query per student!
```

For 50 students that is **1 + 50 queries**. The pattern: fetch a list, then lazily fetch a relation inside a loop.

## The fix: eager loading

```python
from sqlalchemy.orm import selectinload

stmt = select(Student).options(selectinload(Student.evaluations))
students = (await db.execute(stmt)).scalars().all()   # 2 queries total
```

`selectinload` fetches all related rows in one follow-up `WHERE id IN (...)` query. The same logic applies in Django (`prefetch_related`) and TypeORM (`relations`).

## Spotting it early

- Log/echo SQL in development and watch query counts.
- Any time a query appears *inside* a loop over ORM objects, stop and eager-load.

## Key takeaway

The ORM is a translator, not a mind-reader. Count your queries per request; a list endpoint should run a small constant number of them, not N+1.
""",
                "quiz": [
                    ("What is the N+1 problem?",
                     "An indexing strategy",
                     "One query fetches a list, then one extra query per item fetches relations",
                     "A locking deadlock",
                     "Querying N tables at once", 2),
                    ("In SQLAlchemy, how do you avoid N+1 for a relationship?",
                     "Add more indexes", "Use selectinload / eager loading", "Increase the pool size", "Disable the relationship", 2),
                    ("What does an ORM fundamentally do?",
                     "Encrypts table data", "Maps tables to classes and rows to objects", "Replaces the database", "Compiles SQL to bytecode", 2),
                ],
            },
        ],
    },
]

LEARNING_DATA = LEARNING_PART_A + LEARNING_PART_B

# --- Subjects ---
for subject in LEARNING_DATA:
    cursor.execute(
        "INSERT OR IGNORE INTO subjects (id, title, description, icon, skill_key, order_index, created_at) "
        "VALUES (?,?,?,?,?,?,?)",
        (subject["id"], subject["title"], subject["description"], subject["icon"],
         subject["skill_key"], subject["id"], now),
    )

# --- Notes ---
for subject in LEARNING_DATA:
    for note in subject["notes"]:
        cursor.execute(
            "INSERT OR IGNORE INTO notes "
            "(id, subject_id, title, summary, content, reading_minutes, order_index, source, created_at, updated_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?)",
            (note["id"], subject["id"], note["title"], note["summary"], note["content"],
             note["reading_minutes"], note["id"], "seed", now, now),
        )

# --- Quiz questions ---
question_id = 0
for subject in LEARNING_DATA:
    for note in subject["notes"]:
        for q in note["quiz"]:
            question_id += 1
            question, opt_a, opt_b, opt_c, opt_d, correct = q
            cursor.execute(
                "INSERT OR IGNORE INTO quiz_questions "
                "(id, note_id, question, option_a, option_b, option_c, option_d, correct_option, order_index) "
                "VALUES (?,?,?,?,?,?,?,?,?)",
                (question_id, note["id"], question, opt_a, opt_b, opt_c, opt_d, correct, question_id),
            )

# ============================================================
#  Course Modules & LMS Content (Matching LMS Screenshots)
# ============================================================

for tbl in [
    "module_diagnostic_evaluations",
    "module_assignment_submissions",
    "module_quiz_attempts",
    "module_quiz_questions",
    "module_items",
    "module_sections",
    "module_enrollments",
    "course_modules",
]:
    cursor.execute(f"DELETE FROM {tbl}")

modules = [
    (1, "NET 101", "Networking 1", "Fundamental concepts of data communications, network topologies, the OSI 7-layer reference model, TCP/IP protocol suite, IP addressing, and routing.", "Level I", "23/24", "networking", None, 1, 1, now, now),
    (2, "INTE 31283", "Big Data and Data Warehousing", "Architectures, storage models, ETL processes, and analytics pipelines for large-scale data warehouses and distributed big data environments.", "Level III", "23/24", "database", None, 1, 1, now, now),
    (3, "INTE 31213", "Advanced Database", "Transaction management, concurrency control, ACID properties, query optimization, and distributed NoSQL databases.", "Level III", "23/24", "blue", None, 1, 1, now, now),
    (4, "GNST 32216", "Internship", "Industrial training placement guidelines, progress reporting, and final defense preparation.", "Level III", "23/24", "internship", None, 1, 1, now, now),
    (5, "Academic Literacy II", "Academic Literacy II", "Technical communication, academic research methodology, and writing standards for computing projects.", "Miscellaneous", "22/24", "purple", None, 1, 1, now, now),
    (6, "CS 4101", "Neural Networks and Deep Learning", "Biological & artificial neurons, multilayer perceptrons, backpropagation, activation functions, loss surfaces, gradient descent optimization, and CNNs.", "Level IV", "23/24", "code", None, 1, 1, now, now),
]

cursor.executemany(
    "INSERT OR IGNORE INTO course_modules (id, code, title, description, level, academic_year, banner_pattern, banner_image_url, is_published, created_by_admin_id, created_at, updated_at) "
    "VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
    modules,
)

# --- Module Sections ---
sections = [
    # NET 101
    (1, 1, "General", "General course announcements, course outline, and past papers.", 0, now),
    (2, 1, "Introduction to Computer Networks", "Network architectures, topologies, and basic transmission concepts.", 1, now),
    (3, 1, "OSI & TCP/IP Reference Models", "Layered communications, encapsulation, protocol suites, and Wireshark inspection.", 2, now),
    (4, 1, "IP Addressing & Subnetting", "IPv4 classes, CIDR notation, subnet calculations, and VLSM.", 3, now),
    # INTE 31283
    (5, 2, "General", "Course announcements, ERA design guidelines, and question papers.", 0, now),
    (6, 2, "Introduction", "Overview of big data architectures, data lakes, and data warehouses.", 1, now),
    (7, 2, "DW", "Data warehousing dimensional modeling, star vs snowflake schema, and ETL pipelines.", 2, now),
    # CS 4101 - Neural Networks and Deep Learning
    (8, 6, "General", "Course syllabus, announcements, and mathematical prerequisites.", 0, now),
    (9, 6, "Week 1: Artificial Neurons & Gradient Descent", "Biological vs artificial neurons, single-layer perceptrons, forward pass, and gradient optimization.", 1, now),
    (10, 6, "Week 2: Multilayer Perceptrons & Backpropagation", "The XOR problem, non-linear activations (ReLU, Sigmoid), and the chain rule backpropagation algorithm.", 2, now),
    (11, 6, "Week 3: Convolutional Neural Networks (CNNs)", "2D convolution kernels, feature maps, spatial invariance, and pooling architectures.", 3, now),
]

cursor.executemany(
    "INSERT OR IGNORE INTO module_sections (id, module_id, title, description, order_index, created_at) "
    "VALUES (?,?,?,?,?,?)",
    sections,
)

# --- Module Items ---
items = [
    # NET 101 - General
    (1, 1, "announcement", "Announcements", "Important updates regarding lecture schedules, lab access, and midterm exams.",
     "Welcome to **Networking 1 (23/24)**! Practical labs will be held in Lab 04 on Thursdays from 10:00 AM to 12:00 PM. Please ensure you have Wireshark and Packet Tracer installed on your laptops.",
     None, "", "", None, 100, 15, 0, now, now),
    (2, 1, "file", "Question Paper 2023.pdf", "Past examination paper from 2023 academic year.",
     "", "/uploads/modules/sample_question_paper_2023.pdf", "Question Paper 2023.pdf", "1.8 MB", None, 100, 15, 1, now, now),
    (3, 1, "file", "Question Paper 2024.pdf", "Past examination paper from 2024 academic year.",
     "", "/uploads/modules/sample_question_paper_2024.pdf", "Question Paper 2024.pdf", "2.1 MB", None, 100, 15, 2, now, now),

    # NET 101 - Introduction
    (4, 2, "slide", "Lecture 01 - Introduction to Computer Networks", "Overview of network devices, packet switching vs circuit switching, and topologies.",
     "### Lecture Overview\n- Network edge and core\n- Topologies: Star, Mesh, Ring, Bus\n- Transmission media: Twisted pair, Fiber, Wireless RF\n- Latency, bandwidth, and throughput metrics",
     "/uploads/modules/Lecture_01_Intro_Networks.pdf", "Lecture_01_Intro_Networks.pdf", "3.4 MB", None, 100, 15, 0, now, now),
    (5, 2, "note", "Study Note: Network Topologies & Edge vs Core", "Essential principles of star, mesh, and hybrid network designs.",
     "## Network Topologies Overview\n\nA **network topology** describes how the elements of a network are mapped to each other.\n\n### 1. Star Topology\nAll nodes are connected to a central switch or hub.\n- **Advantage**: Fault isolation; one cable failure doesn't bring down the network.\n- **Disadvantage**: Single point of failure at the central device.\n\n### 2. Mesh Topology\nEvery node is connected to every other node (full mesh: `n*(n-1)/2` links).\n- **Advantage**: High redundancy and throughput.\n- **Disadvantage**: High cabling cost and complexity.\n\n### 3. Tree / Hierarchical Topology\nCombines star and bus topologies, organized in levels (Core, Distribution, Access).",
     None, "", "", None, 100, 15, 1, now, now),

    # NET 101 - OSI & TCP/IP
    (6, 3, "slide", "Lecture 02 - Layered Network Architecture", "Comparison between the 7-layer OSI model and the 4-layer TCP/IP protocol stack.",
     "### Key Concepts\n- Layer modularity and abstraction\n- Encapsulation and headers\n- Physical, Data Link, Network, Transport, Application layers",
     "/uploads/modules/Lecture_02_OSI_Model.pdf", "Lecture_02_OSI_Model.pdf", "4.2 MB", None, 100, 15, 0, now, now),
    (7, 3, "note", "Study Note: Protocol Data Units & Encapsulation", "Detailed breakdown of Headers, Trailers, and PDU names at each layer.",
     "## Data Encapsulation in Layered Models\n\nAs data passes down the protocol stack, each layer prepends a **header** (and sometimes a trailer):\n\n| Layer | PDU Name | Typical Protocols |\n|---|---|---|\n| Application | Data / Message | HTTP, DNS, SSH, SMTP |\n| Transport | Segment (TCP) / Datagram (UDP) | TCP, UDP |\n| Network | Packet | IPv4, IPv6, ICMP |\n| Data Link | Frame | Ethernet (802.3), Wi-Fi (802.11) |\n| Physical | Bits | Voltage levels, Optical pulses |\n\n### De-encapsulation\nThe receiving host strips headers sequentially from layer 1 up to layer 7 to deliver the original message.",
     None, "", "", None, 100, 15, 1, now, now),
    (8, 3, "assignment", "Assignment 1: Packet Analysis with Wireshark", "Capture a 3-way TCP handshake and DNS resolution query. Submit your PCAP analysis report.",
     "### Assignment Objectives\n1. Download and install **Wireshark**.\n2. Start a capture on your active network interface.\n3. Open your browser and navigate to `http://example.com`.\n4. Apply the display filter `tcp.port == 80 || dns`.\n5. Capture screenshots and explain:\n   - The TCP SYN, SYN-ACK, ACK sequence numbers.\n   - The DNS Query (A record request) and DNS Response.\n6. Submit a PDF report summarizing your findings.",
     None, "", "", "2026-09-15 23:59:00", 100, 15, 2, now, now),
    (9, 3, "quiz", "Quiz 01: OSI 7-Layer Reference Model", "Test your knowledge of OSI layers, protocols, and encapsulation mechanisms.",
     "Answer all 5 questions. You have 15 minutes to complete the quiz.",
     None, "", "", None, 100, 15, 3, now, now),

    # INTE 31283 - General
    (10, 5, "announcement", "Announcements", "Welcome to Big Data & Data Warehousing. All assignments must adhere to the IEEE format.",
     "Lecture slides will be uploaded weekly. Please ensure your cloud database access is configured before Lab 2.",
     None, "", "", None, 100, 15, 0, now, now),
    (11, 5, "file", "Question Paper 2023.pdf", "Past year final exam paper.",
     "", "/uploads/modules/sample_dw_2023.pdf", "Question Paper 2023.pdf", "1.5 MB", None, 100, 15, 1, now, now),
    (12, 5, "assignment", "ERA Design", "Enterprise Relational Architecture & Dimensional Model project design submission.",
     "Submit your Entity-Relationship and Fact-Dimension schema design for the retail case study.",
     None, "", "", "2026-09-10 17:00:00", 100, 15, 2, now, now),
    (13, 5, "file", "Question Paper 2024.pdf", "Past year final exam paper.",
     "", "/uploads/modules/sample_dw_2024.pdf", "Question Paper 2024.pdf", "2.0 MB", None, 100, 15, 3, now, now),

    # INTE 31283 - Introduction
    (14, 6, "slide", "Introduction to Big Data & Warehousing", "Foundations of large-scale analytics, Volume/Velocity/Variety, and modern Lakehouses.",
     "Introduction to OLTP vs OLAP, data extraction pipelines, and warehouse architectures.",
     "/uploads/modules/Introduction_DW.pdf", "Introduction.pdf", "3.1 MB", None, 100, 15, 0, now, now),

    # CS 4101 - Week 1: Artificial Neurons & Gradient Descent
    (15, 9, "diagnostic_viva", "🌱 Pre-Week 1 Diagnostic AI Viva: Neural Networks & Perceptrons",
     "Non-graded formative assessment. Conducted by AI to evaluate your baseline understanding before the lecture begins so your lecturer can focus on your gaps.",
     "Topics: Artificial Neurons, Perceptron Model, Linear Separability, Activation Functions, Loss Functions, Gradient Descent",
     None, "", "", None, 100, 10, 0, now, now),
    (16, 9, "slide", "Lecture 01 - From Biological Neurons to Single-Layer Perceptrons",
     "Mathematical model of an artificial neuron, weighted inputs, bias, and step functions.",
     "### Lecture Overview\n- Biological inspiration and Donald Hebb's postulate\n- Perceptron formulation: z = w·x + b\n- Linear separability and decision boundaries\n- Gradient descent parameter update rules",
     "/uploads/modules/Lecture_01_Perceptrons.pdf", "Lecture_01_Perceptrons.pdf", "4.2 MB", None, 100, 15, 1, now, now),
    (17, 9, "note", "Study Note: The Mathematics of Gradient Descent and Convex Loss",
     "Derivation of MSE loss derivative, gradient vectors, learning rate step size, and convergence.",
     "## Gradient Descent in Neural Networks\n\nGradient descent iteratively shifts parameters in the direction of steepest descent:\n\n$$W := W - \\alpha \\nabla_W J(W)$$\n\n### Learning Rate Sensitivity\n- **Too Large (\\alpha >> 0)**: Parameter oscillations overshoot the minimum and diverge.\n- **Too Small (\\alpha -> 0)**: Computation is excessively slow and gets trapped in saddle plateaus.",
     None, "", "", None, 100, 15, 2, now, now),
    (18, 9, "assignment", "Lab 01: Vectorized Logistic Regression & Decision Boundaries",
     "Implement a single-neuron binary classifier using vectorized Python NumPy operations. Submit your code & loss curve.",
     "Download starter code and complete forward_pass(), compute_loss(), and update_weights().",
     None, "", "", "2026-09-20 23:59:00", 100, 15, 3, now, now),
    (22, 9, "weekly_viva", "🎯 Post-Week 1 AI Knowledge Check Viva (Graded • 10%)",
     "Graded post-lecture assessment. Evaluates what you learned and retained from Lecture 01 on artificial neurons, loss surfaces, and gradient descent updates.",
     "Topics: Artificial Neurons, Perceptron Learning Rule, Activation Derivatives, MSE Convexity vs Non-Convexity, Gradient Descent Updates",
     None, "", "", None, 100, 10, 4, now, now),

    # CS 4101 - Week 2: Multilayer Perceptrons & Backpropagation
    (19, 10, "diagnostic_viva", "🌱 Pre-Week 2 Diagnostic AI Viva: Backpropagation & Activations",
     "Non-graded formative assessment. Evaluates your intuition on multi-layer architectures, non-linear activations, and chain rule gradients.",
     "Topics: Multi-layer Perceptrons, Non-linear Activations (ReLU, Sigmoid), Backpropagation, Chain Rule, Vanishing Gradients",
     None, "", "", None, 100, 10, 0, now, now),
    (20, 10, "slide", "Lecture 02 - The Chain Rule and Backpropagation Algorithm",
     "Detailed derivation of gradient backpropagation across hidden layers.",
     "Step-by-step mathematical derivation of backpropagation with worked numerical examples.",
     "/uploads/modules/Lecture_02_Backprop.pdf", "Lecture_02_Backprop.pdf", "5.1 MB", None, 100, 15, 1, now, now),

    # CS 4101 - Week 3: Convolutional Neural Networks (CNNs)
    (21, 11, "diagnostic_viva", "🌱 Pre-Week 3 Diagnostic AI Viva: Convolutions & Feature Extraction",
     "Non-graded formative assessment. Explores your understanding of 2D filters, spatial locality, and pooling.",
     "Topics: 2D Convolutions, Stride, Padding, Feature Maps, Max Pooling",
     None, "", "", None, 100, 10, 0, now, now),
]

cursor.executemany(
    "INSERT OR IGNORE INTO module_items "
    "(id, section_id, item_type, title, description, content, file_url, file_name, file_size, due_date, max_points, time_limit_minutes, order_index, created_at, updated_at) "
    "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    items,
)

# --- Module Quiz Questions (for NET 101 Quiz 01) ---
quiz_questions = [
    (1, 9, "Which OSI layer is responsible for end-to-end reliable communication, error recovery, and flow control?",
     "Network Layer", "Transport Layer", "Data Link Layer", "Session Layer", 2,
     "The Transport Layer (Layer 4) utilizes protocols like TCP to provide end-to-end reliability, windowing, and flow control.", 0),
    (2, 9, "What is the Protocol Data Unit (PDU) name at the Network Layer of the OSI model?",
     "Frame", "Segment", "Packet", "Bit", 3,
     "At the Network Layer (Layer 3), data is encapsulated into Packets containing IP headers.", 1),
    (3, 9, "Which protocol is primarily used to resolve a human-readable domain name (e.g. google.com) into an IP address?",
     "ARP", "DHCP", "DNS", "BGP", 3,
     "The Domain Name System (DNS) maps domain names to IP addresses.", 2),
    (4, 9, "In the TCP 3-way handshake, what flag(s) does the server send back in response to an initial SYN packet?",
     "ACK only", "SYN-ACK", "RST", "FIN-ACK", 2,
     "The server acknowledges the client's SYN and synchronizes its own sequence number by responding with SYN-ACK.", 3),
    (5, 9, "What is the primary function of the Address Resolution Protocol (ARP)?",
     "Translate IPv4 addresses to MAC addresses", "Assign dynamic IP addresses to hosts",
     "Encapsulate IPv6 into IPv4 tunnels", "Filter malicious traffic at the gateway", 1,
     "ARP maps a known Layer 3 IP address to a physical Layer 2 MAC address on the local network segment.", 4),
]

cursor.executemany(
    "INSERT OR IGNORE INTO module_quiz_questions "
    "(id, item_id, question, option_a, option_b, option_c, option_d, correct_option, explanation, order_index) "
    "VALUES (?,?,?,?,?,?,?,?,?,?)",
    quiz_questions,
)

# --- Enrollments ---
enrollments = [
    (1, 1, 1, now, "active"),  # Kasun in NET 101
    (2, 1, 2, now, "active"),  # Kasun in INTE 31283
    (3, 2, 1, now, "active"),  # Nimali in NET 101
    (4, 2, 3, now, "active"),  # Nimali in INTE 31213
    (5, 3, 1, now, "active"),  # Ravi in NET 101
    (6, 4, 2, now, "active"),  # Dinesh in INTE 31283
    # CS 4101 Enrollments (Neural Networks & Deep Learning)
    (7, 1, 6, now, "active"),  # Kasun in CS 4101
    (8, 2, 6, now, "active"),  # Nimali in CS 4101
    (9, 3, 6, now, "active"),  # Ravi in CS 4101
    (10, 4, 6, now, "active"),  # Dinesh in CS 4101
    (11, 5, 6, now, "active"),  # Amara in CS 4101
]

cursor.executemany(
    "INSERT OR IGNORE INTO module_enrollments (id, student_id, module_id, enrolled_at, status) "
    "VALUES (?,?,?,?,?)",
    enrollments,
)

# --- Pre-Week AI Diagnostic Viva Evaluations (CS 4101 - Week 1) ---
cursor.execute("""
CREATE TABLE IF NOT EXISTS module_diagnostic_evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    section_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    knowledge_level VARCHAR(50) NOT NULL DEFAULT 'Developing',
    readiness_score INTEGER NOT NULL DEFAULT 50,
    strong_areas TEXT NOT NULL DEFAULT '[]',
    weak_areas TEXT NOT NULL DEFAULT '[]',
    misconceptions TEXT NOT NULL DEFAULT '[]',
    diagnostic_summary TEXT NOT NULL DEFAULT '',
    ai_recommendation TEXT NOT NULL DEFAULT '',
    transcript_json TEXT NOT NULL DEFAULT '[]',
    completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(item_id) REFERENCES module_items(id) ON DELETE CASCADE,
    FOREIGN KEY(section_id) REFERENCES module_sections(id) ON DELETE CASCADE,
    FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT uq_student_diagnostic_eval UNIQUE (item_id, student_id)
)
""")

import json

diag_evals = [
    # 1. Kasun (Developing - 68%)
    (1, 15, 9, 1, "Developing", 68,
     json.dumps(["Artificial Neuron Architecture & Linear Combinations (z = Wx + b)", "Forward Propagation & Binary Decision Boundaries"]),
     json.dumps(["Role of Non-Linear Activation Functions (ReLU vs Sigmoid)", "Backpropagation Mathematics & Chain Rule Gradients"]),
     json.dumps(["Assumes stacking multiple linear layers creates non-linear decision boundaries for XOR"]),
     "Candidate understands basic artificial neuron forward calculations well, but shows conceptual confusion regarding why non-linear activations are required for multi-layer representation capacity.",
     "For Lecturer: Focus 20 minutes on visual XOR problem demonstrations and derive the gradient descent update step with visual loss surface plots.",
     json.dumps([
         {"role": "assistant", "content": "Welcome Kasun! What is an artificial neuron (perceptron), and how does it compute its output from inputs?"},
         {"role": "user", "content": "An artificial neuron multiplies each input by a weight, adds all together with a bias term, and passes through an activation function like a step function."},
         {"role": "assistant", "content": "Excellent foundation! Now, why can't a multi-layer neural network learn the XOR problem with only linear activations?"},
         {"role": "user", "content": "I think if we add more layers with more linear neurons, it creates more lines that can carve out the XOR corners."},
         {"role": "assistant", "content": "A very common thought! Stacking linear layers mathematically collapses into just another linear function. That is why non-linear activations like ReLU are essential."}
     ]), now),

    # 2. Nimali (Proficient - 76%)
    (2, 15, 9, 2, "Proficient", 76,
     json.dumps(["Artificial Neuron Architecture & Linear Combinations (z = Wx + b)", "Forward Propagation & Binary Decision Boundaries", "Basic Loss Calculation & Mean Squared Error"]),
     json.dumps(["Learning Rate Sensitivity & Loss Surface Oscillation", "Vanishing Gradients in Deep Architectures"]),
     json.dumps(["Confuses high learning rate oscillation with getting trapped in local minima"]),
     "Strong algebraic and forward propagation intuition. Needs visual clarity on gradient vector direction and learning rate step size dynamics.",
     "For Lecturer: Use an interactive 3D loss surface plot to illustrate overshooting minima when learning rate alpha is too high.",
     json.dumps([
         {"role": "assistant", "content": "Welcome Nimali! What is an artificial neuron and how does it compute its output?"},
         {"role": "user", "content": "It calculates z = dot(W, x) + b, then applies an activation like Sigmoid to squeeze the value between 0 and 1."},
         {"role": "assistant", "content": "Spot on! How does gradient descent use the loss function to tune the weights?"},
         {"role": "user", "content": "It takes the partial derivative dJ/dW and moves the weights in the opposite direction. If the step is too big, it gets stuck in local minima."},
         {"role": "assistant", "content": "Great grasp of the derivative direction! Note that too large a step actually causes oscillation/divergence rather than getting stuck."}
     ]), now),

    # 3. Ravi (Needs Guidance - 48%)
    (3, 15, 9, 3, "Needs Guidance", 48,
     json.dumps(["Artificial Neuron Architecture & Linear Combinations (z = Wx + b)"]),
     json.dumps(["Role of Non-Linear Activation Functions (ReLU vs Sigmoid)", "Gradient Descent Weight Updates & Optimization Dynamics", "Backpropagation Mathematics & Chain Rule Gradients"]),
     json.dumps(["Assumes weights update only once after all training epochs complete"]),
     "Understands inputs and weights conceptually, but has significant gaps in how iterative optimization and backpropagation updates occur.",
     "For Lecturer: High priority for individual attention during tutorial. Walk through a single numerical forward/backward iteration step on the board.",
     json.dumps([
         {"role": "assistant", "content": "Welcome Ravi! What is an artificial neuron?"},
         {"role": "user", "content": "It takes input features like age or price and gives a score using weights."},
         {"role": "assistant", "content": "How do those weights get learned?"},
         {"role": "user", "content": "The model checks the error at the end of training and changes all weights once."},
         {"role": "assistant", "content": "Good try! Weights actually update iteratively after each small batch or epoch using gradient steps."}
     ]), now),

    # 4. Dinesh (Developing - 62%)
    (4, 15, 9, 4, "Developing", 62,
     json.dumps(["Forward Propagation & Binary Decision Boundaries", "Matrix Vectorization of Batches"]),
     json.dumps(["Role of Non-Linear Activation Functions (ReLU vs Sigmoid)", "Vanishing Gradients in Deep Architectures"]),
     json.dumps(["Believes Sigmoid activation works equally well in 20-layer deep networks as ReLU"]),
     "Good programming and matrix intuition. Unaware of the mathematical saturation of Sigmoids in deep layers that caused the vanishing gradient dilemma.",
     "For Lecturer: Show the derivative of sigmoid f'(z) = f(z)(1-f(z)) maxes out at 0.25 to explain why gradients shrink exponentially across layers.",
     json.dumps([
         {"role": "assistant", "content": "Welcome Dinesh! How do you compute forward propagation across a batch?"},
         {"role": "user", "content": "Using matrix multiplication Z = X.W + b in NumPy. Then we apply sigmoid activation."},
         {"role": "assistant", "content": "Great vectorization! What if we stack 20 layers with Sigmoid?"},
         {"role": "user", "content": "It should give very deep representations, sigmoid handles any number of layers."},
         {"role": "assistant", "content": "Keep in mind that sigmoid derivative is at most 0.25, which causes vanishing gradients in deep models!"}
     ]), now),
]

cursor.executemany(
    "INSERT OR IGNORE INTO module_diagnostic_evaluations "
    "(id, item_id, section_id, student_id, knowledge_level, readiness_score, strong_areas, weak_areas, misconceptions, diagnostic_summary, ai_recommendation, transcript_json, completed_at) "
    "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
    diag_evals,
)

# --- Post-Lecture Graded AI Knowledge Check Vivas (CS 4101 - Week 1, Item 22) ---
cursor.execute("""
CREATE TABLE IF NOT EXISTS module_weekly_viva_evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    section_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    score INTEGER NOT NULL DEFAULT 70,
    knowledge_level VARCHAR(50) NOT NULL DEFAULT 'Proficient',
    mastered_topics TEXT NOT NULL DEFAULT '[]',
    retained_gaps TEXT NOT NULL DEFAULT '[]',
    feedback TEXT NOT NULL DEFAULT '',
    transcript_json TEXT NOT NULL DEFAULT '[]',
    completed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(item_id) REFERENCES module_items(id) ON DELETE CASCADE,
    FOREIGN KEY(section_id) REFERENCES module_sections(id) ON DELETE CASCADE,
    FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT uq_student_weekly_viva_eval UNIQUE (item_id, student_id)
)
""")

weekly_viva_evals = [
    # 1. Kasun (88% - Mastered) - shows growth from 68% pre-lecture
    (1, 22, 9, 1, 88, "Mastered",
     json.dumps(["Vectorized Perceptron Formulation", "Role of Non-Linear Activations (ReLU/Sigmoid)", "Derivation of MSE Gradient Update"]),
     json.dumps(["Momentum Hyperparameter Tuning"]),
     "Outstanding retention of Lecture 01! Kasun accurately explained why stacking linear layers fails on XOR and proved how ReLU resolves this.",
     json.dumps([
         {"role": "assistant", "content": "Welcome Kasun to your Post-Lecture Viva! How did Lecture 01 clarify why linear layers cannot solve XOR?"},
         {"role": "user", "content": "The lecturer proved that W2(W1*x + b1) + b2 simplifies to W_combined*x + b_combined, which is still a single hyperplane. Non-linear activation breaks this linearity."},
         {"role": "assistant", "content": "Superb comprehension! How does gradient descent update the weights when the derivative is negative?"},
         {"role": "user", "content": "Since W := W - alpha * dJ/dW, a negative derivative subtracts a negative, increasing W to move up towards the minimum on that side."},
         {"role": "assistant", "content": "Exactly right. You achieved 88% on your post-lecture knowledge check!"}
     ]), now),

    # 2. Nimali (94% - Mastered) - growth from 76%
    (2, 22, 9, 2, 94, "Mastered",
     json.dumps(["Loss Surface Gradient Vectors", "Sigmoid vs ReLU Saturation", "Vectorized Batch Learning in NumPy"]),
     json.dumps(["Edge-case Vanishing Gradients in 50+ Layers"]),
     "Exemplary grasp of gradient mechanics and activation dynamics.",
     json.dumps([
         {"role": "assistant", "content": "Welcome Nimali! What causes loss surface oscillations with high learning rates?"},
         {"role": "user", "content": "The gradient vector step size alpha*grad is larger than the curvature of the valley, causing the weight updates to bounce across opposite walls."},
         {"role": "assistant", "content": "Brilliant explanation! 94% awarded."}
     ]), now),

    # 3. Ravi (74% - Proficient) - significant growth from 48% baseline!
    (3, 22, 9, 3, 74, "Proficient",
     json.dumps(["Iterative Parameter Updates", "Perceptron Decision Boundary"]),
     json.dumps(["Convex vs Non-Convex Loss Surfaces", "Derivative of Sigmoid Function"]),
     "Noticeable improvement over pre-lecture baseline! Understands iterative updates clearly now.",
     json.dumps([
         {"role": "assistant", "content": "Welcome Ravi! How are weights updated during training now that you attended the lecture?"},
         {"role": "user", "content": "They update after each batch using gradient descent, not just once at the end. Each step nudges weights downhill."},
         {"role": "assistant", "content": "Great turnaround! That resolves your previous misconception."}
     ]), now),

    # 4. Dinesh (84% - Proficient) - growth from 62%
    (4, 22, 9, 4, 84, "Proficient",
     json.dumps(["Vanishing Gradient in Sigmoid (max derivative 0.25)", "Vectorized Batch Operations in NumPy"]),
     json.dumps(["Convexity of Cross-Entropy Loss"]),
     "Solid lecture retention. Grasped why Sigmoid saturates at 0.25 and causes vanishing gradients.",
     json.dumps([]), now),

    # 5. Amara (86% - Proficient)
    (5, 22, 9, 5, 86, "Proficient",
     json.dumps(["Binary Cross-Entropy Loss Formulation", "Single-Neuron Architecture", "Learning Rate Selection"]),
     json.dumps(["Momentum Optimization Dynamics"]),
     "Strong conceptual retention of Lecture 01 principles.",
     json.dumps([]), now),
]

cursor.executemany(
    "INSERT OR IGNORE INTO module_weekly_viva_evaluations "
    "(id, item_id, section_id, student_id, score, knowledge_level, mastered_topics, retained_gaps, feedback, transcript_json, completed_at) "
    "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    weekly_viva_evals,
)

# --- Module Exam Grades (Physical Written Exams: Mid 25% + End 35% = 60%, Presentation: 15%) ---
cursor.execute("""
CREATE TABLE IF NOT EXISTS module_exam_grades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    mid_exam_score REAL NOT NULL DEFAULT 0.0,
    end_exam_score REAL NOT NULL DEFAULT 0.0,
    presentation_score REAL,
    notes TEXT NOT NULL DEFAULT '',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(module_id) REFERENCES course_modules(id) ON DELETE CASCADE,
    FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT uq_module_student_exam UNIQUE (module_id, student_id)
)
""")

exam_grades = [
    # Kasun (Student 1): Mid 84.0, End 88.0, Presentation 90.0
    (1, 6, 1, 84.0, 88.0, 90.0, "Strong analytical reasoning in written answers and articulate presentation.", now),
    # Nimali (Student 2): Mid 92.0, End 95.0, Presentation 94.0
    (2, 6, 2, 92.0, 95.0, 94.0, "Top tier paper in both mid and final written exams.", now),
    # Ravi (Student 3): Mid 68.0, End 72.0, Presentation 76.0
    (3, 6, 3, 68.0, 72.0, 76.0, "Solid passing written performance; good presentation on perceptron history.", now),
    # Dinesh (Student 4): Mid 78.0, End 82.0, Presentation 82.0
    (4, 6, 4, 78.0, 82.0, 82.0, "Good mathematical derivations and structured code walkthrough.", now),
    # Amara (Student 5): Mid 85.0, End 87.0, Presentation 88.0
    (5, 6, 5, 85.0, 87.0, 88.0, "Consistent excellence across written questions and presentation.", now),
]

cursor.executemany(
    "INSERT OR IGNORE INTO module_exam_grades "
    "(id, module_id, student_id, mid_exam_score, end_exam_score, presentation_score, notes, updated_at) "
    "VALUES (?,?,?,?,?,?,?,?)",
    exam_grades,
)

# --- Ensure defense columns in module_assignment_submissions ---
try:
    cursor.execute("ALTER TABLE module_assignment_submissions ADD COLUMN defense_score INTEGER")
except Exception:
    pass
try:
    cursor.execute("ALTER TABLE module_assignment_submissions ADD COLUMN defense_feedback TEXT NOT NULL DEFAULT ''")
except Exception:
    pass
try:
    cursor.execute("ALTER TABLE module_assignment_submissions ADD COLUMN defense_transcript_json TEXT NOT NULL DEFAULT '[]'")
except Exception:
    pass
try:
    cursor.execute("ALTER TABLE module_assignment_submissions ADD COLUMN defense_completed_at DATETIME")
except Exception:
    pass

# --- Sample Submissions & AI Viva Defense for CS 4101 Lab 01 (Item 18) ---
cs4101_submissions = [
    # 1. Kasun: Grade 92, Defense Score 94
    (2, 18, 1,
     "Implemented vectorized NumPy single-neuron classifier. Used Binary Cross-Entropy loss with learning rate alpha=0.01. Evaluated on synthetic non-linear dataset.",
     "/uploads/modules/kasun_lab01_perceptron.py", "kasun_lab01_perceptron.py", "graded", 92,
     "Clean vectorized implementation with clear convergence plots.",
     94,
     "Candidate demonstrated deep comprehension of their gradient equations and convincingly defended learning rate stability.",
     json.dumps([
         {"role": "assistant", "content": "Kasun, looking at your forward_pass() implementation, why did you add the bias vector as a broadcasted row rather than inside the weight matrix?"},
         {"role": "user", "content": "Adding b as a 1x1 vector allows NumPy to automatically broadcast across all m sample rows without reshaping the input matrix X."},
         {"role": "assistant", "content": "Excellent justification! Defense score: 94%."}
     ]), now, now, now),

    # 2. Nimali: Grade 96, Defense Score 96
    (3, 18, 2,
     "NumPy logistic regression classifier with analytical gradient derivation and cost convergence logging. Achieved 98% accuracy on separable data.",
     "/uploads/modules/nimali_lab01.py", "nimali_lab01.py", "graded", 96,
     "Flawless code architecture and comprehensive unit tests.",
     96,
     "Student articulately explained the mathematical gradient update and proved convexity.",
     json.dumps([
         {"role": "assistant", "content": "Nimali, how did you verify that your gradient descent didn't get stuck in a saddle point?"},
         {"role": "user", "content": "Binary cross entropy with logistic sigmoid is strictly convex with a unique global minimum, so saddle points don't trap the optimizer here."},
         {"role": "assistant", "content": "Outstanding mathematical defense!"}
     ]), now, now, now),

    # 3. Ravi: Grade 78, Defense Score 80
    (4, 18, 3,
     "Submitted Lab 01 perceptron classifier. Tested with learning rate 0.05 on linearly separable clusters.",
     "/uploads/modules/ravi_lab01.py", "ravi_lab01.py", "graded", 78,
     "Good working code; consider adding vectorized loss tracking.",
     80,
     "Demonstrated genuine understanding of submitted code loops and weights.",
     json.dumps([]), now, now, now),

    # 4. Dinesh: Grade 85, Defense Score 85
    (5, 18, 4,
     "Completed Lab 01 using matrix vectorization in Python NumPy.",
     "/uploads/modules/dinesh_lab01.py", "dinesh_lab01.py", "graded", 85,
     "Well-structured implementation.",
     85,
     "Clear defense of array dimensions and learning rates.",
     json.dumps([]), now, now, now),

    # 5. Amara: Grade 88, Defense Score 90
    (6, 18, 5,
     "Lab 01 perceptron code with loss plotting and decision boundary visualization.",
     "/uploads/modules/amara_lab01.py", "amara_lab01.py", "graded", 88,
     "Great visualization plots.",
     90,
     "Successfully defended decision boundary projection.",
     json.dumps([]), now, now, now),
]

cursor.executemany(
    "INSERT OR REPLACE INTO module_assignment_submissions "
    "(id, item_id, student_id, submission_text, file_url, file_name, status, grade, feedback, defense_score, defense_feedback, defense_transcript_json, defense_completed_at, submitted_at, graded_at) "
    "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    cs4101_submissions,
)

# --- Sample Submission & Quiz Attempt for Kasun (Student 1) in NET 101 ---
cursor.execute(
    "INSERT OR IGNORE INTO module_quiz_attempts (id, item_id, student_id, score, total_questions, percentage, answers_json, completed_at) "
    "VALUES (?,?,?,?,?,?,?,?)",
    (1, 9, 1, 4, 5, 80, '{"1": 2, "2": 3, "3": 3, "4": 2, "5": 2}', now),
)

cursor.execute(
    "INSERT OR REPLACE INTO module_assignment_submissions (id, item_id, student_id, submission_text, file_url, file_name, status, grade, feedback, defense_score, defense_feedback, defense_transcript_json, submitted_at, graded_at) "
    "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    (1, 8, 1, "Completed Wireshark capture of example.com. Observed TCP 3-way handshake with SYN, SYN-ACK, and ACK flags properly established. DNS resolution took 14ms.",
     "/uploads/modules/kasun_wireshark_report.pdf", "kasun_wireshark_report.pdf", "graded", 92, "Excellent capture breakdown and analysis of the TCP sequence numbers.",
     90, "Student clearly described TCP sequence number negotiation.", "[]", now, now),
)

conn.commit()

# Print summary
for table in ["admins", "students", "lifecycle_evaluations", "subjects", "notes", "quiz_questions", "course_modules", "module_sections", "module_items", "module_enrollments", "module_diagnostic_evaluations", "module_weekly_viva_evaluations", "module_exam_grades", "module_assignment_submissions"]:
    try:
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        print(f"{table}: {cursor.fetchone()[0]} row(s)")
    except Exception as e:
        print(f"{table}: {e}")

conn.close()
print("Seed data inserted successfully.")

