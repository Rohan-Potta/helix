# Helix — Code Structure & Schemas

This document explains how the codebase is organized and what the data/API shapes look like. For the original build plan and checkpoints, see [`mvp-crud-plan.md`](mvp-crud-plan.md).

---

## 1. Repo layout

```
helix/
├── docker-compose.yml       # db + backend + frontend services (see README's "Docker Compose" section)
├── backend/                 # FastAPI service
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py           # wires Alembic to app.config / app.db / app.models
│   │   └── versions/        # one file per migration
│   └── app/
│       ├── main.py          # FastAPI app instance + router registration
│       ├── config.py        # Settings (env/`.env` driven)
│       ├── db.py             # SQLAlchemy engine, session, Base, get_db()
│       ├── models.py         # ORM models: Project, Task, TaskStatus, TaskPriority
│       ├── schemas.py        # Pydantic request/response models
│       └── routers/
│           ├── projects.py   # /api/projects...
│           └── tasks.py      # /api/projects/{id}/tasks..., /api/tasks/{id}...
└── frontend/                 # React + Vite SPA
    ├── Dockerfile
    ├── nginx.conf             # serves the built SPA + proxies /api/* in the container
    ├── vite.config.ts         # dev-time /api proxy to the backend
    └── src/
        ├── main.tsx           # router + app mount
        ├── App.tsx            # header, health badge, route table
        ├── index.css          # all styling (plain CSS, no framework)
        ├── types.ts           # TS types mirroring the backend schemas
        ├── api/client.ts      # fetch wrapper + one function per endpoint
        ├── pages/
        │   ├── ProjectsPage.tsx        # "/" — list/create/edit/delete projects
        │   └── ProjectDetailPage.tsx   # "/projects/:projectId" — task board
        └── components/
            ├── ProjectForm.tsx   # create/edit form, shared by both modes
            ├── TaskForm.tsx      # create/edit form, shared by both modes
            ├── TaskList.tsx      # groups tasks into To do / In progress / Done
            └── ConfirmDialog.tsx # in-app replacement for window.confirm()
```

**Why it's split this way:** routers hold HTTP concerns only (status codes, 404s, query params); `models.py` and `schemas.py` are the single source of truth for shape — everything else (frontend `types.ts`, docs tables below) is kept in sync with those two files by hand, since there's no schema generation step in this MVP.

---

## 2. Backend request flow

```
HTTP request
  → FastAPI router (app/routers/*.py)
      → Depends(get_db) hands it a SQLAlchemy Session (app/db.py)
      → Pydantic validates the body against a *Create/*Update schema (app/schemas.py)
      → router does db.get(...) / select(...) against models.Project / models.Task
      → response is serialized through a *Read schema (from_attributes=True)
```

There is no service/repository layer — for two tables and five-ish endpoints each, the router functions talk to SQLAlchemy directly. Add a layer if/when a third resource needs the same lookup logic more than twice.

---

## 3. Data model (`app/models.py`)

### Enums

Stored as `VARCHAR`, not native Postgres enums (`native_enum=False`) so Alembic migrations stay simple.

| Enum | Values |
|---|---|
| `TaskStatus` | `todo`, `in_progress`, `done` |
| `TaskPriority` | `low`, `medium`, `high` |

### `projects` table

| Column | Type | Notes |
|---|---|---|
| `id` | `Integer` PK | autoincrement |
| `name` | `String(200)` | not null |
| `description` | `Text` | nullable |
| `created_at` | `DateTime(timezone=True)` | server default `now()` |
| `updated_at` | `DateTime(timezone=True)` | server default `now()`, updated `onupdate` |

Relationship: `project.tasks` — `cascade="all, delete-orphan"`, `passive_deletes=True`. Deleting a project deletes its tasks at the DB level (`ON DELETE CASCADE`).

### `tasks` table

| Column | Type | Notes |
|---|---|---|
| `id` | `Integer` PK | autoincrement |
| `project_id` | `Integer` FK → `projects.id` | not null, indexed, `ON DELETE CASCADE` |
| `title` | `String(200)` | not null |
| `description` | `Text` | nullable |
| `status` | `TaskStatus` | not null, default `todo` |
| `priority` | `TaskPriority` | not null, default `medium` |
| `due_date` | `Date` | nullable |
| `created_at` / `updated_at` | `DateTime(timezone=True)` | same pattern as `projects` |

---

## 4. API schemas (`app/schemas.py`) & contract

All routes are prefixed with `/api` and speak JSON.

| Schema | Fields |
|---|---|
| `ProjectCreate` | `name: str` (1–200 chars, whitespace stripped), `description: str \| None` (≤2000) |
| `ProjectUpdate` | same fields, all optional |
| `ProjectRead` | `id, name, description, created_at, updated_at` |
| `TaskCreate` | `title: str` (1–200), `description: str \| None` (≤2000), `status` (default `todo`), `priority` (default `medium`), `due_date: date \| None` |
| `TaskUpdate` | same fields, all optional (no `project_id` — tasks don't move between projects) |
| `TaskRead` | `id, project_id, title, description, status, priority, due_date, created_at, updated_at` |

PATCH endpoints apply only the fields the client actually sent (`model_dump(exclude_unset=True)`), so `{"due_date": null}` clears a date but an omitted `due_date` leaves it untouched.

### Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | liveness check used by the frontend's header badge |
| GET | `/api/projects` | newest first |
| POST | `/api/projects` | 201, 422 on bad input |
| GET | `/api/projects/{id}` | 404 if missing |
| PATCH | `/api/projects/{id}` | partial update |
| DELETE | `/api/projects/{id}` | 204; cascades to tasks |
| GET | `/api/projects/{id}/tasks` | query: `status?`, `priority?`; oldest first; 404 if project missing |
| POST | `/api/projects/{id}/tasks` | 404 if project missing |
| GET / PATCH / DELETE | `/api/tasks/{id}` | task-scoped, independent of project id |

`app/routers/tasks.py` exposes two `APIRouter`s (`project_tasks_router` for the `/api/projects/{id}/tasks` paths, `tasks_router` for the standalone `/api/tasks/{id}` paths) so the URL shapes in the table above can both exist without path-prefix gymnastics; both are registered in `main.py`.

---

## 5. Frontend structure

- **`api/client.ts`** is the only place that calls `fetch`. Every other file goes through its exported functions (`listProjects`, `createTask`, etc.), so the request/error-handling shape (throwing a readable `Error` on non-2xx, returning `undefined` on 204) lives in one spot.
- **`types.ts`** mirrors `schemas.py` by hand — if you add/rename a backend field, update this file too.
- **Pages own data fetching and mutation state**; components (`ProjectForm`, `TaskForm`, `TaskList`, `ConfirmDialog`) are presentational and receive callbacks as props. Neither `ProjectForm` nor `TaskForm` knows whether it's being used to create or edit — that's decided by whether the caller passes `initial`.
- **No client-side router guards or global state** — each page fetches what it needs in a `useEffect` and keeps it in local `useState`. There's no Redux/TanStack Query per the project's "don't add tech you don't need yet" rule.

---

## 6. Running it

See [`README.md`](../README.md) for the day-to-day (non-Docker) setup with `uvicorn --reload` and `npm run dev`, and its "Docker Compose" section for the fully containerized alternative (Postgres + backend + frontend).
