# Mercato image task backend

This small persistent service turns DOLA's synchronous image endpoint into an
asynchronous task API.

Required environment variables:

- `DOLA_API_KEY`
- `TASK_BACKEND_TOKEN`

Optional environment variables:

- `DOLA_BASE_URL` (defaults to `https://api.dolaio.cn/aigateway/cisco/v1`)
- `IMAGE_MODEL` (defaults to `yunwu/gpt-image-2`)
- `TASK_CONCURRENCY` (defaults to `2`)
- `DATA_DIR` (defaults to `./data`; use `/data` with a Railway volume)

Deploy the `task-backend` directory as a single Railway service, attach a
persistent volume at `/data`, then set `DATA_DIR=/data`.
