
# Inner Agent Hyper-V Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Implement a Windows Hyper-V host agent that discovers and reports the host and its virtual machines to the existing Inner Portal without depending on Zabbix.

**Architecture:** A .NET Worker Service runs only on each Hyper-V host, collects host and hypervisor-level VM metrics, persists batches in a local SQLite outbox, and sends them over HTTPS to new Fastify endpoints. The current Fastify/Supabase stack persists normalized host/VM state and raw snapshots, while the web panel consumes the state through an authenticated SSE stream with polling fallback.

**Tech Stack:** TypeScript, Fastify 5, Supabase/PostgreSQL, React/Vite, Node test runner, .NET Worker Service, Hyper-V WMI v2, SQLite, DPAPI, HTTPS.

**Spec:** docs/superpowers/specs/2026-09-28-inner-agent-hyperv-design.md

## Global Constraints

- The agent is the primary and only operational source for server monitoring; Zabbix is not a fallback, comparator, scheduler dependency, or current-status source.
- One agent represents one physical Hyper-V host; guest agents inside VMs are out of scope for the MVP.
- The first collection interval is 60 seconds; freshness is approximately stale after 3 minutes and offline after 10 minutes.
- All timestamps are UTC.
- company_id is derived server-side from enrollment/authentication and is never trusted from an agent payload.
- All agent transport uses HTTPS and idempotency is required for metric batches.
- Activation tokens are one-time and permanent agent credentials are protected locally with DPAPI.
- The current Fastify/Supabase stack remains the platform; do not restore the removed monitoring subsystem or add a separate monitoring database/API.
- Existing user changes and deletions in the working tree are unrelated and must not be reverted.
- Each completed task must include its focused test command and an isolated commit containing only that task's files.

---

## File Map

### Backend and database

- Create backend/migration_019_agent_hyperv.sql — additive schema changes, indexes, retention function, and atomic ingest function.
- Create backend/src/types/agent.ts — agent claims, enrollment, heartbeat, metric batch, VM, and ingest result types.
- Create backend/src/services/agent-validation-service.ts — payload validation and stable error codes.
- Create backend/src/services/agent-auth-service.ts — activation-token hashing/consumption and agent credential issuance/rotation.
- Create backend/src/services/agent-ingest-service.ts — validation, atomic ingest invocation, event construction, and stream publication.
- Create backend/src/services/agent-stream-service.ts — company-scoped SSE subscriber registry and event publishing.
- Create backend/src/services/retention-service.ts — raw snapshot cleanup.
- Create backend/src/routes/agent/agent-routes.ts — enrollment, refresh, metrics, and heartbeat endpoints.
- Create backend/src/routes/client/metrics-stream-routes.ts — authenticated SSE endpoint.
- Modify backend/src/routes/admin/monitoring-routes.ts — native activation-token creation.
- Modify backend/src/routes/client/metrics-routes.ts — agent-native server/VM queries and removal of operational Zabbix paths.
- Modify backend/src/jobs/sync-scheduler.ts — remove Zabbix schedules and add retention execution.
- Modify backend/src/app.ts — register agent and SSE routes.
- Modify backend/src/types.ts — extend the public Server shape.
- Create backend/tests/agent-auth.test.ts.
- Create backend/tests/agent-validation.test.ts.
- Create backend/tests/agent-routes.test.ts.
- Create backend/tests/agent-stream.test.ts.

### Windows agent

