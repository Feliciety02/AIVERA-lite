# AIVERA Lite: Demo Script and Oral Defense Guide

Use this to prepare the final presentation (rubric C: 20 points). Every member should be able to do their part of the demo and answer the questions for their area.

## 1. Before the demo

* [ ] UMERCH3.0 local copy running at http://127.0.0.1:8000
* [ ] Ollama running with `llama3.2:3b`, or Groq set in `server/.env`
* [ ] `npm run dev` running, http://localhost:5190 opens
* [ ] One finished scan saved as a backup, in case the network is slow
* [ ] Written approval ready to show
* [ ] A test account for UMERCH3.0 (never a real user's account)

## 2. Demo script (about 10 minutes)

| # | Who | What to show | What to say |
|---|---|---|---|
| 1 | [Name] | Landing page | What AIVERA Lite is, and that it only tests authorized websites |
| 2 | [Name] | Paste a link that is **not** approved (for example https://example.com) | The server refuses it: only hosts in `ALLOWED_HOSTS` can be scanned |
| 3 | [Name] | Paste http://127.0.0.1:8000, tick permission, Options (approval, paths to skip), Scan | Step 01 Define scope |
| 4 | [Name] | Scan progress | Steps 02 and 03: DNS, endpoints, login checks, web checks, Nmap. Nmap only runs on the local copy |
| 5 | [Name] | Results and Scan details | Step 04: findings start as "Needs review"; raw tool output is kept as evidence |
| 6 | [Name] | "Explain these results" and a finding's "Explain" | Step 05: the 2+ AI functions; secrets are removed first |
| 7 | [Name] | Activity page, AI requests | Exactly what was sent to the AI and how many values were redacted |
| 8 | [Name] | Verify one finding: likelihood, impact, note. Reject one false alarm | Steps 06 and 07: a person decides; the severity comes from the risk matrix |
| 9 | [Name] | Login checklist finding and the manual test you did | Login security tested by hand with a test account |
| 10 | [Name] | Dashboard, then Create report and print | Step 08: only verified findings go in the report |
| 11 | [Name] | Scan the deployed copy | Passive only: Nmap and file checks are skipped online |

## 3. Questions to prepare

### Ethical hacking procedures

1. **Why can't you scan any website you want?** Testing without permission is illegal and unethical. The platform enforces an allowed host list on the server and requires a permission check.
2. **Why is the deployed site tested only passively?** Port scans and file probes can look like an attack and can affect a shared hosting provider. We only have approval for safe checks there.
3. **What is the difference between passive and active testing?** Passive reads what the site returns to normal requests. Active sends crafted input to try to trigger a weakness.
4. **What standard did you follow?** NIST SP 800-115 phases (planning, discovery, attack, reporting), OWASP WSTG test cases, OWASP Top 10 for classification.
5. **What would you do if you found real user data?** Stop, do not copy it, record only that it is exposed, and tell the owner right away.

### AI integration and limitations

1. **What are your AI features?** Interpret scan results and prioritize them; explain a finding with verify and fix steps; draft the report summary.
2. **Why is AI not allowed to confirm findings?** It can hallucinate, misread evidence or miss context. A person must check the evidence.
3. **How do you protect secrets?** Redaction removes keys, tokens, cookies, passwords, private keys and emails before sending. Every request is logged with the exact text sent.
4. **Why Ollama?** It runs on our computer, so nothing leaves the machine and it is free. The trade-off is a small model with more general answers.
5. **Give an example of the AI being wrong.** [Prepare a real example from your testing.]

### Technical questions

1. **How does a scan run?** The API saves a scan record, starts the tools one after another in the background, and saves after each step. The page checks for updates every 2 seconds.
2. **How is the severity calculated?** Likelihood × impact, each 1 to 3: 9 critical, 6 high, 3 to 4 medium, 2 low, 1 info.
3. **How do you avoid duplicate findings?** A finding is unique per website by title and affected URL.
4. **How do you stop command injection through the link?** The URL is parsed and checked, and tools run without a shell, with arguments passed as a list.
5. **Why does the scan not follow redirects?** A redirect could send the scan to a host that is not approved.
6. **What does Nmap's `-sT -sV --version-light -Pn --top-ports 100` mean?** TCP connect scan, light service version detection, skip host discovery, the 100 most common ports.
7. **Why is there no sign-in?** The platform runs on the tester's computer for one team. Sign-in is not part of the brief. If it were deployed publicly, it would need sign-in first.

### Individual contribution

Each member should prepare 1 minute on:

* which files or features they built (see the module table in the system documentation),
* one problem they solved and how,
* one thing they would improve.

| Member | Part to explain | Files |
|---|---|---|
| [Name 1] | [part] | [files] |
| [Name 2] | [part] | [files] |
| [Name 3] | [part] | [files] |
| [Name 4] | [part] | [files] |
