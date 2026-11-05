-- Executar apenas em PostgreSQL de teste isolado após aplicar a migration 027.
\set ON_ERROR_STOP 1
BEGIN;
DO $$
DECLARE c1 uuid := '11111111-1111-1111-1111-111111111111';
        c2 uuid := '22222222-2222-2222-2222-222222222222';
        t1 uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
        t2 uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
        result text; count_rows integer;
BEGIN
  IF has_function_privilege('authenticated', 'claim_glpi_report_preview(uuid,date,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must not reserve previews directly';
  END IF;
  IF has_function_privilege('anon', 'fail_glpi_report_preview(uuid,date,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not release previews directly';
  END IF;
  result := claim_glpi_report_preview(c1, '2026-11-01', t1);
  IF result <> 'claimed' THEN RAISE EXCEPTION 'first claim: %', result; END IF;
  result := claim_glpi_report_preview(c1, '2026-11-01', t2);
  IF result <> 'busy' THEN RAISE EXCEPTION 'overlapping claim: %', result; END IF;
  PERFORM fail_glpi_report_preview(c1, '2026-11-01', t2);
  IF (SELECT lease_token FROM glpi_report_previews WHERE company_id = c1 AND period_start = '2026-11-01') <> t1 THEN RAISE EXCEPTION 'wrong token released claim'; END IF;
  PERFORM fail_glpi_report_preview(c1, '2026-11-01', t1);
  result := claim_glpi_report_preview(c1, '2026-11-01', t2);
  IF result <> 'cooldown' THEN RAISE EXCEPTION 'failure backoff: %', result; END IF;
  IF (SELECT attempts FROM glpi_report_previews WHERE company_id = c1 AND period_start = '2026-11-01') <> 1 THEN RAISE EXCEPTION 'failure count not saved'; END IF;
  UPDATE glpi_report_previews SET next_attempt_at = now() - interval '1 second' WHERE company_id = c1 AND period_start = '2026-11-01';
  result := claim_glpi_report_preview(c1, '2026-11-01', t2);
  IF result <> 'claimed' THEN RAISE EXCEPTION 'retry claim: %', result; END IF;
  UPDATE glpi_report_previews SET state = 'ready', metrics = '{}'::jsonb, analysis = 'teste', generated_at = now(), lease_token = NULL, lease_until = NULL
    WHERE company_id = c1 AND period_start = '2026-11-01' AND lease_token = t1;
  GET DIAGNOSTICS count_rows = ROW_COUNT;
  IF count_rows <> 0 THEN RAISE EXCEPTION 'expired token saved preview'; END IF;
  UPDATE glpi_report_previews SET state = 'ready', metrics = '{}'::jsonb, analysis = 'teste', generated_at = now(), lease_token = NULL, lease_until = NULL
    WHERE company_id = c1 AND period_start = '2026-11-01' AND lease_token = t2;
  result := claim_glpi_report_preview(c1, '2026-11-01', t1);
  IF result <> 'ready' THEN RAISE EXCEPTION 'saved preview not reused: %', result; END IF;
  result := claim_glpi_report_preview(c2, '2026-11-01', t1);
  IF result <> 'claimed' THEN RAISE EXCEPTION 'another company must have independent preview: %', result; END IF;
END $$;
ROLLBACK;