- Create agent/Inner.Agent.sln and agent/Directory.Build.props.
- Create agent/src/Inner.Agent.Windows/Inner.Agent.Windows.csproj and Program.cs.
- Create agent/src/Inner.Agent.Windows/AgentWorker.cs.
- Create agent/src/Inner.Agent.Windows/Options/AgentOptions.cs.
- Create agent/src/Inner.Agent.Windows/Contracts/AgentContracts.cs.
- Create agent/src/Inner.Agent.Windows/Collectors/IHostMetricsCollector.cs and HostMetricsCollector.cs.
- Create agent/src/Inner.Agent.Windows/Collectors/IHyperVCollector.cs, HyperVCollector.cs, and HyperVProbe.cs.
- Create agent/src/Inner.Agent.Windows/Persistence/SqliteOutbox.cs.
- Create agent/src/Inner.Agent.Windows/Transport/AgentApiClient.cs and RetryPolicy.cs.
- Create agent/src/Inner.Agent.Windows/Security/DpapiCredentialStore.cs.
- Create agent/src/Inner.Agent.Windows/Services/EnrollmentService.cs and HeartbeatService.cs.
- Create agent/src/Inner.Agent.Windows/appsettings.json and bootstrap.json.
- Create agent/install/install-agent.ps1 and uninstall-agent.ps1.
- Create agent/scripts/publish.ps1 and agent/README.md.
- Create agent/tests/Inner.Agent.Tests with host, Hyper-V, outbox, and transport tests.

### Web and documentation

- Create web/src/hooks/useAgentRealtime.js.
- Modify web/src/pages/paginasClient/Servidores/servidores.jsx.
- Modify web/src/pages/paginasClient/Dashboard/dashboard.jsx.
- Modify web/src/pages/paginasAdmin/empresasAdmin/empresasAdmin.jsx.
- Modify web/src/pages/paginasAdmin/Onboarding/steps/Integrations.jsx.
- Modify docs/10-Agentes/README.md and README.md.

---

## Task 1: Add the additive agent schema and database functions

Files:
- Create backend/migration_019_agent_hyperv.sql.
- Create backend/src/services/agent-validation-service.ts.
- Create backend/tests/agent-validation.test.ts.

Interfaces:
- validateMetricBatch(input: unknown): MetricBatch.
- validateHeartbeat(input: unknown): HeartbeatRequest.
- ingest_agent_metrics(p_agent_id uuid, p_sequence_no bigint, p_idempotency_key text, p_collected_at timestamptz, p_payload jsonb).
- purge_agent_metrics(retention_days integer).

- [ ] Step 1: Write validation tests for CPU/memory bounds, non-finite numbers, negative uptime, non-empty host name, valid VM states, payload size, and VM count.
- [ ] Step 2: Run from backend: npm test -- --test-name-pattern="agent metric validation". Expected: FAIL because the validation module does not exist.
- [ ] Step 3: Create an additive migration. Make activation tokens hashable and one-time by adding token_hash and used_at, allowing the legacy raw token column to become nullable. Add last_metrics_at, last_error, hypervisor, agent_version, and status to registered_agents.
- [ ] Step 4: Add sequence_no to agent_metrics and a unique partial index on agent_id plus sequence_no. Add hyperv_vm_id to servers, a unique partial index on company_id plus agent_id plus hyperv_vm_id, and an index on company_id plus agent_id plus vm_parent_id.
- [ ] Step 5: Implement ingest_agent_metrics. Lock the registered agent, derive company_id from that row, insert the raw snapshot with duplicate protection, upsert host and VM current state, update freshness, and return duplicate for a previously accepted sequence or idempotency key. Never read tenant identity from the payload.
- [ ] Step 6: Implement purge_agent_metrics so it deletes only raw agent_metrics older than the requested retention period and returns the count. It must not delete servers, agents, or monitoring events.
- [ ] Step 7: Implement the TypeScript validation module with stable codes INVALID_PAYLOAD, INVALID_METRIC, and PAYLOAD_TOO_LARGE. Invalid numeric values must be rejected, not coerced to zero.
- [ ] Step 8: Run npm test -- --test-name-pattern="agent metric validation" and npx tsc --noEmit from backend. Expected: focused tests pass and no new TypeScript errors.
- [ ] Step 9: Commit with git add backend/migration_019_agent_hyperv.sql backend/src/services/agent-validation-service.ts backend/tests/agent-validation.test.ts followed by git commit -m "feat: add Hyper-V agent schema and validation".

## Task 2: Implement native enrollment and agent authentication

