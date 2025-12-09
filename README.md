# saiqa-server

Nodejs backend with motia framework

## Configuration

### Port Configuration
The server runs on port **3002** to avoid conflicts with the client application which runs on port 3000.

- Environment variable: `PORT=3002` (set in `.env` and `.env.example`)
- Package.json scripts are configured with `--port 3002` flag for both development and production

### CORS Configuration
The server is configured to accept requests from the client application:

- CORS origin: `http://localhost:3000` (client port)
- Credentials: `true` (allows cookies and authentication headers)

### Environment Setup
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. The server will automatically use port 3002 as configured in the environment and package.json scripts

## Available Scripts

- `npm run dev` - Start development server on port 3002
- `npm start` - Start production server on port 3002
- `npm run migrate:up` - Run database migrations
- `npm run migrate:down` - Rollback database migrations
- `npm run verify:migrations` - Verify migration status
- `npm run test:cookies` - Run cookie utility tests

## API Endpoints

The server provides the following API endpoints:

- `GET /api/users` - Get users list
- `POST /api/auth/login` - User authentication

## Testing

See [TESTING.md](./TESTING.md) for detailed testing instructions and manual test scripts.

## Development

This is a motia-based backend server. The motia framework automatically discovers and loads Step files to create the API endpoints.