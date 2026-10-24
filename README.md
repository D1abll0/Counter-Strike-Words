# Counter-Strike-Words

A Wordle-style Discord Activity inspired by the Counter-Strike 1.6 style.

The activity uses Google Spreadsheets as a public/admin interface for managing and adding words to the database.

## Architecture

| Part | Description |
|---|---|
| `frontend/` | Vite 5, vanilla JS (ES modules), `@discord/embedded-app-sdk` |
| `server/counter-strike-words/worker.js` | Cloudflare main Worker: authentication, game API, Discord interactions, daily cron |
| `server/svg-converter/worker.js` | Separate Worker: renders an SVG into a PNG using Browser Rendering (`quickAction("screenshot")`) |
| **Database** | Cloudflare D1 |

## Discord Activity Setup

Refer to the [Official documentation for Discord Activities](https://discord.com).\
All steps below are performed in the [Discord Developer Portal](https://discord.com).
 
1. **Create the Application**: Click *New Application*. In the **General Information** tab, copy the **Application ID** (`DISCORD_CLIENT_ID`) and the **Public Key** (`DISCORD_PUBLIC_KEY`).
2. **OAuth2**: Copy or reset the **Client Secret** (`DISCORD_CLIENT_SECRET`). The Activity requests `identify` and `guilds` scopes via the SDK. Under *Redirects*, add `https://127.0.0.1` or `https://discord.com` (as suggested by the Discord guide; the app never actually redirects).
3. **Bot**: Copy or reset the **Token** (`DISCORD_BOT_TOKEN`). No privileged intents are required; the bot only interacts with the REST API.
4. **Installation**: Enable the **Guild Install** context. In *Default Install Settings*, select the `applications.commands` and `bot` scopes. Check the following bot permissions: **View Channels**, **Send Messages**, and **Attach Files** (required to post daily results with an image to the system channel). Use the generated **Install Link** to invite the app to your server.
5. **Activities/URL Mappings**: Add two mappings. Targets must be bare hosts (without `https://` or paths):

   | Prefix | Target |
   |---|---|
   | `/` | The frontend host (page) |
   | `/api` | The worker host (main worker) |

6. **Activities/Settings**: Enable Activities and choose your supported platforms. Discord will automatically create the Entry Point command (launch command).
7. **Interactions Endpoint**: In **General Information**, set the **Interactions Endpoint URL** to `https://<worker-host>/interactions`. Discord sends a signed PING upon saving; this will only succeed if your Worker is deployed with the correct `DISCORD_PUBLIC_KEY`. This endpoint handles the *Play now!* button in daily summary messages.
8. **Launch**: Open any text or voice channel, click the **App Launcher** (rocket icon), and select your app. *Note: While the app is unpublished, ensure you add your friends under the **Teams** tab as testers if they cannot launch it.*

## Configuration

### Environment Variables

**Worker** (`server/counter-strike-words/worker.js`)

| Name | Type | Description |
|---|---|---|
| `ADMIN_KEY` | Secret | Any random string used for admin access (for initial database initialization only). |
| `DISCORD_CLIENT_ID` | Variable | Discord Application ID |
| `DISCORD_PUBLIC_KEY` | Variable | Discord Public Key |
| `DISCORD_CLIENT_SECRET` | Secret | Discord Client Secret |
| `DISCORD_BOT_TOKEN` | Secret | Discord Bot Token |
| `SESSION_SECRET` | Secret | Any random string used for session encryption |

**Frontend** (`frontend/.env`)

| Name | Type | Description |
|---|---|---|
| `DISCORD_CLIENT_ID` | Variable | Discord Application ID |

### Bindings

**Worker** (`server/counter-strike-words/worker.js`)

| Name | Type | Description |
|---|---|---|
| `DB` | D1 Database | Stores all game data |
| `SVG_CONVERTER` | Service Binding | Links to the `svg-converter` Worker |

**Worker** (`server/svg-converter/worker.js`)

| Name | Type | Description |
|---|---|---|
| `BROWSER` | Browser Run | Used for capturing screenshots via `quickAction("screenshot")` |

### Cron Triggers
**Worker** (`server/counter-strike-words/worker.js`)

| Expression | Description |
|---|---|
| `0 0 * * *` | Triggers the `scheduled()` handler every day at midnight to update words |

### Hardcoded Constants
*Modify these values in the code before deployment:*

**Worker** (`server/counter-strike-words/constants.js`)

| Constant | Description |
|---|---|
| `GOOGLE_SPREADSHEET_BASE` | URL of the word list (Google Apps Script Web App URL) |
| `SESSION_TTL` | Session lifetime (default: `24 h`) |

## Google Spreadsheet Integration

### 1. Internal Word Database
1. Create a Google Spreadsheet with a sheet named `words`.
2. It must contain two columns: `lang` and `words`. For specific domains (e.g., CS terms), prefix the language code (e.g., `community-en`).

   | lang | words |
   |---|---|
   | en | bomb |
   | community-en | zed |
   | it | gioco |

3. Go to `Extensions` → `Apps Script`, paste the code from `google/base.js`, and deploy it as a **Web App** with the following settings:
   * **Execute as:** Me
   * **Who has access:** Anyone
4. Copy the deployment URL and paste it into `server/counter-strike-words/constants.js` as `GOOGLE_SPREADSHEET_BASE`.

### 2. Public Submission Interface
1. Create a public spreadsheet with two sheets: `verification` (protected) and `public` (unprotected).
2. The sheets must include columns for language, word, and a checkbox/action column:

   | lang | words | to submit |
   |---|---|---|
   | en | flashbang | ☐ |

3. Go to `Extensions` → `Apps Script`, paste the code from `google/public.js`. Deploy it as a **Web App** (*Execute as: Me*, *Access: Anyone*).
4. Add a Spreadsheet **Trigger** with the following settings:
   * **Function to run:** `_onEdit`
   * **Deployment:** Head
   * **Event source:** From spreadsheet
   * **Event type:** On edit

## Deployment & Setup Guide

### 1. Prerequisites & Login
First, install Wrangler, and log into your Cloudflare account:
```bash
git clone https://github.com/D1abll0/Counter-Strike-Words.git
cd Counter-Strike-Words
npm install wrangler
npx wrangler login
```

### 2. Database Setup (Cloudflare D1)
Navigate to the server directory, create your D1 database, and initialize the schema:
```bash
cd server

# Create the D1 database
npx wrangler d1 create counter-strike-words
```

> **IMPORTANT:** After creating the database, Wrangler will output its configuration details (including the `database_id`). **You must copy this ID and save it in your `server/counter-strike-words/wrangler.toml` file** under the D1 bindings section before proceeding.

```bash
# Initialize database schema and verify tables
npx wrangler d1 execute counter-strike-words --remote --file=./schema.sql
npx wrangler d1 execute counter-strike-words --remote --command "SELECT name FROM sqlite_master WHERE type='table'"
```

### 3. Deploy Workers & Secrets
```bash
# Deploy SVG Converter Worker
npx wrangler deploy -c svg-converter/wrangler.toml

# Deploy Main Worker
npx wrangler deploy -c counter-strike-words/wrangler.toml

# Set required environment secrets for the Main Worker
npx wrangler secret put ADMIN_KEY -c counter-strike-words/wrangler.toml
npx wrangler secret put DISCORD_CLIENT_SECRET -c counter-strike-words/wrangler.toml
npx wrangler secret put DISCORD_BOT_TOKEN -c counter-strike-words/wrangler.toml
npx wrangler secret put SESSION_SECRET -c counter-strike-words/wrangler.toml
```

### 4. Add a link to the public interface
Specify a link for the `<a>` tag with the class `suggest` in the `frontend/index.html` file

### 5. Frontend Deployment (Cloudflare Pages)
Navigate to the frontend directory, install dependencies, build the production asset, and deploy via Cloudflare Pages:
```bash
cd ../frontend
npm install
npm run build

# Create and deploy the Cloudflare Pages project
npx wrangler pages project create counter-strike-words-app --production-branch=main
npx wrangler pages deploy --branch=main
```

### 6. Database initialization
```bash
curl -X POST https://<worker-host>/admin/sync -H "X-Admin-Key: <ADMIN_KEY>"
```

## Known Issues
* **Mobile Support:** The application layout might display incorrectly on mobile devices, especially in portrait orientation. 
* **Performance:** The current implementation is not the most optimized code.