Files:
- Create backend/src/types/agent.ts.
- Create backend/src/services/agent-auth-service.ts.
- Create backend/src/routes/agent/agent-routes.ts.
- Modify backend/src/routes/admin/monitoring-routes.ts and backend/src/app.ts.
- Create backend/tests/agent-auth.test.ts and backend/tests/agent-routes.test.ts.

Interfaces:
- createActivationToken(supabase, companyId, createdBy, displayHint, validityMinutes): Promise<ActivationTokenResponse>.
- consumeActivationToken(supabase, rawToken, enrollment): Promise<AgentCredentials>.
- verifyAgentAccessToken(request): Promise<AgentPrincipal>.
- rotateAgentRefreshToken(supabase, agentId, refreshToken): Promise<AgentCredentials>.
- POST /api/agent/v1/enroll.
- POST /api/agent/v1/refresh.

- [ ] Step 1: Write tests for token hashing, expiry, one-time consumption, invalid machine identity, agent JWT claims, refresh rotation, and rejection of portal JWTs.
- [ ] Step 2: Run npm test -- --test-name-pattern="agent auth". Expected: FAIL because the service and claim types do not exist.
- [ ] Step 3: Define AgentPrincipal, EnrollmentRequest, EnrollmentResponse, AgentCredentials, and refresh request/response types. Use snake_case at the HTTP boundary and camelCase in TypeScript.
- [ ] Step 4: Replace the existing admin monitoring bridge. Keep the current endpoint path for UI compatibility, generate a cryptographically random raw token, persist only its SHA-256 hash plus expiry/metadata, return the raw token once, and audit creation without logging the secret.
- [ ] Step 5: Implement enrollment. Consume a valid activation token atomically, create or update one registered_agents row for the host identity, issue a short-lived access token and rotatable refresh token, and return the 60-second interval. Repeated enrollment for the same machine must not create duplicate active agents.
- [ ] Step 6: Implement refresh rotation. Store only a hash of the refresh token, rotate it on success, and reject reuse of the previous token.
- [ ] Step 7: Register agent routes under /api/agent/v1 without the portal authenticate hook. The dedicated verifier must validate issuer, audience, kind, and agent/company claims.
- [ ] Step 8: Run npm test -- --test-name-pattern="agent auth|agent routes" and npx tsc --noEmit from backend. Expected: focused tests pass.
- [ ] Step 9: Commit with git add backend/src/types/agent.ts backend/src/services/agent-auth-service.ts backend/src/routes/agent/agent-routes.ts backend/src/routes/admin/monitoring-routes.ts backend/src/app.ts backend/tests/agent-auth.test.ts backend/tests/agent-routes.test.ts followed by git commit -m "feat: add native Hyper-V agent enrollment".

## Task 3: Implement idempotent metric ingestion and heartbeat

Files:
- Create backend/src/services/agent-ingest-service.ts.
- Modify backend/src/routes/agent/agent-routes.ts, backend/src/services/monitoring-events-service.ts, and backend/src/types.ts.
- Modify backend/tests/agent-routes.test.ts.

Interfaces:
- ingestMetricBatch(supabase, principal, batch, idempotencyKey): Promise<AgentIngestResult>.
- recordAgentHeartbeat(supabase, principal, heartbeat): Promise<HeartbeatResponse>.
- AgentIngestResult is status accepted or duplicate, sequence number, and acceptedAt timestamp.

