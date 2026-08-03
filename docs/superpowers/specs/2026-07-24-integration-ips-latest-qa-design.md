# Integration IPs Latest QA API

## Goal

Provide `GET /integration/ips/latest-qa` for external systems to fetch the latest Q&A per client IP for the shared **guest** assistant used by unauthenticated visitors.

## Auth

- Requires `X-API-Key` (same as other `/integration/*` endpoints).

## Guest assistant resolution

- `assistants.name` equals `guest` (case-insensitive).
- Owner `Users.email` equals `admin@servtech.com.tw` (exact).
- If none match → `404` with detail `Guest assistant not found`.
- If multiple match → use the row with the smallest `assistant_id`.

## Semantics

- Scope: conversations of that guest assistant only.
- Group by `conversations.client_ip`.
- Per IP: take the conversation with the largest `conversation_id`, then the newest two messages (same ordering as `assistants/latest-qa`), and map them into question/answer via existing sender rules.
- Exclude IPs that are empty or `"---"`.
- IPs with no usable conversation do not appear in the response.

## Response shape

Same item shape as `GET /integration/assistants/latest-qa`, keyed by IP:

```json
{
  "203.0.113.10": {
    "name": "guest",
    "question": "...",
    "answer": "...",
    "question_at": "...",
    "answer_at": "..."
  }
}
```

- `name` is the assistant's actual name.
- Timestamps are Taipei-formatted strings (reuse existing helper).

## Out of scope

- Adding `client_ip` to `assistants/latest-qa` or `conversation/.../messages` (separate change).
