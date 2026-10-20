# Inner Network Agent — validação da integração final

Registro da integração `0f766c5` e da correção residual `07575b0`. A primeira revisão direcionada confirmou os itens 1–3; a conferência de `07575b0` confirmou os itens 4 e 5, sem novos achados importantes. As cinco correções funcionais estão concluídas. Os hashes abaixo correspondem ao pacote reconstruído dessa última versão.

Base reviewed: `33417cbc6e42ef6da20d4d1bc810b25837666e38`

Source commits: `0f766c5a17381d0154451ebca72736fb1cf4f20b` and `07575b0b34e261fffe7c7ddb4f491b0d3637aeb6`.

## Verificação independente do controlador — 20/10/2026

- `dotnet test agent/Inner.Network.Agent.Tests/Inner.Network.Agent.Tests.csproj --no-build --no-restore -v minimal`: 62/62 aprovados, saída 0.
- Em `backend/`, `npx tsx --test tests/network-routes.test.ts tests/network-validation.test.ts`: 21/21 aprovados, saída 0.
- `backend/tests/run-network-agent-pg-tests.ps1`: migrations 022–025, fixture e disputa real com duas sessões aprovados em banco novo `network_agent_fresh_20261020192105`, saída 0. Esse último replay inclui identidades vazias/genéricas, timeout com inventário preservado, flag falso com array não vazio e observações atrasadas.
- Em `web/`, `npm test -- --reporter=json`: 25/29 aprovados. As quatro falhas continuam restritas aos casos preexistentes de Conta/Sidebar; todos os testes da integração de rede passaram. Os hashes do drawer e de seu teste foram conferidos novamente após o freeze, sem alterações.
- ZIP aberto e conteúdo conferido. O EXE dentro do ZIP tem o mesmo hash do EXE independente. Hashes e tamanhos dos dois ZIPs locais correspondem à tabela abaixo. `git diff --check` passou nos dois intervalos de correção.
- Prévia local com dados simulados confirmou o aviso de interfaces preservadas, contador `9007199254741001` sem perda de precisão e taxas antigas ocultas. Servidor e aba temporários foram encerrados após a inspeção.

## 1. Relink authorization and stale configuration

**Red evidence.** The lifecycle regression first showed that a definitive refresh `401` left `configuration_cache` on disk. The collection-loop regression manually prepares authorization-lost/new-company states to verify that cache remains ineligible until a new configuration is saved. The coordinator regression changes authorization before semaphore acquisition. As confirmed by independent review, these tests do not execute full pairing/provisioning, a delayed old HTTP configuration response, or a real semaphore waiter; those remain coverage limits.

**Change.** Authorization now has an epoch that advances on definitive authorization loss and successful relink. A `401` durably marks authorization lost and deletes only cached configuration and enrollment credentials. Relink clears the lost/revoked flags only after deleting configuration cache, so a restart or new company cannot reactivate old targets. Configuration responses are persisted only when their captured epoch, agent ID, and company ID still match. Collection and discovery carry the captured epoch into the coordinator; it is checked after local reconciliation, before and after semaphore acquisition, between discovery chunks, after probes before target upsert, and before outbox writes. A delayed old request therefore cannot resume probes or persist stale configuration after relink. Ordinary API `503` with the same enrollment retains its valid offline cache.

**Green.** `dotnet test agent/Inner.Network.Agent.Tests/Inner.Network.Agent.Tests.csproj -v minimal` — 62 passed, 0 failed. Relevant tests cover the actual collection loop with manually prepared state, same-enrollment configuration failure, durable cache invalidation, authorization gate changes before semaphore acquisition, and fresh configuration enabling new probes. Independent source review confirmed epoch checks around actual probe start and delayed-configuration persistence.

## 2. Legacy history fallback ambiguity

**Red evidence.** New Fastify cases reproduced a name-only legacy query returning a row when another same-company device with that name existed, including a hidden collision; the old route could not prove that NULL-ID history belonged to the requested device.

**Change.** Legacy history by name is used only after finding exactly one same-company device with that name and confirming it is the requested source ID. Ambiguous history returns an empty list. Existing company visibility checks, cross-company denial, and ID-based SNMP history remain intact.

**Green.** `cd backend; npx tsx --test tests/network-validation.test.ts tests/network-routes.test.ts` — 21 passed, 0 failed. Cases cover ambiguous visible/hidden collisions, unique fallback, and cross-company access.