- [ ] Step 1: Write tests for valid ingestion, missing idempotency key, duplicate sequence, out-of-order sequence, oversized VM list, invalid numbers, heartbeat updates, and agent/company mismatch.
- [ ] Step 2: Run npm test -- --test-name-pattern="agent ingestion|heartbeat". Expected: FAIL because the ingestion service is not implemented.
- [ ] Step 3: Validate the Idempotency-Key against agent_id and sequence, reject empty or conflicting values, call ingest_agent_metrics, map accepted/duplicate status, and publish no event for duplicates.
- [ ] Step 4: Implement heartbeat updates for last_heartbeat, status, version, backlog summary, and last collection result. Return server time, agent status, and next heartbeat interval.
- [ ] Step 5: Add stable-key events for agent status transitions, VM state transitions, VM discovery, VM absence, and collection errors. Repeated batches must not duplicate events.
- [ ] Step 6: Extend the public Server type with monitoring_source, agent_id, vm_parent_id, is_virtual, hyperv_vm_id, freshness_status, last_metrics_at, vm_cpu_percent, vm_memory_percent, and vm_status. Keep legacy Zabbix fields nullable but unused for current health.
- [ ] Step 7: Run npm test -- --test-name-pattern="agent ingestion|heartbeat" and npx tsc --noEmit. Expected: duplicate batches are acknowledged idempotently.
- [ ] Step 8: Commit with git add backend/src/services/agent-ingest-service.ts backend/src/routes/agent/agent-routes.ts backend/src/services/monitoring-events-service.ts backend/src/types.ts backend/tests/agent-routes.test.ts followed by git commit -m "feat: ingest Hyper-V agent metrics idempotently".

## Task 4: Create the isolated Windows agent and host collector

Files:
- Create agent/Inner.Agent.sln, agent/Directory.Build.props, the Worker Service project, Program.cs, AgentWorker.cs, Options/AgentOptions.cs, Contracts/AgentContracts.cs, host collector files, and host collector tests.

Interfaces:
- IHostMetricsCollector.CollectAsync(CancellationToken): ValueTask<HostMetricRecord>.
- In this task AgentWorker consumes only IHostMetricsCollector; later tasks add Hyper-V, outbox, and transport dependencies.
- AgentContracts JSON names match POST /api/agent/v1/metrics exactly.

- [ ] Step 1: Scaffold a Windows Worker Service targeting the supported .NET runtime, add the test project, and write a failing host collector test using fake CPU, memory, disk, and uptime probes.
- [ ] Step 2: Run dotnet test agent/tests/Inner.Agent.Tests/Inner.Agent.Tests.csproj --filter FullyQualifiedName~HostMetricsCollector. Expected: FAIL because the collector is missing.
- [ ] Step 3: Implement IHostSystemProbe behind Windows performance counters or equivalent Windows APIs. Map unavailable counters to explicit quality/error data instead of zero.
- [ ] Step 4: Implement HostMetricsCollector for hostname, OS version, CPU, memory totals/usage, monitored disks, uptime, and UTC collection time.
- [ ] Step 5: Register UseWindowsService, one non-overlapping 60-second host collection loop, and cancellation that stops the worker cleanly. Keep persistence and HTTP disposal in the later transport task.
- [ ] Step 6: Run dotnet test agent/tests/Inner.Agent.Tests/Inner.Agent.Tests.csproj --filter FullyQualifiedName~HostMetricsCollector and dotnet build agent/Inner.Agent.sln. Expected: PASS and clean build.
- [ ] Step 7: Commit the new agent solution and host collector with git commit -m "feat: scaffold Hyper-V Windows agent host collector".

## Task 5: Add Hyper-V VM discovery and collection

Files:
- Create agent/src/Inner.Agent.Windows/Collectors/IHyperVCollector.cs, HyperVCollector.cs, and HyperVProbe.cs.
- Modify agent/src/Inner.Agent.Windows/Contracts/AgentContracts.cs and AgentWorker.cs.
- Create agent/tests/Inner.Agent.Tests/HyperVCollectorTests.cs.

Interfaces:
- IHyperVCollector.CollectAsync(CancellationToken): ValueTask<IReadOnlyList<VirtualMachineMetricRecord>>.
- IHyperVProbe.ListVirtualMachines(CancellationToken): ValueTask<IReadOnlyList<HyperVSnapshot>>.
- HyperVSnapshot contains stable VM ID, name, state, CPU, memory, uptime, network counters, and virtual disk size.

