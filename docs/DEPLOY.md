# Deploy and demo

## Keep the bot running all weekend

The bot listens to iMessage through Spectrum, so it must stay running somewhere.

**Simplest: one laptop.** Plugged in, sleep disabled:
```bash
npm start            # macOS: caffeinate -i npm start
```
Memory is in `data/state.json`, so restarts are safe.

**Always on: Azure App Service.** This is how https://grovekeeper.club runs; see [Azure App Service](#azure-app-service) below.

## Share the website

The bot serves the website itself at `http://127.0.0.1:8787`. To reach it from other devices, open a public tunnel:
```bash
npx cloudflared tunnel --url http://localhost:8787
```
That prints an `https://....trycloudflare.com` URL. Trees can only be opened with their code, and wrong guesses are rate-limited. Set `INGEST_TOKEN=some-secret` in `.env` so only your team can upload meetings.

## Azure App Service

The website and API run on Azure App Service (Linux, B1 plan, Node 24) as the web app `keepergrove` in `keeper-rg`, region `northcentralus` (Azure for Students only allows mexicocentral, francecentral, westus2, northcentralus and canadacentral). It runs `npm run tree`: website, API, recorded demo and the live web phone, without iMessage. B1 costs about $0.018 an hour.

```bash
az appservice plan create -g keeper-rg -n keepergrove-plan --is-linux --sku B1 -l northcentralus
az webapp create -g keeper-rg -p keepergrove-plan -n keepergrove --runtime "NODE|24-lts"
az webapp config appsettings set -g keeper-rg -n keepergrove --settings AZURE_OPENAI_ENDPOINT=... AZURE_OPENAI_API_KEY=... \
  AZURE_OPENAI_DEPLOYMENT=... ELEVENLABS_API_KEY=... TIGER_DATABASE_URL=... INGEST_TOKEN=... PUBLIC_URL=https://grovekeeper.club \
  API_HOST=0.0.0.0 API_PORT=8080 WEBSITES_PORT=8080 DATA_FILE=/home/data/state.json SCM_DO_BUILD_DURING_DEPLOYMENT=true
az webapp config set -g keeper-rg -n keepergrove --startup-file "npm run tree" --always-on true
git ls-files -z | xargs -0 zip -q /tmp/keeper.zip     # tracked files only: never .env or data/state.json
az webapp deploy -g keeper-rg -n keepergrove --src-path /tmp/keeper.zip --type zip
```
On the public site, the live web phone needs `demo.html?act=4&token=<INGEST_TOKEN>`. Shut it all down afterwards with `az appservice plan delete -g keeper-rg -n keepergrove-plan`.

## Custom domain

The domain is the front door: someone types `grovekeeper.club`, enters their chat's code, and sees their tree or grove.

1. At the registrar (ours is Porkbun), remove the parking records and add: `A @ -> <the app's IP>`, `TXT asuid -> <customDomainVerificationId>`, and for www `CNAME www -> keepergrove.azurewebsites.net` plus `TXT asuid.www`. Get both values with `az webapp show -g keeper-rg -n keepergrove --query customDomainVerificationId` and `dig +short keepergrove.azurewebsites.net`.
2. `az webapp config hostname add --webapp-name keepergrove -g keeper-rg --hostname grovekeeper.club` (and `www.grovekeeper.club`).
3. Free HTTPS: `az webapp config ssl create -g keeper-rg -n keepergrove --hostname grovekeeper.club`, then `az webapp config ssl bind --certificate-thumbprint <thumbprint> --ssl-type SNI -g keeper-rg -n keepergrove`, and `az webapp update -g keeper-rg -n keepergrove --https-only true`.
4. Set `PUBLIC_URL=https://grovekeeper.club` so `keeper code` replies link to it.

## Demo settings

In `.env` for the live demo, so moments happen within two minutes:
```
RESURFACE_AFTER_MIN=1
UNPROMPTED_COOLDOWN_MIN=1
```
Rehearse with `npm run sim -- scenarios/credit.txt` and `scenarios/edge-cases.txt`.

## Demo stage (video + in person)

Open `http://127.0.0.1:8787/demo.html` while the bot runs (`npm run dev` or `npm run tree`).

- **Acts 0–3** replay a recorded group chat: the mess without Keeper, the same chat with Keeper (tapbacks, credit, tree link, voice recap) and the grove. → / ← switch acts, space pauses, R restarts. `demo.html?auto=1` plays everything in a row for screen recording; `?act=4` jumps to an act.
- **Act 4 · Try it live** is a web iMessage simulator: type as anyone in the group and the real Keeper and model answer. It only works on the laptop running the bot, so strangers can't spend your model credits. To use it through a tunnel, open `demo.html?token=<INGEST_TOKEN from .env>`.
- Links Keeper sends become tappable previews that open the tree page on the same site. The recorded trees and Priya's grove code open there too.
- Edit the chats in `scenarios/demo/*.txt`, then `npm run demo:build` to re-record them through the real model and ElevenLabs (about a minute).
