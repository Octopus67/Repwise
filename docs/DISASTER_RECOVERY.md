# Disaster Recovery & Uptime Monitoring

## Uptime Monitoring (UptimeRobot)

### Setup
1. Create account at [UptimeRobot](https://uptimerobot.com)
2. Add HTTP(s) monitor:
   - URL: `https://<RAILWAY_URL>/api/v1/health`
   - Interval: 5 minutes
   - Alert contacts: team email + Slack webhook
3. Add keyword monitor (optional):
   - Check response contains `"status":"ok"`

### Alert Channels
- Email: team distribution list
- Slack: `#hos-alerts` channel via webhook

## Railway Rollback SOP

### Automated (via CI)
Deploy failures trigger automatic rollback in `.github/workflows/deploy.yml`:
1. Health check fails after 10 retries
2. Previous commit is redeployed via `railway up`
3. Slack notification sent to `#hos-alerts`

### Manual Rollback
```bash
# Option 1: Redeploy previous commit
git checkout <previous-sha>
railway up

# Option 2: Railway dashboard
# Settings → Deployments → click "Redeploy" on last healthy deployment
```

## Neon Database Recovery (PITR)

Neon supports Point-in-Time Recovery on paid plans.

### Steps
1. Go to Neon Console → Project → Branches
2. Create branch from a point in time before the incident
3. Update `DATABASE_URL` in Railway to point to the recovery branch
4. Verify data integrity
5. Once confirmed, optionally promote the recovery branch

### Backup Strategy
- Neon retains 7 days of WAL history (Pro plan)
- For critical releases, create a named branch before deploying:
  ```bash
  neonctl branches create --name pre-release-$(date +%Y%m%d)
  ```

## Incident Response Checklist

1. **Detect** — UptimeRobot alert or user report
2. **Assess** — Check Railway logs: `railway logs`
3. **Mitigate** — Rollback if deploy-related, scale if load-related
4. **Communicate** — Post in `#hos-alerts`
5. **Resolve** — Fix root cause, deploy fix through normal CI/CD
6. **Postmortem** — Document in `docs/` within 48 hours

## Sentry Security Configuration (Audit fix 10.13)

- **Allowed Domains**: Configure in Sentry dashboard → Settings → Security → Allowed Domains. Restrict DSN usage to `*.repwise.app` and `localhost` (dev only).
- **Rate Limits**: Set per-key rate limits to prevent abuse of the DSN.
- **Sensitive Data Scrubbing**: Ensure PII scrubbing is enabled in Sentry project settings.