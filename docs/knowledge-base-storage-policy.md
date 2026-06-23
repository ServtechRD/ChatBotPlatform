# Knowledge Base Storage Policy

## Purpose

Knowledge base source files and vector indexes are private assets. Only the assistant owner may access them through authenticated APIs. Public embed sites may still load display assets (images and videos) without login.

## Directory Layout

| Path | Visibility | Served as static files |
|------|------------|------------------------|
| `backend/public/images/` | Public | Yes (`/public/`, `/images/`) |
| `backend/public/videos/` | Public | Yes (`/public/`, `/videos/`) |
| `backend/uploaded_files/assistant_{id}/` | Private | **No** |
| `backend/vector_stores/assistant_{id}/` | Private | **No** |

## Application Rules

- FastAPI mounts only `public/`, `images/`, and `videos/` in `backend/main.py`.
- `uploaded_files/` and `vector_stores/` are never mounted with `StaticFiles`.
- Knowledge APIs under `/assistant/{id}/knowledge*` require bearer token and owner authorization.

## Deployment Rules

### Nginx (`nginx/conf/default.conf`)

- Proxy `/public/` to the backend for embed assets.
- Do **not** add `location` blocks for `uploaded_files/` or `vector_stores/`.
- All knowledge access must go through `/api/` authenticated routes.

### Docker / reverse proxy

- Do not volume-mount `uploaded_files/` or `vector_stores/` into a public document root.
- Keep these directories on the application server filesystem only.

## Raw File Download

There is no public download URL for knowledge source files. If product requirements change, add a dedicated authenticated endpoint with owner checks instead of exposing files under `/public/`.

## Encryption (optional)

At-rest encryption of `uploaded_files/` is not enabled by default. Enable only when compliance requires it; alternatively, delete raw files after vectorization if retention is not needed.