## 3. Placeholder shared identity

**Red evidence.** Initial SQL regressions failed because the trusted identity helper accepted empty/whitespace values and because placeholder engine values could contradict a trusted serial. Existing local persistence tests also demonstrate how common placeholders could cause separate devices to share an identity.

**Change.** Local and SQL identity normalization reject empty/whitespace and a conservative sentinel set (`unknown`, `n/a`, `not available`, `none`, `null`, zero and all-zero values, and related placeholders). The SQL serial/engine conflict path now compares only normalized trusted engine IDs; untrusted engine values cannot create an engine alias or replace a previously trusted engine field. Raw serial inventory remains available for display, while NULL trusted identity keeps devices local to their source/UID when no reliable serial or engine ID exists. No broad history merge, split, or backfill was added.

**Green.** The isolated PostgreSQL harness first failed on the new empty/placeholder regression. After the helper and engine-field corrections, `cd backend; ./tests/run-network-agent-pg-tests.ps1` passed migrations 022–025, the integration fixture, and concurrent shared-identity race in fresh DB `network_agent_fresh_20261020192024` inside container `inner-network-agent-db-20261019` (`network=none`). Existing reliable serial reconciliation and conflicting trusted engine separation also pass.

## 4. Same-IP physical replacement identity

**Red evidence.** The initial durable-store test reproduced replacement when both identifiers changed. Independent review then found that one matching kind could mask another kind's contradiction. The added regression `Any_conflicting_trusted_identifier_or_ambiguous_legacy_alias_forces_new_uid` failed with the same serial and a different engine ID before the residual correction.

**Change.** Any comparable trusted identity contradiction prevents old same-IP UID reuse, even when another kind matches. All stored aliases are read into sets; a comparable kind with multiple legacy values is ambiguous. Conflicting observations bypass matching-alias and IP fallback so they cannot undo the replacement decision. The replacement receives a new UID and independent counter baseline. Compatible identity, same-device IP moves, absent optional identifiers and placeholder rejection retain their existing behavior.

**Green.** The new focused regression passed 1/1, covering both one-field contradiction directions, seeded legacy conflicting aliases and fresh counter baselines. The full network suite passed 62/62, including distinct devices with placeholders, compatible IP movement and absent optional IDs. Hyper-V passed 22/22.

## 5. Interface observation availability

**Red evidence.** Backend validation first failed because `interfaces_observed` was dropped from normalization. SQL integration coverage verifies that unavailable/partial empty results otherwise lose the current interface table, while an explicitly observed empty list must clear it.

**Wire and schema change.** The compatible optional boolean `interfaces_observed` is emitted by the C# producer and appears in both actual-serializer and backend-local fixture copies. `true` means the walk completed, including a valid empty table; `false` means it was unavailable. Timeout results emit false. Backend validation accepts only a boolean. Migration 025 adds `network_devices.interfaces_observed boolean NOT NULL DEFAULT false`, marks existing non-empty inventories observed, and installs the updated ingestion function. Both migration 024 and 025 preserve existing interface JSON on unavailable/legacy partial empty observations, clear it only for `true` plus an empty array, and ignore delayed older observations. Current details retain the availability flag. The drawer warns that a failed query is showing the last known interface list and suppresses old in/out rates so cached counters are not presented as new measurements.

**Green.** C# serialization fixture test passed in the 62-test agent suite. `cd backend; npx tsx --test tests/network-validation.test.ts tests/network-routes.test.ts` — 21 passed. Isolated PostgreSQL harness covers non-empty → unavailable/preserved, observed empty → cleared, delayed observations, and shared-scope identity. `cd web; npm test -- --run src/components/AssetDetailDrawer.test.jsx` — 3 passed; focused eslint passed; `npm run build` succeeded. The local preview check confirmed the warning and retained counter values, with no cached rates shown.

**Residual correction.** A test first reproduced a fresh timeout retaining `interfaces_observed=true`. Migrations 024/025 now mark the newest timeout/auth/protocol failure unavailable in both update paths while preserving interface JSON. Explicit false remains authoritative even with a non-empty input array; true plus empty still clears, omitted flags remain compatible, and delayed failures cannot regress the latest state. The isolated PostgreSQL fixture passes local-upsert and shared-binding cases for all these transitions. The drawer source is unchanged and already warns/hides rates whenever the flag is false.

