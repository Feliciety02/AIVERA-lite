# Security Assessment Report: UMERCH3.0

**Prepared with AIVERA Lite**

| | |
|---|---|
| Target | UMERCH3.0, UM Merchandise Management System |
| Copies tested | Local: http://127.0.0.1:8000 · Deployed: https://umerch3-0-r74e.onrender.com |
| Approved by | [name, role, date and form of approval] |
| Assessors | [Name 1], [Name 2], [Name 3], [Name 4] |
| Testing period | [start date] to [end date] |
| Report version | [1.0], [date] |

> **How to finish this report.** Run the final scans, verify every finding in AIVERA Lite, then fill in the parts in square brackets. Only **confirmed** findings belong in section 6. The printable report on the Reports page has the same structure and can be attached as an appendix. Put screenshots in section 9.

## 1. Executive summary

[Write 4 to 6 sentences for a non-technical reader. You can start from the summary AIVERA Lite drafts with AI on the report page, then edit it. Cover: what was tested, how many verified findings at each severity, the most important risk in plain words, and the top 3 fixes.]

**Verified findings by severity**

| Critical | High | Medium | Low | Info |
|---|---|---|---|---|
| [n] | [n] | [n] | [n] | [n] |

**Overall risk:** [Low / Moderate / High], because [one sentence].

## 2. Scope and rules of engagement

**In scope**

* Local copy of UMERCH3.0 at http://127.0.0.1:8000: all AIVERA Lite checks, including Nmap and exposed file checks, plus manual tests with test accounts.
* Deployed copy at https://umerch3-0-r74e.onrender.com: passive checks only (normal page requests, TLS handshake, ZAP passive mode).

**Out of scope**

* Port scanning of the deployed copy.
* Any other host, public website or university system.
* [paths excluded, for example /logout]

**Rules followed**

* Written approval obtained before testing ([date]).
* Test accounts and synthetic data only; no real user data was viewed or changed.
* No destructive tests, denial of service or brute force.
* Secrets and personal data removed before any text was sent to an AI service; every AI request was logged.
* All tests recorded in the AIVERA Lite activity log.

## 3. Methodology

The assessment followed the four phases of **NIST SP 800-115**.

| Phase | What was done | Tools |
|---|---|---|
| Planning | Approval, scope, allowed host list, test accounts | AIVERA Lite scope settings |
| Discovery | DNS records, pages and endpoints, open ports and services | Node DNS resolver, endpoint discovery, Nmap |
| Assessment | Automated checks in five categories, then manual tests | AIVERA Lite web and login checks, OWASP ZAP (passive), browser developer tools, curl |
| Reporting | AI explanations, human verification, risk rating, this report | AIVERA Lite AI features and report |

**Test categories and references**

| Category (brief) | Example checks | OWASP WSTG | OWASP Top 10 (2021) |
|---|---|---|---|
| Security configuration and HTTPS | HTTPS, HSTS, CSP, X-Frame-Options, nosniff, TLS trust, expiry and old versions | WSTG-CONF-07, WSTG-CLNT-09, WSTG-CRYP-01 | A05 Security Misconfiguration, A02 Cryptographic Failures |
| Authentication and login security | Password in URL, login over HTTPS, anti-CSRF token; manual: account enumeration, lockout, password policy | WSTG-ATHN-01, WSTG-ATHN-03, WSTG-ATHN-07, WSTG-IDNT-04 | A07 Identification and Authentication Failures |
| Session management | Cookie Secure, HttpOnly, SameSite; manual: session ends on sign-out, new session after sign-in | WSTG-SESS-02, WSTG-SESS-03, WSTG-SESS-06 | A07 Identification and Authentication Failures |
| Information disclosure | Server and X-Powered-By versions, debug error pages, debug tools, robots.txt entries | WSTG-INFO-02, WSTG-ERRH-01 | A05 Security Misconfiguration |
| Exposed files and directories | .env, .git, logs, phpinfo, backups, database dumps | WSTG-CONF-04 | A05 Security Misconfiguration |

**Role of AI.** AI was used to interpret scan results, explain findings, suggest how to verify and fix them, and draft the executive summary. AI output was treated as advice only. Every finding in this report was checked by an assessor, who wrote a verification note.

**Risk rating.** Each confirmed finding was rated for likelihood and impact (low 1, medium 2, high 3). The product sets the severity: 9 critical, 6 high, 3 to 4 medium, 2 low, 1 info.

## 4. Reconnaissance results

| Item | Local copy | Deployed copy |
|---|---|---|
| DNS | IP address, no DNS records | [addresses from the scan, for example 216.24.57.16 and 216.24.57.18; alias gcp-us-west1-1.origin.onrender.com] |
| Open ports (Nmap, top 100) | [from the scan, for example 8000/tcp http; also list any Windows ports such as 135 and 445 and note they belong to the test computer, not UMERCH] | Not scanned (out of scope) |
| Pages found | [list from Scan details, for example /, /login, /admin] | [list] |
| Technology | [from headers and Nmap, for example PHP / Laravel, React front end] | [Render hosting] |