- [ ] Step 1: Write failing tests for running, off, paused, missing optional values, renamed VM with stable ID, and an empty host. Assert that VM ID, not display name, is identity.
- [ ] Step 2: Run dotnet test agent/tests/Inner.Agent.Tests/Inner.Agent.Tests.csproj --filter FullyQualifiedName~HyperVCollector. Expected: FAIL because the collector is missing.
- [ ] Step 3: Implement the local root\\virtualization\\v2 probe using Microsoft.Management.Infrastructure or the supported Hyper-V management API. Keep WMI calls behind IHyperVProbe so tests need no live Hyper-V host.
- [ ] Step 4: Map explicit nulls for unavailable metrics and include collection time. Do not fabricate an Off VM for a VM absent from the current inventory.
- [ ] Step 5: Add host and VM records to one batch. VM collection failure marks the batch partial and still sends valid host metrics plus VM error details.
- [ ] Step 6: Run the Hyper-V test filter and dotnet build agent/Inner.Agent.sln. Expected: PASS without requiring Hyper-V.
- [ ] Step 7: Commit with git commit -m "feat: collect Hyper-V virtual machines from host".

## Task 6: Add SQLite outbox, HTTPS transport, DPAPI, and heartbeat

Files:
- Create outbox, transport, retry, DPAPI, enrollment, and heartbeat files under agent/src/Inner.Agent.Windows.
- Modify AgentWorker.cs and Program.cs.
- Create SqliteOutboxTests.cs and AgentApiClientTests.cs.

Interfaces:
- ISqliteOutbox.EnqueueAsync(MetricBatch, CancellationToken): ValueTask<Guid>.
- ISqliteOutbox.GetDueAsync(int, CancellationToken): ValueTask<IReadOnlyList<OutboxBatch>>.
- ISqliteOutbox.AcknowledgeAsync(Guid, CancellationToken): ValueTask.
- ISqliteOutbox.FailAsync(Guid, RetryDecision, CancellationToken): ValueTask.
- IAgentApiClient.EnrollAsync, SendMetricsAsync, and SendHeartbeatAsync return typed contract responses.

- [ ] Step 1: Write failing tests for atomic enqueue, read-after-restart, ACK removal, retry attempts, 4xx quarantine, Retry-After, capped exponential backoff, and one refresh after 401.
- [ ] Step 2: Run the outbox and client filters. Expected: FAIL because the persistence and transport types are missing.
- [ ] Step 3: Implement SQLite WAL mode with outbox_batches, local_metadata, and quarantine_batches. Store compressed payload, sequence, idempotency key, attempts, next-attempt time, failure details, and age. Enforce byte and row caps.
- [ ] Step 4: Implement one HttpClient with timeout, Authorization, Idempotency-Key, payload-size check before gzip, and redacted logs. Map 2xx, 401, 429, permanent 4xx, 5xx, timeout, and network failures to RetryDecision.
- [ ] Step 5: Protect access/refresh tokens and agent ID with LocalMachine DPAPI, restrict the data directory ACL, and remove bootstrap token contents after enrollment. Fail closed on corrupt credentials.
- [ ] Step 6: Build heartbeat from real worker/outbox state: pending count/bytes, last sequence, last ACK, last collection result, and service uptime.
- [ ] Step 7: Run dotnet test agent/Inner.Agent.sln and dotnet build agent/Inner.Agent.sln. Expected: PASS.
- [ ] Step 8: Commit with git commit -m "feat: add durable agent transport and outbox".

## Task 7: Add authenticated SSE and web host/VM presentation

Files:
- Create backend/src/services/agent-stream-service.ts and backend/src/routes/client/metrics-stream-routes.ts.
- Modify backend/src/app.ts.
- Create web/src/hooks/useAgentRealtime.js and its test.
- Modify server and dashboard pages.
- Create backend stream tests.

Interfaces:
- publishAgentEvent(companyId: string, event: AgentStreamEvent): void.
- subscribeAgentStream(companyId: string, listener: (event: AgentStreamEvent) => void): () => void.
- GET /api/client/metrics/stream?company_id=optional-admin-preview.
- useAgentRealtime returns data, loading, lastUpdated, connected, and refresh.

