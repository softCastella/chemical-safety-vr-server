import { createHash } from "node:crypto";

export function hashFirebaseInstallationId(installationId) {
  return createHash("sha256").update(installationId).digest("hex");
}

export function createStarlightReleasePushRepository(pool) {
  return {
    async upsertSubscription(subscription) {
      await pool.execute(
        `INSERT INTO starlight_release_push_subscriptions
          (installation_id_hash, installation_id, locale, source, medium, campaign, consent_version, consented_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
         ON DUPLICATE KEY UPDATE
          installation_id = VALUES(installation_id),
          locale = VALUES(locale), source = VALUES(source), medium = VALUES(medium),
          campaign = VALUES(campaign), consent_version = VALUES(consent_version),
          consented_at = VALUES(consented_at), status = 'active', expired_at = NULL`,
        [
          hashFirebaseInstallationId(subscription.installationId),
          subscription.installationId,
          subscription.locale,
          subscription.source,
          subscription.medium,
          subscription.campaign,
          subscription.consentVersion,
          subscription.consentedAt,
        ],
      );
    },

    async listSubscriptions() {
      const [rows] = await pool.execute(
        `SELECT id, locale, source, medium, campaign, consent_version,
                consented_at, status, last_success_at, expired_at
           FROM starlight_release_push_subscriptions
          ORDER BY consented_at DESC, id DESC`,
      );
      return rows.map((row) => ({
        ...row,
        consented_at: new Date(row.consented_at).toISOString(),
        last_success_at: row.last_success_at ? new Date(row.last_success_at).toISOString() : null,
        expired_at: row.expired_at ? new Date(row.expired_at).toISOString() : null,
      }));
    },
  };
}
