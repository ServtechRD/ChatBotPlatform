 # ChatBotPlatform Knowledge Base Access Control Todo

## Goal
- Protect knowledge base source files such as `.docx`, `.txt`, and `.pdf` so they are not directly accessible by unauthenticated or unauthorized users.
- Keep public assistant assets such as images and videos accessible to embedded external sites.
- Ensure FAISS/vector-store operations stay private and are only manageable by the assistant owner.

## Current Findings
- Knowledge base source files are stored under `./uploaded_files/assistant_{assistant_id}/` and are not mounted as public static files.
- Knowledge base APIs in `backend/routers/assistant.py` currently lack consistent authentication and owner authorization checks.
- Assistant asset files saved by `save_file()` are written to `./public/...` and are intentionally public.
- FAISS persistence is implemented in `backend/services/vector_service.py`, not in `save_file()`.

## Security Scope Decision
- Public assets:
  - `public/images`
  - `public/videos`
  - These remain anonymously accessible for embedded websites.
- Private assets:
  - `uploaded_files/assistant_*`
  - `vector_stores/assistant_*`
  - Knowledge base content APIs
  - These must require authentication and owner authorization.

## Todo

### 1. Add a shared assistant ownership guard [Done]
- Create a reusable helper/dependency to:
  - Validate bearer token
  - Resolve current user id
  - Load `AIAssistant` by `assistant_id`
  - Return `404` if assistant does not exist
  - Return `403` if `assistant.owner_id != current_user_id`
- Reuse this helper across assistant and knowledge-base APIs.

### 2. Protect knowledge base upload API [Done]
- Update `POST /assistant/{assistant_id}/upload`
- Add token authentication via `Depends(oauth2_scheme)`
- Enforce owner check before calling `process_and_store_file()`
- Confirm unauthenticated requests return `401`
- Confirm non-owner requests return `403`

### 3. Protect knowledge base listing API [Done]
- Update `GET /assistant/{assistant_id}/knowledge`
- Add token authentication
- Enforce owner check
- Prevent other users from enumerating file names, summaries, keywords, and token counts.

### 4. Protect knowledge base stats API [Done]
- Update `GET /assistant/{assistant_id}/knowledge/stats`
- Add token authentication
- Enforce owner check
- Prevent leaking vector-store size or document counts to unauthorized users.

### 5. Protect knowledge content read API [Done]
- Update `GET /assistant/{assistant_id}/knowledge/{knowledge_id}/content`
- Add token authentication
- Enforce owner check before calling `get_knowledge_content()`
- Confirm only the owner can read editable `.txt` content.

### 6. Protect knowledge update API [Done]
- Update `PUT /assistant/{assistant_id}/knowledge/{knowledge_id}`
- Add token authentication
- Enforce owner check before calling `update_knowledge_base_item()`
- Confirm only the owner can overwrite source files and rebuild vectors.

### 7. Protect knowledge delete API [Done]
- Update `DELETE /assistant/{assistant_id}/knowledge/{knowledge_id}`
- Add token authentication
- Enforce owner check before deleting:
  - FAISS vectors
  - source file in `uploaded_files`
  - DB record in `knowledge_base`

### 8. Restore owner checks on other assistant APIs [Done]
- Review and protect these endpoints as needed:
  - `GET /assistant/{assistant_id}`
  - `PUT /assistant/{assistant_id}`
  - `PUT /assistant/{assistant_id}/toggle_status`
  - `GET /user/{user_id}/assistants`
- Re-enable the commented owner validation in `update_assistant()`.
- Decide whether `GET /assistant/{assistant_id}` should be owner-only or public-by-product-design.

### 9. Keep knowledge files private by storage policy [Done]
- Do not mount `uploaded_files` as static files.
- Do not mount `vector_stores` as static files.
- Verify deployment config (e.g. nginx / reverse proxy) does not expose backend working directories.
- Document this as a non-public storage rule.
- See `docs/knowledge-base-storage-policy.md` and comments in `backend/main.py`.

### 10. Add a protected download API only if needed [Deferred]
- If raw knowledge files must be downloaded in the future:
  - Create a dedicated authenticated endpoint
  - Enforce owner check
  - Return file via `FileResponse`
- Do not expose raw files through `/public`.
- **Decision:** No download endpoint added; current product reads editable `.txt` content via API only.

### 11. Add per-assistant write locking for vector operations [Done]
- Introduce an application-level lock keyed by `assistant_id`
- Use it around:
  - `process_and_store_file()`
  - `update_knowledge_base_item()`
  - `delete_knowledge_base_item()`
- Goal:
  - Avoid concurrent writes corrupting FAISS index or metadata
  - Avoid race conditions between upload, update, and delete

### 12. Consider encryption only if stronger protection is required [Deferred]
- Optional hardening:
  - Encrypt raw knowledge files at rest
  - Store key in environment variables or KMS
- Alternative option:
  - Delete raw uploaded files after vectorization if product requirements allow it
- **Decision:** Not implemented; document in `docs/knowledge-base-storage-policy.md` for future compliance needs.

### 13. Add automated tests [Done]
- Add tests for:
  - unauthenticated knowledge API access returns `401`
  - non-owner knowledge API access returns `403`
  - owner upload/list/read/update/delete succeeds
  - public video/image assets remain anonymously accessible
  - knowledge files are not directly served as static files
- Run: `cd backend && python -m pytest tests/test_knowledge_access_control.py`

## Progress Notes
- Completed: items 1–11, 13, and step 9 documentation.
- Deferred by design: item 10 (protected download API) and item 12 (at-rest encryption).
- Fixed `get_owned_assistant` to compare `owner_id` with `int(user_id)` so JWT `sub` string matches correctly.

## Suggested Implementation Order
1. Add shared ownership guard
2. Protect all knowledge APIs
3. Restore assistant owner checks
4. Add vector-operation locking
5. Add protected download flow if needed
6. Evaluate encryption or source-file retention policy
7. Add automated tests

## Expected Result
- Embedded public websites can still access assistant display assets.
- Knowledge base training materials remain private.
- Only the assistant owner can upload, read, modify, or delete knowledge source files and vectors.
- FAISS storage is operationally safer against concurrent modification.

