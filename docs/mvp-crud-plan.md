# Helix — MVP CRUD Implementation Plan

> **Audience:** an AI coding agent (e.g. Claude Sonnet) implementing this plan step by step.
> **Scope:** Weeks 1–2 of the Helix roadmap (`Helix_FDE_Timeline_and_Execution_Plan.pdf`) — Projects + Tasks CRUD, visible and usable in the browser. Nothing else.

---

## 0. Ground rules for the implementer

1. Follow the steps **in order**. Each step ends with a **Checkpoint** — verify it actually passes before moving on. If it fails, investigate and fix before continuing.
2. **Do not add technology not listed here** (no Tailwind, TanStack Query, Redux, axios, UI kits, ORMs other than SQLAlchemy). Helix's rule: add tech only when the project has a problem that needs it.
3. **Out of scope — do not build:** authentication/users/assignment, automated tests, Dockerfiles for backend/frontend, CI/CD, deployment. These are later roadmap weeks.
4. **Do not commit** unless the user asks. Do not change system settings (execution policy, PATH, global installs) — ask the user to do it.
5. Long-running processes (uvicorn, Vite dev server) must be started in the background so they don't block your shell.
6. Keep code simple and readable — this is a learning project. Prefer clarity over cleverness.

---

## 1. Environment (already verified on the user's machine)

| Tool | Version | Notes |
|---|---|---|
| OS / shell | Windows 11, PowerShell 5.1 | Use PowerShell syntax, backslash paths are fine. |
| Python | **3.11.5 from Anaconda (conda `base`)** | ⚠️ See Python warning below. |
| Node / npm | **Node 24.21.0 / npm 11.19.0** | Managed by nvm-windows. Verify with `node -v`. |
| Docker | 26.1.4 | Docker Desktop must be running. PostgreSQL runs **only** in Docker. |
| PostgreSQL | not installed locally | Intentionally — use the Docker container. |

### ⚠️ Python warning — read before touching the backend

- The user's terminal has conda `base` activated, where `python` → **Python 3.11.5**.
- **Your (the agent's) shell probably does NOT activate conda.** In a non-conda shell, `python` resolves to `C:\cygwin64\bin\python` (**Cygwin Python 3.8 — do NOT use it**; packages like `pydantic-core` and `psycopg[binary]` won't install there).
- Before creating the venv, find the conda Python executable:
  - Run `python --version` — if it prints `Python 3.11.x`, fine.
  - Otherwise check common paths: `$env:USERPROFILE\anaconda3\python.exe`, `$env:USERPROFILE\miniconda3\python.exe`, `C:\ProgramData\anaconda3\python.exe`.
  - If not found, **ask the user** to run `(Get-Command python).Source` in their `(base)` terminal and give you the path.

### The backend MUST use a project-local virtual environment

The FastAPI backend gets its own **venv at `backend\.venv`**, created from the conda Python 3.11. Never install packages into conda `base`.

```powershell
cd backend
<conda-python-path> -m venv .venv          # or: python -m venv .venv  (if python is 3.11)
.venv\Scripts\python.exe --version         # must print Python 3.11.x
```

**Tip for agents:** you don't need to "activate" the venv. Call its executables directly — this avoids PowerShell execution-policy issues:

- `.venv\Scripts\python.exe -m pip install ...`
- `.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000`
- `.venv\Scripts\python.exe -m alembic ...`

