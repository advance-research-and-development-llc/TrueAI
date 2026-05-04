# GitHub Actions Workflows

This directory contains GitHub Actions workflows for automated security scanning and code quality analysis.

## Workflows

### 1. SonarCloud Analysis (`sonarcloud.yml`)
Analyzes code quality and security vulnerabilities using SonarCloud.

**Status**: ✅ Configured with conditional execution

**Required Configuration**:
- **Repository Variables**:
  - `SONAR_PROJECT_KEY` - Your SonarCloud project key
  - `SONAR_ORGANIZATION` - Your SonarCloud organization key
- **Repository Secrets**:
  - `SONAR_TOKEN` - SonarCloud authentication token

**Setup Instructions**:
1. Create a free account at https://sonarcloud.io
2. Import your GitHub repository
3. Navigate to your project → Information (bottom-left menu)
4. Copy the Project Key and Organization Key
5. Add them as repository variables in GitHub Settings → Secrets and variables → Actions → Variables
6. Generate a token at https://sonarcloud.io/account/security
7. Add it as `SONAR_TOKEN` in repository secrets

**Note**: This workflow will be skipped if the required variables are not configured.

---

### 2. Datree Kubernetes Policy Check (`datree.yml`)
Validates Kubernetes manifests against security policies.

**Status**: ✅ Configured with conditional execution

**Required Configuration**:
- **Repository Secrets**:
  - `DATREE_TOKEN` - Datree authentication token

**Setup Instructions**:
1. Sign up at https://hub.datree.io/signup
2. Get your account token from https://hub.datree.io/setup/account-token
3. Add it as `DATREE_TOKEN` in repository secrets

**Note**: This workflow will be skipped if the token is not configured.

---

### 3. APIsec Security Scan (`apisec-scan.yml`)
Performs automated API security testing.

**Status**: ✅ Configured with conditional execution

**Required Configuration**:
- **Repository Secrets**:
  - `apisec_username` - APIsec account username
  - `apisec_password` - APIsec account password

**Setup Instructions**:
1. Schedule a demo at https://www.apisec.ai/request-a-demo
2. Register at https://cloud.apisec.ai/#/signup
3. Register your API (see https://www.youtube.com/watch?v=MK3Xo9Dbvac)
4. Get credentials from APIsec Project → Configurations → Integrations → CI-CD → GitHub Actions
5. Add credentials as repository secrets

**Note**: This workflow will be skipped if credentials are not configured.

---

### 4. Fortify AST Scan (`fortify.yml`)
Performs Static Application Security Testing (SAST) and Software Composition Analysis (SCA).

**Status**: ✅ Working (FoD configuration removed)

**Required Configuration**:
- **Repository Variables**:
  - `SSC_URL` - Fortify Software Security Center URL
- **Repository Secrets**:
  - `SSC_TOKEN` - SSC CIToken for authentication
  - `SC_CLIENT_AUTH_TOKEN` - ScanCentral SAST client authentication token (if SAST scan enabled)
  - `DEBRICKED_TOKEN` - Debricked token (if SCA scan enabled)

**Setup Instructions**:
1. Contact Fortify sales or start a free trial at https://www.microfocus.com/en-us/cyberres/application-security/fortify
2. Configure SSC instance and get credentials
3. Add credentials as repository secrets and variables

**Note**: The FoD (Fortify on Demand) section has been removed to prevent login attempts without proper configuration.

---

## How to Configure Repository Secrets and Variables

### Adding Secrets:
1. Go to your repository on GitHub
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add the secret name and value
5. Click "Add secret"

### Adding Variables:
1. Go to your repository on GitHub
2. Navigate to Settings → Secrets and variables → Actions → Variables tab
3. Click "New repository variable"
4. Add the variable name and value
5. Click "Add variable"

---

## Workflow Behavior

All security scanning workflows are configured to skip execution if their required secrets/variables are not configured. This prevents workflow failures when the external services are not set up.

To enable a workflow:
1. Set up an account with the respective service
2. Add the required secrets/variables to your repository
3. The workflow will automatically run on the next trigger event

---

## Support

For issues with specific workflows:
- **SonarCloud**: https://community.sonarsource.com/
- **Datree**: https://github.com/datreeio/action-datree/issues
- **APIsec**: https://www.apisec.ai/contact-us
- **Fortify**: https://www.microfocus.com/en-us/cyberres/application-security/support
