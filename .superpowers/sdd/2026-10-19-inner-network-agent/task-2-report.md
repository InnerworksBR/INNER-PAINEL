# Task 2 — Windows Network Agent implementation report

Date: 2026-10-19
Branch: `codex/network-agent-snmp`
Scope: independent Windows SNMP collector, GUI installer and its distribution ZIP. The Hyper-V service and its installer/build changes were left outside this task's commit.

## Delivered

- Added `agent/Inner.Network.Agent/`, an independent .NET 8 Windows x64 service named `InnerNetworkAgent`. Its config refresh, SNMP collection and outbox sending loops run independently; API/token failures do not suspend collection using the cached configuration.
- Implemented a real SNMP client using `Lextm.SharpSnmpLib` 12.5.7. v2c and v3 GETs support SHA-1/SHA-256 authentication with `authNoPriv` or AES-128 `authPriv`. Requests honor cancellation and bounded timeouts; table walks cap returned rows. The tested library is the stable version reviewed for .NET 8, and its MIT attribution/license ships in `agent/THIRD-PARTY-NOTICES.txt`. The copied upstream loopback simulator test sources carry their own MIT license in `agent/Inner.Network.Agent.Tests/SnmpSimulator-LICENSE.txt`.
- Added CIDR expansion with overlap de-duplication and a fail-closed 4,096-IP budget, exclusion handling, no ICMP prerequisite, stable persisted device IDs, reboot/counter-reset-aware interface rates, and SQLite persistence for sequence, local identity, counters, cached state and a bounded 100 MB/1,000-batch outbox. 64-bit octet/error/discard counters are serialized as decimal strings.
- Added DPAPI LocalMachine storage for tokens, pairing/session secrets and the full cached config. Pairing saves the initial refresh token before submitting its hash. Token rotation persists the old/new pair and retries that same pair after a lost response, matching Task 1's retry-safe refresh contract.
- Added `agent/Inner.Network.Agent.Setup/`, a self-contained WinForms installer with an embedded service payload, UAC elevation, progress and a copyable service-issued pairing code. It installs/updates the automatic LocalSystem service, preserves ProgramData state, restricts data ACLs to SYSTEM and Administrators, and reports when it is waiting for Internet access. The ZIP traversal check and pairing-status parser have focused tests.
- Added `agent/build-network-agent.ps1` (HTTPS `-ApiBaseUrl` required), optional PowerShell launch/status helpers, and `agent/NETWORK-AGENT.md`. The API base is normalized to `/api` once. The main customer flow is the standalone GUI installer; no JSON editing, installed .NET runtime, or PowerShell execution is required for the install.

## Red/green and verification evidence

The first new test run was intentionally red: the new tests could not compile against the missing network service contract. After the initial service/store/client implementation, 3 behavioral tests failed because the tests disposed their HTTP handler too early and SQLite's pooled connections kept temporary database files open; fixing test lifetime/cleanup made the 9-test suite green. A subsequent persistent counter-history test was first run against the missing `RecordCounterAsync` API and failed; the store implementation made it pass. The machine-ID persistence test was also run before that API existed and failed at compile time; adding the persisted machine ID made it pass. Loopback SNMP tests were then added and exercised against real UDP requests and responses, not fabricated production values.

Final verification after the installer/status/ACL changes:

- `dotnet test agent/Inner.Network.Agent.Tests/Inner.Network.Agent.Tests.csproj -v minimal`: **20 passed, 0 failed**. This includes v2c, v3 SHA-256 `authNoPriv`, v3 SHA-256/AES-128 `authPriv`, bounded no-responder timeout, enrollment/retry bodies, persisted identity/config/outbox/counters, outbox limits, CIDR/rate behavior and installer status/extraction safety.
- `dotnet test agent/Inner.Agent.Windows.Tests/Inner.Agent.Windows.Tests.csproj -v minimal`: **22 passed, 0 failed**.
- PowerShell AST parser accepted `build-network-agent.ps1`, `install-network-agent.ps1`, and `network-agent-status.ps1` with **0 parse errors**. No installer or service command was executed.
- Ran `agent/build-network-agent.ps1 -ApiBaseUrl 'https://innerworks-painelbackend.zvzr4n.easypanel.host'`. Both service and setup publish completed for self-contained `win-x64`.
- Inspected the setup assembly resource without starting the installer: the embedded ZIP contains `Inner.Network.Agent.exe`, `appsettings.json`, and the native `e_sqlite3.dll`. The published config contains HTTPS base `https://innerworks-painelbackend.zvzr4n.easypanel.host` (without `/api`, which the client appends exactly once) and `C:\ProgramData\InnerWorks\NetworkAgent`.
- Inspected the distribution ZIP: `agent/artifacts/Inner.Network.Agent-win-x64.zip` is 94,430,171 bytes and contains `InnerNetworkAgent-Setup.exe`, the optional install/status scripts, `NETWORK-AGENT.md`, and third-party notices. The standalone installer is also at `agent/artifacts/InnerNetworkAgent-Setup.exe` (99,835,737 bytes). The ZIP does not include a second uncompressed service payload.