(For the human user, the equivalent is `.venv\Scripts\activate` then plain `python`/`uvicorn`/`alembic`. If activation is blocked by execution policy, tell the user — don't change the policy yourself.)

---

## 2. Target architecture

```
Browser (React, Vite dev server :5173)
   │  fetch("/api/...")
   ▼
Vite dev proxy  ──/api──►  FastAPI (uvicorn :8000)  ──SQLAlchemy/psycopg──►  PostgreSQL 17 (Docker :5432)
```

- The Vite proxy forwards `/api/*` to `http://localhost:8000`, so the browser sees one origin → **no CORS config needed**.
- All API routes live under the `/api` prefix.

### Final repo layout

```
helix/
├── .gitignore
├── README.md
├── docker-compose.yml           # only the "db" service for now
├── docs/
│   └── mvp-crud-plan.md         # this file
├── backend/
│   ├── .venv/                   # git-ignored
│   ├── .env                     # git-ignored
│   ├── .env.example
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   └── app/
│       ├── __init__.py
│       ├── main.py              # FastAPI app, router registration, /api/health
│       ├── config.py            # pydantic-settings Settings
│       ├── db.py                # engine, SessionLocal, Base, get_db
│       ├── models.py            # Project, Task + enums
│       ├── schemas.py           # Pydantic request/response models
│       └── routers/
│           ├── __init__.py
│           ├── projects.py
│           └── tasks.py
└── frontend/
    ├── package.json
    ├── vite.config.ts           # /api proxy
    └── src/
        ├── main.tsx             # router setup
        ├── App.tsx              # layout + routes
        ├── index.css            # all styling (plain CSS)
        ├── types.ts
        ├── api/client.ts
        ├── pages/
        │   ├── ProjectsPage.tsx
        │   └── ProjectDetailPage.tsx
        └── components/
            ├── ProjectForm.tsx
            ├── TaskForm.tsx
            └── TaskList.tsx
```

---

## 3. Data model

### Enums (Python `StrEnum`, mirrored as TS union types)

- `TaskStatus`: `todo`, `in_progress`, `done`
- `TaskPriority`: `low`, `medium`, `high`

Store enums as **VARCHAR, not native Postgres enums** (native enums make Alembic migrations painful):
`sqlalchemy.Enum(TaskStatus, native_enum=False, length=20, values_callable=lambda e: [m.value for m in e])`

### `projects` table

| Column | Type | Rules |
|---|---|---|
| `id` | Integer PK | autoincrement |
| `name` | String(200) | NOT NULL |
| `description` | Text | nullable |
| `created_at` | DateTime(timezone=True) | `server_default=func.now()` |
| `updated_at` | DateTime(timezone=True) | `server_default=func.now()`, `onupdate=func.now()` |

Relationship: `tasks = relationship(back_populates="project", cascade="all, delete-orphan", passive_deletes=True)`

### `tasks` table

| Column | Type | Rules |
|---|---|---|
| `id` | Integer PK | autoincrement |
| `project_id` | Integer FK → `projects.id` | NOT NULL, `ondelete="CASCADE"`, indexed |
| `title` | String(200) | NOT NULL |
| `description` | Text | nullable |
| `status` | Enum(TaskStatus) | NOT NULL, default `todo` |
| `priority` | Enum(TaskPriority) | NOT NULL, default `medium` |
| `due_date` | Date | nullable |
| `created_at` | DateTime(timezone=True) | `server_default=func.now()` |
| `updated_at` | DateTime(timezone=True) | `server_default=func.now()`, `onupdate=func.now()` |

Use SQLAlchemy 2.0 typed style (`DeclarativeBase`, `Mapped[...]`, `mapped_column(...)`).

---

## 4. API contract

All routes prefixed with `/api`. JSON in/out.

### Schemas (`app/schemas.py`, Pydantic v2)

| Schema | Fields |
|---|---|
| `ProjectCreate` | `name: str` (1–200 chars, strip whitespace), `description: str \| None` (≤ 2000) |
| `ProjectUpdate` | all fields optional |
| `ProjectRead` | `id, name, description, created_at, updated_at` — `model_config = ConfigDict(from_attributes=True)` |
| `TaskCreate` | `title: str` (1–200), `description: str \| None` (≤ 2000), `status = todo`, `priority = medium`, `due_date: date \| None` |
| `TaskUpdate` | all fields optional (no `project_id` — tasks don't move between projects in MVP) |
| `TaskRead` | `id, project_id, title, description, status, priority, due_date, created_at, updated_at` |

PATCH handlers apply only provided fields: `data.model_dump(exclude_unset=True)`.

### Endpoints

| Method | Path | Request | Success | Errors |
|---|---|---|---|---|
| GET | `/api/health` | — | `200 {"status": "ok"}` | — |
| GET | `/api/projects` | — | `200 ProjectRead[]` (newest first) | — |
| POST | `/api/projects` | `ProjectCreate` | `201 ProjectRead` | 422 |
| GET | `/api/projects/{project_id}` | — | `200 ProjectRead` | 404 |
| PATCH | `/api/projects/{project_id}` | `ProjectUpdate` | `200 ProjectRead` | 404, 422 |
| DELETE | `/api/projects/{project_id}` | — | `204` (also deletes its tasks) | 404 |
| GET | `/api/projects/{project_id}/tasks` | query: `status?`, `priority?` | `200 TaskRead[]` (oldest first) | 404 (project), 422 (bad enum) |
| POST | `/api/projects/{project_id}/tasks` | `TaskCreate` | `201 TaskRead` | 404, 422 |
| GET | `/api/tasks/{task_id}` | — | `200 TaskRead` | 404 |
| PATCH | `/api/tasks/{task_id}` | `TaskUpdate` | `200 TaskRead` | 404, 422 |
| DELETE | `/api/tasks/{task_id}` | — | `204` | 404 |

404 responses: `HTTPException(status_code=404, detail="Project not found")` / `"Task not found"`.

---

## 5. Implementation steps

### Step 1 — Repo basics

Create at repo root:

- `.gitignore`: `node_modules/`, `dist/`, `.venv/`, `__pycache__/`, `*.pyc`, `.env`, `.vscode/`, `.idea/`
- `README.md`: project name + one-paragraph description + placeholder "Setup" section (filled in Step 10).

**Checkpoint:** `git status` shows `.gitignore`, `README.md`, `docs/` — nothing else unexpected.

---

### Step 2 — PostgreSQL in Docker

`docker-compose.yml` at repo root:

```yaml
services:
  db:
    image: postgres:17
    container_name: helix-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: helix
      POSTGRES_PASSWORD: helix      # local dev only
      POSTGRES_DB: helix
    ports:
      - "5432:5432"
    volumes:
      - helix_pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U helix -d helix"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  helix_pgdata:
```

Run: `docker compose up -d db`

**Checkpoint:**
- `docker compose ps` shows `helix-db` as `healthy`.
- `docker exec helix-db psql -U helix -d helix -c "select version();"` prints PostgreSQL 17.
- If port 5432 is already taken, stop and tell the user.

---

### Step 3 — Backend skeleton + venv

1. Create `backend/` and the venv **(see Section 1 — use conda Python 3.11, never Cygwin)**:
   `cd backend` → `<conda-python> -m venv .venv` → confirm `.venv\Scripts\python.exe --version` is 3.11.x.
2. Upgrade pip: `.venv\Scripts\python.exe -m pip install --upgrade pip`
3. Install: `.venv\Scripts\python.exe -m pip install fastapi "uvicorn[standard]" "sqlalchemy>=2.0" alembic "psycopg[binary]" pydantic-settings`
4. Write `requirements.txt` with the **top-level packages pinned to the versions just installed** (`==x.y.z`; read versions from `pip list`). Don't dump the full `pip freeze`.
5. `backend/.env.example` and `backend/.env` (same content):
   ```
   DATABASE_URL=postgresql+psycopg://helix:helix@localhost:5432/helix
   ```
6. `app/config.py`: `Settings(BaseSettings)` with `database_url: str` (default = the URL above), `model_config = SettingsConfigDict(env_file=".env")`. Export a `settings` instance.
7. `app/db.py`: `engine = create_engine(settings.database_url)`, `SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)`, `class Base(DeclarativeBase)`, and a `get_db()` generator dependency that yields a session and closes it.
8. `app/main.py`: `app = FastAPI(title="Helix API")`, `GET /api/health` → `{"status": "ok"}`.
9. Start in background (from `backend/`): `.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000`

**Checkpoint:**
- `Invoke-RestMethod http://localhost:8000/api/health` → `status: ok`
- `http://localhost:8000/docs` loads Swagger UI.

---

### Step 4 — Models + first migration

1. Write `app/models.py` per Section 3.
2. `.venv\Scripts\python.exe -m alembic init alembic`
3. Edit `alembic/env.py`:
   - `from app.config import settings`, `from app.db import Base`, `from app import models  # noqa: F401` (registers tables)
   - `config.set_main_option("sqlalchemy.url", settings.database_url)`
   - `target_metadata = Base.metadata`
   - Ensure `backend/` is on `sys.path` (alembic.ini `prepend_sys_path = .` does this by default).
4. `.venv\Scripts\python.exe -m alembic revision --autogenerate -m "create projects and tasks"`
5. **Open and review the generated migration** — confirm both tables, the FK with `ondelete="CASCADE"`, the index on `tasks.project_id`, and VARCHAR (not native enum) for status/priority.
6. `.venv\Scripts\python.exe -m alembic upgrade head`

**Checkpoint:** `docker exec helix-db psql -U helix -d helix -c "\dt"` lists `projects`, `tasks`, `alembic_version`. `\d tasks` shows the FK with `ON DELETE CASCADE`.

---

### Step 5 — Projects CRUD

1. `app/schemas.py` — project schemas (Section 4).
2. `app/routers/projects.py` — `APIRouter(prefix="/projects", tags=["projects"])`, all 5 project endpoints. Use `db: Session = Depends(get_db)`, `db.get(Project, id)` for lookups, `select(Project).order_by(Project.created_at.desc())` for list. On create/update: `db.commit()` then `db.refresh(obj)`.
3. Register in `main.py`: `app.include_router(projects.router, prefix="/api")`.

**Checkpoint (via PowerShell or /docs):**
- POST a project → 201 with `id`, timestamps.
- GET list → contains it. GET by id → 200. GET `/api/projects/9999` → 404.
- PATCH `{"name": "Renamed"}` → name changed, description untouched, `updated_at` changed.
- POST `{"name": ""}` → 422.
- DELETE → 204, then GET → 404.

---

### Step 6 — Tasks CRUD

1. Add task schemas to `app/schemas.py`.
2. `app/routers/tasks.py` — two routers or explicit paths are both fine; final URLs must match Section 4 exactly.
   - List: 404 if project missing; optional `status: TaskStatus | None = None`, `priority: TaskPriority | None = None` query params; order by `created_at` ascending.
   - Create: 404 if project missing; set `project_id` from the path.
3. Register in `main.py`.

**Checkpoint:**
- Create a project, add 3 tasks with different status/priority.
- `?status=done` and `?priority=high` filter correctly; `?status=banana` → 422.
- PATCH `{"status": "done"}` on a task works; `updated_at` changes.
- PATCH `{"due_date": null}` clears the due date.
- DELETE the project → its tasks are gone (`GET /api/tasks/{id}` → 404).

---

### Step 7 — Frontend skeleton

1. From repo root: `npm create vite@latest frontend -- --template react-ts`
   - If the CLI asks interactive questions (e.g. experimental bundler, "install and start now?"), choose the **default / No** — do not let it start a blocking dev server.
2. `cd frontend` → `npm install` → `npm install react-router` (v7; import from `"react-router"`).
3. `vite.config.ts` — add:
   ```ts
   server: {
     proxy: { "/api": "http://localhost:8000" },
   },
   ```
4. Delete the Vite demo content (counter, logos, `App.css`) and replace `index.css` with a minimal clean base style.
5. `src/types.ts` — `TaskStatus`, `TaskPriority` union types; `Project`, `Task`, `ProjectInput`, `TaskInput` interfaces matching Section 4.
6. `src/api/client.ts`:
   - A generic `request<T>(path, options)` helper: sets `Content-Type: application/json`, throws an `Error` with a readable message on non-2xx (use FastAPI's `detail` — it may be a string or a 422 array; join messages), returns `undefined` for 204.
   - Functions: `listProjects`, `getProject`, `createProject`, `updateProject`, `deleteProject`, `listTasks(projectId, filters)`, `createTask`, `updateTask`, `deleteTask`, `getHealth`.
7. `App.tsx` — header "Helix" + routes: `/` → `ProjectsPage`, `/projects/:projectId` → `ProjectDetailPage`. Show API health status (small badge) in the header using `getHealth`.
8. Start dev server in background: `npm run dev` (port 5173).

**Checkpoint:** `http://localhost:5173` loads, header shows API "ok". Stop uvicorn → badge shows an error state. Restart uvicorn.

---

### Step 8 — Projects page (`/`)

- On load: fetch and list projects (name, description, created date). Each links to `/projects/:id`.
- "New project" form (`ProjectForm`: name required, description optional) → creates and adds to the list.
- Per project: **Edit** (inline `ProjectForm` prefilled; Save/Cancel) and **Delete** (`window.confirm` warning that tasks are deleted too).
- Show loading state, empty state ("No projects yet"), and error messages from the API.
- Disable submit buttons while a request is in flight; no double submits.

**Checkpoint:** Create, rename, and delete a project entirely from the browser. Refresh the page — state matches the database.

---

### Step 9 — Project detail page (`/projects/:projectId`)

- Header: project name + description, "← Back to projects" link. If project 404s, show "Project not found" with a back link.
- "Add task" form (`TaskForm`): title (required), description, priority select, status select, due date (`<input type="date">`; send `null` when empty).
- Filters: status select and priority select (each with "All"). Changing a filter refetches with query params.
- `TaskList`: tasks grouped into three columns/sections — **To do**, **In progress**, **Done** — each with a count.
- Each task shows title, priority badge, due date (highlight if overdue and not done), description.
- Per task: a **status dropdown** (PATCH immediately), **Edit** (inline `TaskForm` prefilled), **Delete** (`window.confirm`).
- Same loading/empty/error/disabled-button rules as Step 8.

**Checkpoint:** Add tasks, move one through todo → in progress → done via the dropdown, edit a title, set and clear a due date, filter by priority, delete a task. Refresh — everything persists.

---

### Step 10 — End-to-end verification + README

1. Full run-through of the Definition of Done (Section 6).
2. Persistence test: stop uvicorn and restart it; run `docker compose restart db`; reload the browser — all data still there.
3. Fill in `README.md` "Setup" for a fresh machine:
   - Prereqs: Docker Desktop, Python 3.11+, Node 24 LTS.
   - `docker compose up -d db`
   - Backend: `cd backend`, `python -m venv .venv`, `.venv\Scripts\activate`, `pip install -r requirements.txt`, copy `.env.example` → `.env`, `alembic upgrade head`, `uvicorn app.main:app --reload --port 8000`
   - Frontend: `cd frontend`, `npm install`, `npm run dev`, open `http://localhost:5173`
   - Useful URLs: app `:5173`, API docs `:8000/docs`.
   - Resetting the DB: `docker compose down -v` (deletes all data).
4. Report back to the user: what was built, how to run it, and anything that deviated from this plan and why.

---

## 6. Definition of Done

From the browser at `http://localhost:5173`, a user can:

- [ ] Create, view, rename/edit, and delete projects
- [ ] Open a project and create tasks with title, description, status, priority, due date
- [ ] Change a task's status, edit any field, and delete it
- [ ] Filter tasks by status and priority
- [ ] See clear error messages when the API rejects input or is down
- [ ] Deleting a project deletes its tasks
- [ ] All data survives restarting the backend and the database container
- [ ] `README.md` lets someone set it up from scratch

## 7. Explicitly NOT in this phase

| Feature | Roadmap week |
|---|---|
| Users, login, JWT, task assignment, permissions | Week 3 |
| pytest / frontend tests, linting | Week 4 |
| Dockerfiles for backend & frontend, full `docker compose up` | Week 5 |
| CI/CD | Week 6 |
| Cloud, Kubernetes, observability, AI agents | Week 7+ |
