# Integration IP Conversations API

## Endpoint

`GET /integration/ips/conversations?ip={client_ip}`

- Auth: `X-API-Key` required
- `ip` query param required (min length 1); supports IPv4/IPv6 without path encoding issues

## Scope

- Resolve guest assistant: `lower(name) == "guest"` and owner email `admin@servtech.com.tw` (same as `ips/latest-qa`)
- Guest missing → `404 Guest assistant not found`
- Filter conversations: `assistant_id == guest` and `client_ip == ip`
- Only conversations that have at least one message (same as `/user/{assistant_id}/conversations`)
- Eager-load messages; order conversations by `conversation_id` ascending (stable)

## Response

`List[Conversation]` — same schema as `/user/{assistant_id}/conversations` (includes nested `messages`). Empty list when no matches.