- [ ] Step 1: Write tests for company isolation, unsubscribe, disconnect cleanup, initial fetch, metrics_updated, reconnect, and polling fallback.
- [ ] Step 2: Run backend stream tests and the focused web test. Expected: FAIL because the stream service and hook do not exist.
- [ ] Step 3: Implement a company-scoped Map<companyId, Set<listener>>, subscriber caps, cleanup, keep-alive comments, and serialized event envelopes.
- [ ] Step 4: Implement the authenticated Fastify SSE route with existing portal JWT and resolveCompanyScope. Reject unauthorized company preview and unregister on disconnect.
- [ ] Step 5: Publish only after accepted atomic ingestion. Duplicate batches publish nothing.
- [ ] Step 6: Implement the web hook with fetch plus Authorization header and a streaming parser. Do not place the portal token in a query string. Back off on stream failure and refresh through the existing API polling fallback.
- [ ] Step 7: Render host rows and VM child rows with vm_parent_id, freshness/status, and separate host disk metrics from virtual disk size.
- [ ] Step 8: Refresh the dashboard summary when an agent event affects server health.
- [ ] Step 9: Run backend stream tests, web tests, and npm --prefix web run build. Expected: focused tests and build pass; unrelated baseline failures remain explicitly reported.
- [ ] Step 10: Commit with git commit -m "feat: stream Hyper-V metrics to the portal".

## Task 8: Make agent-native monitoring the only operational server flow

Files:
- Modify backend/src/jobs/sync-scheduler.ts.
- Modify backend/src/routes/client/metrics-routes.ts.
- Modify backend/src/routes/admin/dashboard-routes.ts and noc-routes.ts.
- Modify backend/src/services/integration-status-service.ts and zabbix-service.ts.
- Modify admin, onboarding, and server web pages.
- Extend backend/tests/agent-routes.test.ts.

Interfaces:
- Operational server lists return current agent-native rows.
- No scheduler job, manual sync branch, debug route, or admin UI action calls Zabbix.
- Integration status exposes agent freshness/registered host counts instead of Zabbix health.

- [ ] Step 1: Write regression tests for Zabbix scheduler absence, explicit deprecation response for manual Zabbix sync, agent-native filtering, and dashboard/NOC health based on freshness.
- [ ] Step 2: Run the source-boundary tests. Expected: FAIL because current routes and scheduler still contain operational Zabbix paths.
- [ ] Step 3: Remove server/network Zabbix cron registrations; retain unrelated GLPI/MS365 jobs and retention.
- [ ] Step 4: Remove manual Zabbix sync/debug behavior and return a visible deprecation response for stale clients. Do not delete archived Zabbix data.
- [ ] Step 5: Update admin/NOC health to read registered agents and last_metrics_at/status.
- [ ] Step 6: Remove Zabbix setup/test controls from admin/onboarding UI and make the Inner Agent token card the server-monitoring setup path.
- [ ] Step 7: Run npm test -- --test-name-pattern="agent-native|zabbix deprecation|scheduler" and npx tsc --noEmit from backend, then npm --prefix ..\web run lint from backend. Expected: new tests pass; unrelated baseline issues are reported.
- [ ] Step 8: Commit with git commit -m "feat: make agent-native monitoring the server source".

## Task 9: Add retention, installation packaging, and operations documentation

Files:
- Create backend/src/services/retention-service.ts.
- Modify backend/src/jobs/sync-scheduler.ts.
- Create agent/install/install-agent.ps1, uninstall-agent.ps1, agent/scripts/publish.ps1, agent/README.md.
- Modify docs/10-Agentes/README.md and README.md.
- Create retention service test.

Interfaces:
- purgeAgentMetrics(supabase, retentionDays): Promise<number>.
- Installer accepts ApiBaseUrl, BootstrapFile, InstallRoot, and ForceRepair without printing secrets.
- Upgrade preserves ProgramData\InnerAgent and installs binaries under Program Files.