## 5. Summary of results

| Status | Count |
|---|---|
| Reported by tools | [n] |
| Confirmed by an assessor | [n] |
| Rejected as false alarms | [n] |
| Still to review | [should be 0 before submission] |

**False alarms.** [List each rejected finding and why, for example "ZAP flagged X but the header is set by the hosting platform".]

## 6. Verified findings

> One block per **confirmed** finding, highest severity first. Copy the fields from the finding page in AIVERA Lite. Below is a filled example and an empty template.

### F-01 [Title, for example: Content-Security-Policy header missing]

| | |
|---|---|
| Severity | [Medium] (likelihood [medium] × impact [medium]) |
| Category | [Security configuration and HTTPS] |
| Affected URL | [http://127.0.0.1:8000/ and https://umerch3-0-r74e.onrender.com/] |
| Found by | [Web checks] · Verified by [name] on [date] |
| References | [OWASP Top 10 A05; OWASP Secure Headers Project] |

**Description.** [What is wrong, in 2 or 3 sentences.]

**Evidence.** [The response headers from the finding page, plus how you checked it, for example `curl -I https://umerch3-0-r74e.onrender.com/` with the output. Add screenshot S-x.]

**Risk.** [What an attacker could do, and why you chose this likelihood and impact.]

**Recommendation.** [The fix, specific to Laravel or the hosting, for example add the header in middleware.]

### F-02 [Title]

| | |
|---|---|
| Severity | |
| Category | |
| Affected URL | |
| Found by | · Verified by on |
| References | |

**Description.**

**Evidence.**

**Risk.**

**Recommendation.**

### Candidate findings from the test scans

These were reported by AIVERA Lite during testing and still need verification. Confirm or reject each before you copy it into this section.

| Candidate | Category | Source | Verify with |
|---|---|---|---|
| Content-Security-Policy header missing | Configuration and HTTPS | Web checks | `curl -I`, browser developer tools Network tab |
| Page can be shown inside another site (clickjacking) | Configuration and HTTPS | Web checks | Put the page in an `<iframe>` on a local test page |
| X-Content-Type-Options header missing | Configuration and HTTPS | Web checks | `curl -I` |
| X-Powered-By header shows the software version | Information disclosure | Web checks | `curl -I` |
| Login form found: manual sign-in tests needed (/login) | Authentication and login security | Login form checks | The 5 manual tests in the finding, with a test account |
| [ZAP alerts, if you ran ZAP] | | OWASP ZAP | |
| Hard-coded administrator password in the source code (add by hand if confirmed) | Authentication and login security | Manual code review | Show the file and line; never write the password itself in the report |

## 7. Recommendations

| Priority | Action | Fixes |
|---|---|---|
| 1 | [for example: add security headers (CSP, X-Frame-Options, nosniff, HSTS) in Laravel middleware] | F-01, F-0x |
| 2 | [for example: remove the hard-coded password and move secrets to environment variables] | F-0x |
| 3 | [for example: hide X-Powered-By and server versions] | F-0x |
| 4 | [for example: add login rate limiting] | F-0x |

## 8. Conclusion

[3 to 5 sentences: overall state of UMERCH3.0's security, what was done well, the most important fixes, and a recommendation to retest after fixing.]

**Limitations of this assessment.** Automated checks cover configuration problems. Injection, access control and business logic were [tested by hand as described in section 6 / not covered]. The deployed copy was tested passively only. AI explanations came from [model name] and were checked by the assessors.

## 9. Evidence appendix

| ID | Screenshot | Shows |
|---|---|---|
| S-1 | [image] | Approved scope and permission on the AIVERA Lite scan box |
| S-2 | [image] | Scan progress with all steps finished |
| S-3 | [image] | Scan results: vulnerabilities list |
| S-4 | [image] | Scan details: DNS, open ports, pages found |
| S-5 | [image] | AI interpretation of the scan |
| S-6 | [image] | AI explanation of one finding |
| S-7 | [image] | Verifying a finding (likelihood, impact, note) |
| S-8 | [image] | A false alarm rejected with its note |
| S-9 | [image] | Dashboard |
| S-10 | [image] | Activity page: what was sent to the AI and the redaction count |
| S-11 | [image] | Manual test evidence, for example curl output or developer tools |

## 10. References

1. NIST SP 800-115, Technical Guide to Information Security Testing and Assessment (2008).
2. OWASP Web Security Testing Guide (WSTG), version 4.2.
3. OWASP Top 10 (2021).
4. OWASP Cheat Sheet Series: HTTP Headers, Session Management, Authentication, Clickjacking Defense.
5. Nmap Reference Guide, nmap.org.
6. OWASP ZAP documentation, zaproxy.org.
