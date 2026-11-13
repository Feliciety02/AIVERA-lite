# AIVERA Lite: AI-Assisted Security Assessment Platform

**Project Proposal**

| | |
|---|---|
| Course | [Course code and title] |
| Instructor | [Instructor name] |
| Group | [Group number or name] |
| Members | [Name 1], [Name 2], [Name 3], [Name 4] |
| Approved target | UMERCH3.0, the UM Merchandise Management System (local copy at http://127.0.0.1:8000 and deployed copy at https://umerch3-0-r74e.onrender.com) |
| Date | [Date submitted] |

> Fill in every part in square brackets before you submit. Attach the written approval for the target as an appendix.

## 1. Background

Small web applications built by students and small teams are often published without a security review. Common problems, such as missing security headers, weak session cookies, exposed configuration files and debug pages, are easy to find with existing tools. The hard part is reading the tool output, deciding which results are real, and explaining the risk and the fix in a report.

Security tools such as Nmap and OWASP ZAP produce a lot of raw output. Artificial intelligence can help explain that output in plain language. AI can also be wrong, so a person must still check every result before it counts as a vulnerability.

AIVERA Lite is a web platform that brings these pieces together. A tester pastes the link of an authorized website, the platform runs reconnaissance and scanning tools, AI helps interpret the results, the tester verifies each finding, and the platform produces an assessment report.

## 2. Problem statement

1. Running several security tools by hand and combining their output takes time and is easy to get wrong.
2. Raw tool output is hard to understand for developers who are not security specialists.
3. Automated scanners report false alarms, so results cannot be trusted without human review.
4. Testing a system without permission is unethical and illegal, so a tool must make it hard to scan the wrong target.

## 3. Objectives

**General objective:** develop a working AI-assisted platform that performs a controlled security assessment of an authorized web application while keeping a human assessor in charge of what counts as a confirmed vulnerability.

**Specific objectives:**

1. Register an authorized target with its approval and out-of-scope paths, and refuse any host that is not on an approved list.
2. Gather information about the target with DNS lookup, endpoint discovery and an Nmap port scan.
3. Assess at least three security categories with built-in checks and OWASP ZAP.
4. Provide at least two AI functions that interpret scan results, explain findings and draft report summaries, with secrets removed before anything is sent.
5. Let the assessor confirm or reject each finding with a note, and rate likelihood and impact to set the severity.
6. Show results on a dashboard and generate a printable assessment report from verified findings only.

## 4. Scope and limitations

**In scope**

* The approved target UMERCH3.0 only.
* The local copy: all checks, including Nmap and exposed file checks.
* The deployed copy: passive checks only (normal page requests, TLS handshake, ZAP passive mode).
* Five assessment categories: security configuration and HTTPS, authentication and login security, session management, information disclosure, and exposed files and directories.

**Out of scope**

* Any website that is not approved in writing.
* Public websites and university networks.
* Destructive tests, denial of service, brute force and changing or deleting data.
* Port scanning of the deployed site.

**Limitations**

* The platform finds configuration problems well, but logic flaws and injection need manual testing.
* Login security beyond the form itself (lockout, error messages, password policy) is tested by hand with test accounts, guided by a checklist the platform creates.
* The local AI model (Llama 3.2 3B) gives general answers. A larger model (Groq) gives better explanations but needs an API key.
* The platform has no sign-in. It is designed to run on the tester's own computer.

## 5. Proposed features

| Brief requirement | AIVERA Lite feature |
|---|---|
| Target and scope management | Paste a link, confirm permission, record who approved it and the paths to skip. Only hosts in `ALLOWED_HOSTS` can be scanned. |
| Reconnaissance and scanning | DNS lookup, endpoint discovery (home page links, robots.txt, sitemap.xml), Nmap port scan, optional OWASP ZAP passive scan |
| Web application security assessment | Login form checks, header and HTTPS checks, cookie checks, TLS checks, debug error page check, exposed file checks |
| AI integration | (1) interpret scan results and prioritize them, (2) explain a finding with how to verify and fix it, (3) draft the report summary |
| Findings verification and risk assessment | Confirm or reject with a note; likelihood × impact sets the severity |
| Dashboard and report generation | Dashboard by severity and category; printable report with scope, methodology, verified findings, evidence and recommendations |

## 6. Technologies

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js 22, Express 5, Zod (input validation), Helmet (security headers) |
| Database | SQLite through Prisma ORM |
| Security tools | Nmap, OWASP ZAP, Node DNS resolver, built-in HTTP and TLS checks |
| AI | Any OpenAI-compatible chat API: Ollama with Llama 3.2 3B on the same computer (default), or Groq |

## 7. Methodology and framework references

The assessment follows the phases of **NIST SP 800-115** (Technical Guide to Information Security Testing and Assessment): planning, discovery, attack (limited here to safe, non-destructive checks) and reporting. Test cases come from the **OWASP Web Security Testing Guide (WSTG)**, and findings are mapped to the **OWASP Top 10 (2021)**. Fix advice follows the **OWASP Cheat Sheet Series**.

## 8. Ethical considerations

* Only the approved target is tested, and the platform refuses other hosts.
* Only test accounts and synthetic data are used.
* No destructive tests are run.
* Secrets and personal data are removed before any text is sent to an AI service, and every AI request is logged.
* Every test is recorded in the activity log as evidence.

## 9. Schedule

| Milestone | Target date |
|---|---|
| Proposal and approved target | [date] |
| System design (architecture, database, workflow) | [date] |
| Initial development (frontend, backend, database) | [date] |
| Security integration (recon, scanning, assessment) | [date] |
| AI integration | [date] |
| Finalization (verification, dashboard, report) | [date] |
| Final presentation and deployment | [date] |

## 10. Member roles

| Member | Role and main contribution |
|---|---|
| [Name 1] | [for example: backend and scan tools] |
| [Name 2] | [for example: AI integration and redaction] |
| [Name 3] | [for example: frontend, dashboard and report] |
| [Name 4] | [for example: manual testing, evidence and documentation] |

## Appendix A. Target approval

[Attach the instructor's or owner's written approval for testing UMERCH3.0: who approved it, the date, and which copies may be tested.]