- [ ] Step 1: Write a retention test that mocks the Supabase RPC and asserts the 30-day default, returned count, and redacted logging.
- [ ] Step 2: Run npm test -- --test-name-pattern="agent retention". Expected: FAIL because the retention service is missing.
- [ ] Step 3: Run retention once daily from the existing scheduler, isolate failures from collection jobs, and configure the period with a 30-day default.
- [ ] Step 4: Make install-agent.ps1 idempotent: stop before upgrade, preserve config/outbox, install/update the service, restore the previous running state, and return non-zero codes for invalid input, missing elevation, failed enrollment, or failed service start. Accept the one-time token only through a protected BootstrapFile and never echo its contents.
- [ ] Step 5: Make uninstall-agent.ps1 remove only the Inner Agent service/binaries and preserve data unless RemoveData is explicitly supplied.
- [ ] Step 6: Publish a self-contained Windows x64 package with version metadata and SHA-256 manifest.
- [ ] Step 7: Document Hyper-V prerequisites, permissions, token generation, silent install, service/log/outbox diagnostics, offline recovery, VM lifecycle, and the limitation that guest filesystem free space requires a guest agent.
- [ ] Step 8: Run npm test -- --test-name-pattern="agent retention", dotnet test agent/Inner.Agent.sln, and dotnet publish agent/src/Inner.Agent.Windows/Inner.Agent.Windows.csproj -c Release -r win-x64 --self-contained true. Expected: tests pass and package contains service binary, config template, installer, uninstall script, and checksum manifest.
- [ ] Step 9: Commit with git commit -m "docs: package and operate the Hyper-V agent".

## Task 10: Execute the Hyper-V pilot and final verification

Files:
- Modify agent/README.md and docs/10-Agentes/README.md with pilot evidence and supported host versions.
- Test backend agent suites and agent/Inner.Agent.sln.

- [ ] Step 1: Run from backend: npm test and npx tsc --noEmit. Record unrelated pre-existing failures separately; no agent test failure may be hidden.
- [ ] Step 2: Run dotnet test agent/Inner.Agent.sln and dotnet build agent/Inner.Agent.sln -c Release.
- [ ] Step 3: Install on an internal Hyper-V host with a short-lived activation token. Verify enrollment, host/VM counts, and bootstrap-token deletion.
- [ ] Step 4: Create, start, stop, rename, and remove a test VM. Verify stable Hyper-V identity, state transitions, discovery, and inactive reconciliation.
- [ ] Step 5: Block API access for one hour, restart the service, restore access, and verify queued batches are acknowledged without duplicates. Test 401 and 503 behavior.
- [ ] Step 6: Use two test companies to verify API and SSE tenant isolation. Reopen the browser stream and confirm snapshot convergence.
- [ ] Step 7: Run focused tests again, inspect git diff --check, review migration contents, and confirm Zabbix is absent from active scheduler/routes/UI. Report only verified results.
- [ ] Step 8: Commit pilot evidence with git commit -m "test: document Hyper-V agent pilot acceptance".

## Verification Matrix

| Requirement | Verification |
| --- | --- |
| Host-only installation discovers VMs | Hyper-V collector tests and live VM lifecycle test |
| Hypervisor CPU/memory/state data | Fake WMI probe tests plus pilot comparison |
| No guest agent required | Pilot with VMs that do not contain Inner Agent |
| Offline-first delivery | SQLite outbox test and one-hour outage |
| Idempotency | Duplicate sequence/Idempotency-Key endpoint test |
| Credential safety | DPAPI test, bootstrap deletion, redacted logs |
| Company isolation | Backend route tests and two-company SSE pilot |
| Real-time panel | SSE hook/reconnect test and live panel check |
| Zabbix no longer operational | Scheduler/route/UI regression tests and source review |
| Retention | RPC/service test and database count check after purge |
