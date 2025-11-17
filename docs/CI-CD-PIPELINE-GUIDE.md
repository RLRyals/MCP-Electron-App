# CI/CD Pipeline Guide
## Database Admin Server - MCP Writing System

## Overview

This guide provides comprehensive CI/CD (Continuous Integration / Continuous Deployment) setup for the database-admin-server. It includes GitHub Actions workflows for automated testing, building, and deployment to staging and production environments.

**Related Documents**:
- [Phase 7 Deployment Guide](./PHASE-7-DEPLOYMENT-GUIDE.md)
- [Monitoring & Observability Guide](./MONITORING-OBSERVABILITY-GUIDE.md)

---

## Table of Contents

1. [Pipeline Overview](#pipeline-overview)
2. [GitHub Actions Workflows](#github-actions-workflows)
3. [Testing Pipeline](#testing-pipeline)
4. [Build Pipeline](#build-pipeline)
5. [Deployment Pipeline](#deployment-pipeline)
6. [Environment Management](#environment-management)
7. [Security Scanning](#security-scanning)
8. [Notifications](#notifications)
9. [Troubleshooting](#troubleshooting)

---

## Pipeline Overview

### Pipeline Stages

```
┌─────────────┐
│   Trigger   │ ← Push to branch, PR, manual trigger
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────┐
│          CONTINUOUS INTEGRATION          │
├─────────────────────────────────────────┤
│  1. Checkout Code                       │
│  2. Install Dependencies                │
│  3. Lint & Code Quality Checks          │
│  4. Run Unit Tests                      │
│  5. Run Integration Tests               │
│  6. Generate Coverage Report            │
│  7. Security Scanning (npm audit, Snyk) │
│  8. Build Docker Image                  │
└──────┬──────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│      CONTINUOUS DEPLOYMENT (Staging)     │
├─────────────────────────────────────────┤
│  1. Push Docker Image to Registry       │
│  2. Deploy to Staging Environment       │
│  3. Run E2E Tests in Staging            │
│  4. Performance Tests                   │
│  5. Security Audit                      │
│  6. Generate Test Reports               │
└──────┬──────────────────────────────────┘
       │
       ▼ (Manual Approval Required)
┌─────────────────────────────────────────┐
│    CONTINUOUS DEPLOYMENT (Production)    │
├─────────────────────────────────────────┤
│  1. Create Deployment Tag               │
│  2. Deploy to Production                │
│  3. Health Check Verification           │
│  4. Smoke Tests                         │
│  5. Monitor for 24 Hours                │
│  6. Send Notifications                  │
└─────────────────────────────────────────┘
```

### Branch Strategy

- **`main`**: Production-ready code
- **`develop`**: Integration branch for features
- **`feature/*`**: Feature development branches
- **`hotfix/*`**: Emergency fixes for production

### Trigger Conditions

- **Push to `main`**: Deploy to production (with approval)
- **Push to `develop`**: Deploy to staging
- **Pull Request**: Run tests and build checks
- **Manual Trigger**: `workflow_dispatch` for on-demand deployments

---

## GitHub Actions Workflows

### Main CI/CD Workflow

**File**: `.github/workflows/database-admin-server-cicd.yml`

```yaml
name: Database Admin Server CI/CD

on:
  push:
    branches:
      - main
      - develop
    paths:
      - 'src/mcps/database-admin-server/**'
      - '.github/workflows/database-admin-server-cicd.yml'
  pull_request:
    branches:
      - main
      - develop
    paths:
      - 'src/mcps/database-admin-server/**'
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deployment environment'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production

env:
  NODE_VERSION: '18'
  DOCKER_REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}/database-admin-server

jobs:
  # ==================== TESTING ====================
  lint:
    name: Lint Code
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run ESLint
        run: npm run lint

      - name: Run Prettier
        run: npm run format:check

  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit -- --coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
          flags: unit-tests
          name: unit-test-coverage

  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: testuser
          POSTGRES_PASSWORD: testpass
          POSTGRES_DB: testdb
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run database migrations
        env:
          DATABASE_URL: postgresql://testuser:testpass@localhost:5432/testdb
        run: npm run migrate:up

      - name: Run integration tests
        env:
          DATABASE_URL: postgresql://testuser:testpass@localhost:5432/testdb
        run: npm run test:integration

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: integration-test-results
          path: test-results/
          retention-days: 7

  # ==================== SECURITY ====================
  security-scan:
    name: Security Scanning
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run npm audit
        run: npm audit --audit-level=moderate
        continue-on-error: true

      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high
        continue-on-error: true

      - name: Upload Snyk results to GitHub Code Scanning
        uses: github/codeql-action/upload-sarif@v2
        if: always()
        with:
          sarif_file: snyk.sarif

  # ==================== BUILD ====================
  build:
    name: Build Docker Image
    runs-on: ubuntu-latest
    needs: [lint, unit-tests, integration-tests]
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
      image-digest: ${{ steps.build.outputs.digest }}

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.DOCKER_REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.DOCKER_REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=sha,prefix={{branch}}-

      - name: Build and push Docker image
        id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./docker/mcp-writing-servers-templates/Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            NODE_ENV=production
            VERSION=${{ github.sha }}

      - name: Scan Docker image
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ env.DOCKER_REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy scan results
        uses: github/codeql-action/upload-sarif@v2
        if: always()
        with:
          sarif_file: 'trivy-results.sarif'

  # ==================== DEPLOY TO STAGING ====================
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: [build, security-scan]
    if: github.ref == 'refs/heads/develop' || github.event.inputs.environment == 'staging'
    environment:
      name: staging
      url: https://staging.example.com

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Deploy to staging server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: ${{ secrets.STAGING_USER }}
          key: ${{ secrets.STAGING_SSH_KEY }}
          script: |
            cd /opt/mcp-writing-servers
            docker-compose pull mcp-writing-servers
            docker-compose up -d mcp-writing-servers
            docker-compose logs -f --tail=50 mcp-writing-servers

      - name: Wait for health check
        run: |
          for i in {1..30}; do
            if curl -f http://${{ secrets.STAGING_HOST }}:3010/health; then
              echo "Service is healthy"
              exit 0
            fi
            echo "Waiting for service to be healthy... ($i/30)"
            sleep 10
          done
          echo "Service failed to become healthy"
          exit 1

      - name: Run smoke tests
        run: npm run test:smoke -- --host=${{ secrets.STAGING_HOST }}

  # ==================== E2E TESTS IN STAGING ====================
  e2e-tests:
    name: E2E Tests (Staging)
    runs-on: ubuntu-latest
    needs: deploy-staging

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run E2E tests
        env:
          TEST_HOST: ${{ secrets.STAGING_HOST }}
          TEST_PORT: 3010
        run: npm run test:e2e

      - name: Upload E2E test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-test-results
          path: test-results/e2e/
          retention-days: 7

  # ==================== PERFORMANCE TESTS ====================
  performance-tests:
    name: Performance Tests (Staging)
    runs-on: ubuntu-latest
    needs: deploy-staging

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Install autocannon
        run: npm install -g autocannon

      - name: Run query performance test
        run: |
          autocannon -c 100 -d 60 -p 10 \
            -m POST \
            -H "Content-Type: application/json" \
            -b '{"table":"books","limit":50}' \
            http://${{ secrets.STAGING_HOST }}:3010/api/db/query \
            --json > perf-query.json

      - name: Run insert performance test
        run: |
          autocannon -c 50 -d 30 -p 10 \
            -m POST \
            -H "Content-Type: application/json" \
            -b '{"table":"test_data","data":{"name":"test","value":123}}' \
            http://${{ secrets.STAGING_HOST }}:3010/api/db/insert \
            --json > perf-insert.json

      - name: Analyze performance results
        run: |
          node -e "
            const queryResults = require('./perf-query.json');
            const insertResults = require('./perf-insert.json');

            console.log('Query Performance:');
            console.log('  P95 Latency:', queryResults.latency.p95, 'ms');
            console.log('  Requests/sec:', queryResults.requests.average);

            console.log('\\nInsert Performance:');
            console.log('  P95 Latency:', insertResults.latency.p95, 'ms');
            console.log('  Requests/sec:', insertResults.requests.average);

            // Fail if performance targets not met
            if (queryResults.latency.p95 > 100) {
              console.error('Query P95 latency exceeds threshold!');
              process.exit(1);
            }
          "

      - name: Upload performance results
        uses: actions/upload-artifact@v4
        with:
          name: performance-test-results
          path: perf-*.json
          retention-days: 30

  # ==================== DEPLOY TO PRODUCTION ====================
  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: [e2e-tests, performance-tests]
    if: github.ref == 'refs/heads/main' || github.event.inputs.environment == 'production'
    environment:
      name: production
      url: https://api.example.com

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Create deployment tag
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          TAG="deploy-$(date +%Y%m%d-%H%M%S)"
          git tag -a $TAG -m "Production deployment $TAG"
          git push origin $TAG

      - name: Create pre-deployment backup
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.PRODUCTION_HOST }}
          username: ${{ secrets.PRODUCTION_USER }}
          key: ${{ secrets.PRODUCTION_SSH_KEY }}
          script: |
            docker exec writing-postgres pg_dump -U writer mcp_writing_db > backup_pre_deployment_$(date +%Y%m%d_%H%M%S).sql

      - name: Deploy to production server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.PRODUCTION_HOST }}
          username: ${{ secrets.PRODUCTION_USER }}
          key: ${{ secrets.PRODUCTION_SSH_KEY }}
          script: |
            cd /opt/mcp-writing-servers
            docker-compose pull mcp-writing-servers
            docker-compose stop mcp-writing-servers
            docker-compose up -d mcp-writing-servers

      - name: Wait for health check
        run: |
          for i in {1..60}; do
            if curl -f http://${{ secrets.PRODUCTION_HOST }}:3010/health; then
              echo "Service is healthy"
              exit 0
            fi
            echo "Waiting for service to be healthy... ($i/60)"
            sleep 10
          done
          echo "Service failed to become healthy"
          exit 1

      - name: Run production smoke tests
        run: npm run test:smoke -- --host=${{ secrets.PRODUCTION_HOST }}

      - name: Monitor for initial errors
        run: |
          sleep 60
          ERROR_COUNT=$(curl -s http://${{ secrets.PRODUCTION_HOST }}:3010/metrics | grep 'db_admin_errors_total' | awk '{sum+=$2} END {print sum}')
          if [ "$ERROR_COUNT" -gt 10 ]; then
            echo "Error count exceeds threshold: $ERROR_COUNT"
            exit 1
          fi

  # ==================== NOTIFICATIONS ====================
  notify:
    name: Send Notifications
    runs-on: ubuntu-latest
    needs: [deploy-production]
    if: always()

    steps:
      - name: Send Slack notification
        uses: slackapi/slack-github-action@v1
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
          payload: |
            {
              "text": "Database Admin Server Deployment",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*Deployment Status:* ${{ needs.deploy-production.result }}\n*Branch:* ${{ github.ref_name }}\n*Commit:* ${{ github.sha }}\n*Author:* ${{ github.actor }}"
                  }
                }
              ]
            }

      - name: Create GitHub Release
        if: github.ref == 'refs/heads/main' && needs.deploy-production.result == 'success'
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: v${{ github.run_number }}
          release_name: Release v${{ github.run_number }}
          body: |
            ## Database Admin Server Release

            Deployed to production: ${{ github.event.head_commit.timestamp }}

            **Changes:**
            ${{ github.event.head_commit.message }}

            **Commit:** ${{ github.sha }}
          draft: false
          prerelease: false
```

---

## Testing Pipeline

### Unit Tests

**Configuration**: `package.json`

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=src/.*\\.test\\.js$",
    "test:integration": "jest --testPathPattern=tests/integration",
    "test:e2e": "jest --testPathPattern=tests/e2e",
    "test:smoke": "jest --testPathPattern=tests/smoke",
    "test:performance": "autocannon",
    "test:coverage": "jest --coverage"
  }
}
```

**Jest Configuration**: `jest.config.js`

```javascript
module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/index.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
};
```

### Integration Tests

**Example**: `tests/integration/db-crud.test.js`

```javascript
const { Pool } = require('pg');
const DatabaseAdminServer = require('../../src/mcps/database-admin-server');

describe('Database CRUD Integration Tests', () => {
  let pool;
  let server;

  beforeAll(async () => {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    server = new DatabaseAdminServer(pool);
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
    await pool.end();
  });

  describe('Query Records', () => {
    it('should query records from books table', async () => {
      const result = await server.queryRecords({
        table: 'books',
        limit: 10
      });

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeLessThanOrEqual(10);
    });

    it('should handle WHERE conditions', async () => {
      const result = await server.queryRecords({
        table: 'books',
        where: { status: 'published' },
        limit: 50
      });

      expect(result.success).toBe(true);
      result.data.forEach(book => {
        expect(book.status).toBe('published');
      });
    });
  });

  describe('Insert Record', () => {
    it('should insert a new record', async () => {
      const result = await server.insertRecord({
        table: 'test_data',
        data: {
          name: 'Test Book',
          author: 'Test Author'
        }
      });

      expect(result.success).toBe(true);
      expect(result.insertedId).toBeDefined();
    });
  });
});
```

### E2E Tests

**Example**: `tests/e2e/api-workflow.test.js`

```javascript
const axios = require('axios');

const API_BASE = process.env.TEST_HOST
  ? `http://${process.env.TEST_HOST}:${process.env.TEST_PORT}`
  : 'http://localhost:3010';

describe('End-to-End API Workflow', () => {
  let testRecordId;

  it('should complete full CRUD workflow', async () => {
    // 1. Create
    const createResponse = await axios.post(`${API_BASE}/api/db/insert`, {
      table: 'test_books',
      data: { title: 'E2E Test Book', author_id: 1 }
    });
    expect(createResponse.data.success).toBe(true);
    testRecordId = createResponse.data.insertedId;

    // 2. Read
    const readResponse = await axios.post(`${API_BASE}/api/db/query`, {
      table: 'test_books',
      where: { id: testRecordId }
    });
    expect(readResponse.data.success).toBe(true);
    expect(readResponse.data.data[0].title).toBe('E2E Test Book');

    // 3. Update
    const updateResponse = await axios.post(`${API_BASE}/api/db/update`, {
      table: 'test_books',
      where: { id: testRecordId },
      data: { title: 'Updated E2E Test Book' }
    });
    expect(updateResponse.data.success).toBe(true);

    // 4. Delete
    const deleteResponse = await axios.post(`${API_BASE}/api/db/delete`, {
      table: 'test_books',
      where: { id: testRecordId }
    });
    expect(deleteResponse.data.success).toBe(true);
  });
});
```

---

## Build Pipeline

### Docker Multi-Stage Build

See the Dockerfile in [Phase 7 Deployment Guide](./PHASE-7-DEPLOYMENT-GUIDE.md#docker-deployment).

### Build Optimization

```yaml
# Use BuildKit cache
- name: Build with cache
  uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

---

## Deployment Pipeline

### Environment Variables

Store secrets in GitHub Secrets:

- `STAGING_HOST`: Staging server hostname
- `STAGING_USER`: Staging SSH username
- `STAGING_SSH_KEY`: Staging SSH private key
- `PRODUCTION_HOST`: Production server hostname
- `PRODUCTION_USER`: Production SSH username
- `PRODUCTION_SSH_KEY`: Production SSH private key
- `SLACK_WEBHOOK_URL`: Slack notification webhook
- `SNYK_TOKEN`: Snyk security scanning token

### Deployment Approval

Configure environment protection rules:

```yaml
# GitHub Repository Settings → Environments → production
# Add required reviewers before deployment
environment:
  name: production
  # Requires manual approval
```

---

## Environment Management

### Environment Files

**Staging**: `.env.staging`
```bash
NODE_ENV=staging
DATABASE_URL=postgresql://writer:${DB_PASSWORD}@staging-db:6432/mcp_writing_db
BACKUP_DIR=/var/backups/staging
LOG_LEVEL=debug
```

**Production**: `.env.production`
```bash
NODE_ENV=production
DATABASE_URL=postgresql://writer:${DB_PASSWORD}@prod-db:6432/mcp_writing_db
BACKUP_DIR=/var/backups/production
LOG_LEVEL=info
```

---

## Security Scanning

### npm Audit

```bash
npm audit --audit-level=moderate
```

### Snyk Integration

```yaml
- name: Run Snyk scan
  uses: snyk/actions/node@master
  env:
    SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

### Container Scanning

```yaml
- name: Scan Docker image with Trivy
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ env.IMAGE_NAME }}
    format: 'sarif'
```

---

## Notifications

### Slack Integration

```yaml
- name: Notify Slack
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK_URL }}
    payload: |
      {
        "text": "Deployment completed successfully! ✅"
      }
```

### Email Notifications

Configure in GitHub repository settings or use actions:

```yaml
- name: Send email notification
  uses: dawidd6/action-send-mail@v3
  with:
    server_address: smtp.gmail.com
    server_port: 465
    username: ${{ secrets.SMTP_USERNAME }}
    password: ${{ secrets.SMTP_PASSWORD }}
    subject: Deployment Status
    body: Deployment to ${{ github.ref }} completed
    to: team@example.com
    from: ci@example.com
```

---

## Troubleshooting

### Pipeline Failures

**Issue**: Tests failing in CI but passing locally

**Solutions**:
- Check environment variables
- Verify database connection
- Review test logs in artifacts
- Run tests with `--verbose` flag

**Issue**: Docker build fails

**Solutions**:
- Check Dockerfile syntax
- Verify base image availability
- Review build logs
- Clear build cache: `docker buildx prune`

**Issue**: Deployment fails health check

**Solutions**:
- Increase health check timeout
- Check service logs
- Verify environment variables
- Ensure database is accessible

---

## Best Practices

1. **Keep secrets in GitHub Secrets**, never commit to repository
2. **Test locally** before pushing to repository
3. **Use semantic versioning** for releases
4. **Monitor deployments** for at least 24 hours
5. **Document rollback procedures** and test regularly
6. **Review security scan results** before deployment
7. **Maintain test coverage** above 80%
8. **Use feature flags** for gradual rollouts

---

**Document Version**: 1.0
**Last Updated**: 2025-11-17
**Author**: FictionLab Team
**Status**: Active
