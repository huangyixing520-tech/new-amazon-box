# Mercato image task backend

This small persistent service turns DOLA's synchronous image endpoint into an
asynchronous task API.

Required environment variables:

- `TASK_BACKEND_TOKEN`
- `USER_KEY_ENCRYPTION_SECRET` (at least 32 random characters)

Optional environment variables:

- `DOLA_BASE_URL` (defaults to `https://api.dolaio.cn/aigateway/cisco/v1`)
- `DOLA_API_KEY` (fallback only for legacy or internal tasks)
- `IMAGE_MODEL` (defaults to OpenAI channel `gpt-image-2`)
- Each image task may also provide its own validated `model`; `IMAGE_MODEL` remains the backward-compatible fallback.
- `IMAGE_RETRY_DELAYS_MS` (defaults to 18 retries, one every 10 seconds; capped at 18 entries)
- `TASK_CONCURRENCY` (defaults to `2`)
- `DATA_DIR` (defaults to `./data`; use `/data` with a Railway volume)

Deploy the `task-backend` directory as a single Railway service, attach a
persistent volume at `/data`, then set `DATA_DIR=/data`.
