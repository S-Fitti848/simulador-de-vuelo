# Flight Simulator MVP

## Local dev

Server: `cd server && npm install && npm run dev`

Client: `cd client && npm install && npm run dev` (open http://localhost:5173)

Health check: `GET http://localhost:3000/health` → `{ ok: true }`

## Render deploy

The repository includes [`render.yaml`](render.yaml) defining a web service
for the server and a static site for the client. Replace the placeholder
service URLs in that file before deploying on [Render](https://render.com).
