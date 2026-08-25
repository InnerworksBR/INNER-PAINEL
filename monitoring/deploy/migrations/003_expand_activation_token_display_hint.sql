START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825203102_ExpandActivationTokenDisplayHint') THEN
        ALTER TABLE monitoring.activation_tokens
            ALTER COLUMN display_hint TYPE character varying(255);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825203102_ExpandActivationTokenDisplayHint') THEN
        INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
        VALUES ('20260825203102_ExpandActivationTokenDisplayHint', '8.0.10');
    END IF;
END $EF$;

COMMIT;
