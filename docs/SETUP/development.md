# Development Setup Guide

Follow this guide to set up a local development environment for WiFi Sentry.

## 📋 Prerequisites

- **Node.js**: Version 18.0.0 or higher.
- **npm**: Version 9.0.0 or higher.
- **Git**: For version control.
- **MongoDB**: (Optional) A local MongoDB instance or a MongoDB Atlas URI. If not provided, some features may be limited.
- **WiFi Adapter**: A WiFi adapter that supports monitor mode is recommended for full threat detection capabilities, but not strictly required for frontend development.

## 🚀 Quick Start

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/your-repo/wifi-sentry.git
    cd wifi-sentry
    ```

2.  **Run the setup script**:
    ```bash
    npm run setup
    ```
    This script will:
    - Verify your Node.js version.
    - Install backend and frontend dependencies.
    - Create a `.env` file from `.env.example`.
    - Create `web-app/.env.local`.

3.  **Configure environment variables**:
    Edit the `.env` file in the root directory.
    ```bash
    nano .env
    ```
    At minimum, update `ADMIN_PASSWORD`.

4.  **Start development mode**:
    ```bash
    npm run dev:all
    ```
    This command uses `concurrently` to start both the backend (Fastify) and the frontend (Next.js).

5.  **Access the application**:
    - Frontend: [http://localhost:3000](http://localhost:3000)
    - Backend API: [http://localhost:3000/api](http://localhost:3000/api) (Proxied via Next.js in development)

## 🛠️ Development Workflow

### Project Structure

- `server.js`: Backend entry point (Fastify).
- `routes/`: Backend API routes.
- `web-app/`: Frontend application (Next.js).
- `web-app/src/components/`: Reusable React components.
- `web-app/src/app/`: Next.js App Router pages.
- `docs/`: Project documentation.

### Adding a Backend Route

1.  Create a new file in `routes/` (e.g., `routes/my-feature.js`).
2.  Export an async function that receives the `fastify` instance.
    ```javascript
    module.exports = async function (fastify) {
      fastify.get('/api/my-feature', async (request, reply) => {
        return { message: 'Hello from my feature!' };
      });
    };
    ```
3.  Register the route in `server.js`:
    ```javascript
    fastify.register(require('./routes/my-feature'));
    ```

### Adding a Frontend Component

1.  Create a new file in `web-app/src/components/` (e.g., `MyComponent.tsx`).
2.  Import and use it in your pages within `web-app/src/app/`.

### Linting and Formatting

Run the linter to ensure code quality:
```bash
npm run lint
```

## 🧪 Running Tests

WiFi Sentry uses Jest for unit testing and Mocha for integration testing.

```bash
# Run all tests
npm test

# Run integration tests
npm run test:integration
```

## ❓ Troubleshooting

If you encounter issues, please refer to the [Common Issues](../TROUBLESHOOTING/common-issues.md) guide.