## Regression suites and known limits

- `dotnet test agent/Inner.Network.Agent.Tests/Inner.Network.Agent.Tests.csproj -v minimal` — 62/62 passed.
- `dotnet test agent/Inner.Agent.Windows.Tests/Inner.Agent.Windows.Tests.csproj -v minimal` — 22/22 passed.
- Backend full suite before the residual SQL/C# correction — 68/70 passed; the two failures are the existing account password reauthentication cases (500 where 200/401 are expected), outside this wave. Backend TypeScript source did not change in the residual correction; focused network tests remain 21/21 and the final SQL ran in PostgreSQL.
- Web full suite — 25/29 passed; the four known Conta/Sidebar baseline failures are outside this wave. Focused drawer tests, lint, and production build pass. No web feature source or test changed in the residual correction.
- `npx tsc --noEmit` retains only pre-existing unrelated errors in document creator/generator and `monitoring-api-client.ts`; no network-agent source errors were reported.
- Low finding 6 (retention deadline/abort/backlog matrix) is explicitly deferred; it is independent of these identity/auth/interface fixes.
- Low finding 7 remains partial: full provisioning/pairing flow, a delayed old HTTP config response and a real queued semaphore waiter are not exercised together by the current tests. The corresponding epoch guards were confirmed in independent source review.
- No production API/database, login, physical LAN, service installation, deployment, push, or publication was used. PostgreSQL remained the disposable isolated container described above.

## Final Windows package

Built with `cd agent; ./build-network-agent.ps1 -ApiBaseUrl 'https://innerworks-painelbackend.zvzr4n.easypanel.host'`. The network-specific `agent/artifacts/network-publish` directory was used; the Hyper-V publish artifacts were not touched.

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| `agent/artifacts/InnerNetworkAgent-Setup.exe` | 99,869,529 | `269FDC05DA6D4F17EF3F8D533A84AF7AB4A22D7110DD156AE371583E70C6D8D9` |
| `agent/artifacts/network-publish/distribution/InnerNetworkAgent-Setup.exe` | 99,869,529 | `269FDC05DA6D4F17EF3F8D533A84AF7AB4A22D7110DD156AE371583E70C6D8D9` |
| `agent/artifacts/Inner.Network.Agent-win-x64.zip` | 94,463,641 | `86E11E2C0F5BA77894830A3227CA9FFD912E2261581C2D6C45AAFAEC51D59931` |
| `backend/artifacts/Inner.Network.Agent-win-x64.zip` (ignored copy) | 94,463,641 | `86E11E2C0F5BA77894830A3227CA9FFD912E2261581C2D6C45AAFAEC51D59931` |

The ZIP parser found the setup executable plus the three installer scripts/docs and notices. The setup assembly's embedded `Inner.Network.Agent.Setup.AgentPackage.zip` parsed successfully and contained `appsettings.json`, `e_sqlite3.dll`, and `Inner.Network.Agent.exe`; the embedded base URL matched the requested HTTPS API base. An authenticated local Fastify route smoke returned HTTP 200 and `application/zip`, with 94,463,641 bytes and the same SHA-256 as the copied package. The package was inspected only; it was not installed.

## Parecer independente final

Revisores e implementadores usaram GPT-6 Luna. A revisão ampla inicial identificou os cinco achados registrados acima. A primeira correção fechou autorização, histórico legado e placeholders; a correção residual fechou identidade parcialmente contraditória/aliases legados e disponibilidade de interfaces após falha geral.

No commit `07575b0`, o revisor confirmou que qualquer contradição comparável impede fallback ao UID antigo e que ambos os caminhos SQL preservam o JSON e marcam indisponibilidade corretamente. O teste de persistência cobre as duas direções de contradição e aliases legados; o fixture cobre origem local e escopo compartilhado. Parecer: itens 4 e 5 endereçados, sem nova quebra Critical/High/Important no diff. O revisor não repetiu suítes nem alterou arquivos; seu parecer foi retornado por mensagem e transcrito pelo controlador.

Os limites Low 6/7 acima permanecem explícitos. Não houve deploy, migration remota, instalação do serviço ou teste em equipamento físico. O guia de implantação descreve o piloto necessário.
