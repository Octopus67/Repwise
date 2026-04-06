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

## Worker Scaling (WEB_CONCURRENCY)

### Formula

```
max_workers = neon_connection_limit / (pool_size + max_overflow)
```

### Current Configuration

| Setting | Value |
|---|---|
| WEB_CONCURRENCY | 1 |
| pool_size | 5 |
| max_overflow | 10 |

### Recommended Values by Neon Tier

| Neon Tier | Connection Limit | Max Workers |
|---|---|---|
| Free | 20 | 1 |
| Launch | 100 | 6 |
| Scale | 300 | 20 |
| Business | 500 | 33 |

> **Note:** Always leave headroom for migrations, scheduler jobs, and health checks. Use 80% of the calculated max.

## Sentry Alert Rules

### Recommended Alerts

1. **Error Rate Spike**
   - Condition: Error count > 10 per minute
   - Action: Slack `#hos-alerts` + email
   - Priority: P1

2. **Performance Degradation**
   - Condition: P95 transaction duration > 2 seconds
   - Action: Slack `#hos-alerts`
   - Priority: P2

3. **New Issue Regression**
   - Condition: Previously resolved issue reappears
   - Action: Slack `#hos-alerts` + assignee email
   - Priority: P1

### Configuration Steps

1. Go to **Sentry → Alerts → Create Alert Rule**
2. Select project `repwise-api`
3. Set conditions per the rules above
4. Add action: Send notification to Slack `#hos-alerts`
5. Set frequency: notify at most once per 10 minutes
6. Save and verify with a test alert

## RTO / RPO Targets

| Metric | Target |
|---|---|
| **RTO** (Recovery Time Objective) | 1 hour |
| **RPO** (Recovery Point Objective) | 1 hour |

### Quarterly DR Drill Procedure

1. **Schedule**: First Monday of each quarter
2. **Scope**: Full restore from Neon PITR to a test branch
3. **Steps**:
   a. Create a Neon branch from 1 hour ago: `neonctl branches create --name dr-drill-$(date +%Y%m%d) --parent <branch> --point-in-time <timestamp>`
   b. Point a staging instance at the recovery branch
   c. Run smoke tests against staging (health check, login, create workout)
   d. Verify data integrity: compare row counts on key tables
   e. Document results in `docs/dr-drill-log.md`
   f. Delete the drill branch after validation
4. **Success criteria**: All smoke tests pass within 1 hour of drill start

### Neon PITR Restore Steps (Production Incident)

1. **Identify** the last-known-good timestamp before the incident
2. **Create recovery branch**:
   ```bash
   neonctl branches create \
     --name recovery-$(date +%Y%m%d-%H%M) \
     --parent main \
     --point-in-time "YYYY-MM-DDTHH:MM:SSZ"
   ```
3. **Get connection string**: `neonctl connection-string --branch recovery-...`
4. **Update Railway**: Set `DATABASE_URL` to the recovery branch connection string
5. **Redeploy**: `railway up` or trigger via dashboard
6. **Verify**: Run health check + spot-check critical data
7. **Promote**: Once confirmed, rename recovery branch to `main` or update DNS
8. **Postmortem**: Document in `docs/` within 48 hours
