# AIVERA Lite

An AI-assisted website vulnerability scanner. Open it, paste the link of a website you have permission to test in the box in the middle, and press **Scan**. You watch the scan run, then get the list of vulnerabilities it found. AI helps you read the results, you decide which findings are real, and confirmed findings go into a printable report. Press **Scan another website** to go back and test the next link.

There is no sign-in. It is meant to run on your own computer for your team's assessment.

This is the simplified version of AIVERA, built to match the final project brief and nothing more.

## How it follows the brief

| Brief step | Where it happens |
|---|---|
| 01 Define scope | Home page: the link, a permission checkbox, and under Options who approved the test and paths that must not be tested. Only hosts in `ALLOWED_HOSTS` can be scanned. |
| 02 Reconnaissance | DNS lookup, endpoint discovery (home page links, robots.txt, sitemap.xml), Nmap port scan |
| 03 Scanning | Login form checks and web checks, plus an optional OWASP ZAP passive scan |
| 04 Security assessment | Five categories: security configuration and HTTPS, authentication and login security (login form checks plus a manual test checklist), session management (cookies), information disclosure, exposed files and directories |
| 05 AI analysis | Interpret scan results and prioritize them, explain a finding with how to check and fix it, draft the report summary |
| 06 Findings verification | Finding page: the tester confirms or rejects each finding with a note on how they checked it |
| 07 Risk assessment | Likelihood × impact gives the severity (see below) |
| 08 Report generation | Reports page: printable report with summary, scope, methodology, findings, evidence and fixes |

**Security tools and data sources:** Nmap, OWASP ZAP, Node's DNS resolver, and the built-in web checks (plain HTTP and TLS requests, like curl).

**Risk rating:** likelihood and impact are each low (1), medium (2) or high (3). Their product gives the severity: 9 critical, 6 high, 3 to 4 medium, 2 low, 1 info.

## Safety rules built in

- A website can only be scanned if its host is in `ALLOWED_HOSTS` (server/.env) and the tester ticks the permission box.
- Online (hosted) websites only get safe, passive checks: normal page requests, a TLS handshake, and ZAP passive mode. No attack payloads, nothing is changed.
- Nmap port scans and exposed file checks only run on a copy on this computer (localhost / 127.0.0.1).
- Paths listed as "must not be tested" are never requested.
- Secrets, cookies, tokens and email addresses are removed before anything is sent to the AI. The Activity page shows exactly what was sent.
- AI output is advice only. It never confirms or rejects a finding.

## Setup

Needs Node.js 22 or newer. Nmap and OWASP ZAP are optional (their steps are skipped if missing). For AI, either Ollama on this computer or a Groq API key.

```bash
npm install
```

Copy `server/.env.example` to `server/.env` and fill it in (the allowed hosts, the AI provider, and the tool paths). Then create the database:

```bash
npm run db:setup
```

Start it:

```bash
npm run dev
```

Open http://localhost:5190, paste a link and press Scan.

For Ollama, pull the model first: `ollama pull llama3.2:3b`.

## Project structure

```
server/
  prisma/schema.prisma    database tables (Target, Scan, Finding, Report, AiLog, Activity)
  src/index.ts            Express server
  src/routes.ts           all API routes
  src/scanner.ts          runs the scan steps in order
  src/tools/              dns, endpoints, loginChecks, webChecks, nmap, zap
  src/ai/                 AI requests and redaction
src/
  pages/                  one file per page
  components/             layout and small UI parts
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | API (port 4100) and website (port 5190) together |
| `npm run build` then `npm start` | Production build, served by the API on port 4100 |
| `npm run db:setup` | Create the database |
| `npm run typecheck` | Check types in the website and the server |

## Documents

Drafts for the final project deliverables are in `docs/`:

| File | Deliverable |
|---|---|
| `docs/01-Project-Proposal.md` | Project proposal |
| `docs/02-System-Documentation.md` | Architecture, database design, workflow and modules |
| `docs/03-Final-Security-Report.md` | Final security report (fill in after verifying findings) |
| `docs/04-Demo-and-Oral-Defense.md` | Demo script and oral defense questions |

## References

NIST SP 800-115, OWASP Web Security Testing Guide (WSTG), OWASP Top 10 (2021), OWASP Cheat Sheet Series.