The external root-owned guide `docs/10-Agentes/NETWORK-AGENT-DEPLOYMENT.md` aligns with the final artifact names/paths and build command. It describes the backend copy destination as `backend/artifacts/Inner.Network.Agent-win-x64.zip`, which is an operator step after this build; this task did not copy into the backend or modify backend sources.

## Wire and local storage contracts

- Pairing request: `POST /api/agent/v1/pairings` with `machine_id`, `hostname`, `agent_version`, `os_version`, and `detected_networks`. Status is polled using `pairing_id` and private `device_secret`; the human code is only presented in the installer/status output.
- Completion persists the locally generated refresh token before `POST /api/agent/v1/pairings/complete` sends its SHA-256 hash. Refresh posts `{refresh_token: old, replacement_refresh_token: newPersistedRaw}` so an ambiguous/lost response can be retried with the identical pair.
- Config comes from `GET /api/agent/v1/network/config`; each network consumes optional `network_scope_id` in addition to `id`, `cidr`, `enabled`, `snmp_port`, `excluded_ips`, and `credential_ids`. Credentials are held only in the DPAPI-protected config cache and are not placed in batches.
- Metrics go to `POST /api/agent/v1/network/metrics` with idempotency key `<agent_id>-<sequence>`. Device results are `success`, `partial`, `timeout`, `auth_error`, or `protocol_error`. An unavailable target has null response time and no fabricated zero metric.
- Durable files live under `C:\ProgramData\InnerWorks\NetworkAgent`: SQLite database, DPAPI-encrypted secret files, and a small pairing-status JSON containing only state, user code/expiry/URL (not the device secret or tokens). Installer ACLs apply recursively.

## Pilot checks still required

No real Windows service installation, production API call, LAN discovery, backend/frontend deployment, or physical device polling was performed. Before general release, verify on a disposable Windows x64 host and explicitly authorized lab network:

1. Double-click the Setup EXE, approve UAC, confirm `InnerNetworkAgent` starts automatically, then copy the displayed code and complete the Portal link. Also test first install with HTTPS unavailable, later code issuance, expired code renewal, and status helper output.
2. Confirm upgrade over an existing installation preserves machine/device identity, DPAPI secrets, cached config, counters, and queued batches, and that files under ProgramData are readable only by SYSTEM/Administrators.
3. Link in a test company, configure a small approved CIDR and credential association, and verify only configured targets are queried. Test SNMP v2c and v3 `authNoPriv`/`authPriv` against actual supported devices; the simulator tests validate protocol paths but cannot establish vendor compatibility.
4. Verify SHA-1 interoperability for older v3 devices, invalid credentials, optional/missing system and interface OIDs, interface-table timeouts, UDP cancellation, and large/overlapping CIDRs on target Windows.
5. Disconnect the API after config is cached and confirm the service keeps polling and queueing within limits, then reconnect and check idempotent delivery and refresh-token recovery.
6. Confirm same IP/name across different tenant scopes remains isolated, shared-scope identity reconciles only by trusted serial/engine ID, and revocation blocks subsequent API use.
7. Confirm the backend distribution route serves the ZIP copied from `agent/artifacts/` and that the portal download path is correct after the root-owned backend integration.

The 20 loopback/unit tests and 22 Hyper-V tests are local test evidence only; they do not replace these Windows/service/pilot checks.
