# GitHub Secrets Template for WiFi Sentry

Store the following secrets in your repository Settings → Secrets and variables → Actions → New repository secret

- `MONGODB_URI` - Production MongoDB connection string (use Atlas SRV string)
- `MONGODB_URI_TEST` - Integration test MongoDB connection string (Atlas test DB)
- `MONGODB_USER` - Optional DB user (if not embedded in URI)
- `MONGODB_PASSWORD` - Optional DB password
- `ATLAS_PROJECT_ID` - Optional Atlas project id for automation

Notes:
- Prefer separate credentials for tests and production.
- For Atlas, create a user with restricted privileges for the app.
- Use IP allowlists or VPC peering for production clusters.
