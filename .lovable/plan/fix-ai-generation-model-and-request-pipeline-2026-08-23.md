# Fix AI generation model and request pipeline

## Changes
- Replace the custom gateway fetch with the supported Lovable AI SDK provider and current default model `google/gemini-3.7-flash`.
- Use the required `Lovable-API-Key` authentication header and stream long generations without artificial timeouts.
- Preserve bounded retry/backoff only for 429 and 5xx responses; stop immediately on terminal 400/401/402/403 responses.
- Keep model/provider details in server logs and retain the existing user-safe error message.
- Fix note input validation so long topic text is handled before the server call instead of producing a raw validation error.
- Update AI diagnostics to exercise the same production request path.

## Verification
- Run the relevant checks and invoke a real authenticated AI generation request.
- Confirm the response parses, saves, and navigates to the generated content without exposing technical errors.
