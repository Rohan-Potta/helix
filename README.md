# Helix

A small Projects + Tasks management app (FastAPI + React), built as the MVP CRUD slice of the Helix roadmap.

See [`docs/architecture.md`](docs/architecture.md) for how the code is organized and what the API/data schemas look like.

## Setup (local dev — hot reload)

### Prerequisites

- Docker Desktop (running)
- Python 3.11+
- Node 24 LTS

### 1. Database

```bash
docker compose up -d db
```

Postgres data is stored in a Docker-managed named volume (`helix_pgdata`), not a bind-mounted folder — see "Where is the data stored?" below for why.

### 2. Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

If activation is blocked by your PowerShell execution policy, call the venv's executables directly instead of activating: `.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000`, etc.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

### Useful URLs

- App: http://localhost:5173
- API docs (Swagger UI): http://localhost:8000/docs

### Resetting the database

```bash
docker compose down -v
```

This deletes the `helix_pgdata` volume and all data in it.

---

## Setup (Docker Compose — everything containerized)

For running the whole stack (Postgres + backend + frontend) without installing Python/Node locally:

```bash
docker compose up -d --build
```

- App: http://localhost:5173 (nginx serving the built frontend, proxying `/api/*` to the backend container)
- API: http://localhost:8000
- The backend image runs `alembic upgrade head` automatically before starting uvicorn, so migrations are applied on every container start.

Rebuild after changing backend/frontend source:

```bash
docker compose build backend frontend
docker compose up -d
```

### Where is the data stored?

Postgres's data directory is a **Docker named volume** (`helix_pgdata`), not a bind-mounted folder on your machine. This is deliberate: an earlier version of this setup bind-mounted Postgres's data directory to a plain Windows folder (`./pgdata`), and testing surfaced real data loss after a container was stopped and recreated. Docker Desktop on Windows shares host paths into its Linux VM through a translation layer that doesn't guarantee the same `fsync`/write-durability semantics as a native Linux filesystem — and Postgres's crash-safety depends on that guarantee. A named volume avoids this because it's storage Docker manages entirely inside its own Linux VM, so Postgres is always writing to a real native filesystem.

Practically, this means the raw files aren't browsable in Windows Explorer. To look at or back up the data:

```bash
# inspect where Docker tracks the volume (lives inside the Docker VM disk image, not a Windows path)
docker volume inspect helix_helix_pgdata

# browse the actual files from inside the running container
docker exec helix-db ls /var/lib/postgresql/data

# take a backup you CAN see as a normal file in this folder
docker exec helix-db pg_dump -U helix helix > backup.sql

# restore from that backup into a running db container
docker exec -i helix-db psql -U helix -d helix < backup.sql
```
