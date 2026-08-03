# Integration IPs Latest QA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `GET /integration/ips/latest-qa` returning latest guest-assistant Q&A keyed by client IP.

**Architecture:** Extend `routers/integration.py` using the same message-picking helpers as `assistants/latest-qa`; resolve guest assistant by case-insensitive name `guest` + owner email `admin@servtech.com.tw`.

**Tech Stack:** FastAPI, SQLAlchemy, pytest, existing `IntegrationLatestQaItem` schema.

## Global Constraints

- Auth: `X-API-Key` via `require_integration_api_key`
- Guest filter: `lower(name) == "guest"` and `Users.email == "admin@servtech.com.tw"`
- Exclude `client_ip` in `{"", "---"}`

---

### Task 1: Failing tests for `/integration/ips/latest-qa`

**Files:**
- Modify: `backend/tests/test_integration_api_key.py`

- [x] Write tests: requires API key; 404 when guest missing; groups by IP; picks newest conversation per IP; ignores `---`; ignores non-guest assistants / wrong owner email
- [x] Run tests and confirm they fail (route missing / 404)

### Task 2: Implement endpoint

**Files:**
- Modify: `backend/routers/integration.py`

- [x] Add `GET /integration/ips/latest-qa`
- [x] Reuse `_pick_latest_qa`
- [x] Run tests and confirm green
