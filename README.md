# LogisticMap - Interactive Map with MongoDB Persistence

A full-stack web application for creating and managing camps and rectangular areas on an interactive map. Features persistent storage using MongoDB with automatic data saving and Docker-based deployment.

## Features

- Interactive map interface using Leaflet
- Create polygon-based camps
- Add rectangular areas within camps with rotation support
- MongoDB persistence with automatic data saving
- Real-time map editing with validation
- Docker-based deployment
- Development and production environments

## Architecture

- **Frontend**: React with TypeScript, Leaflet maps, Server-Side Rendering
- **Backend**: Node.js/Express API with MongoDB integration
- **Database**: MongoDB with data persistence
- **Reverse Proxy**: Nginx for routing
- **Map Tiles**: Custom tile server for Israel region

## Quick Start

### Development Mode

```bash
# Start all services in development mode
docker-compose -f docker-compose.dev.yml up --build

# Access the application
open http://localhost:80
```

### Production Mode

```bash
# Start all services in production mode
docker-compose up --build

# Access the application
open http://localhost:80
```

## Services

- **Frontend** (port 3000): React SSR application
- **Backend** (port 5001): Express API server
- **MongoDB** (port 27017): Database with persistent storage
- **Tileserver** (port 8080): Map tile server
- **Nginx** (port 80): Reverse proxy

## Database Persistence

The MongoDB database is configured with:
- Persistent volumes for data storage
- Automatic initialization scripts
- Graceful shutdown handling for data integrity
- Regular data persistence during runtime

Data is automatically saved:
- When shapes are created, edited, or deleted
- During graceful container shutdown
- Data is restored when containers start up

## API Endpoints

### Camps
- `GET /api/camps` - Get all camps
- `POST /api/camps` - Create a new camp
- `PUT /api/camps/:id` - Update a camp
- `DELETE /api/camps/:id` - Delete a camp

### Rectangle Areas
- `POST /api/camps/:id/rectangles` - Add rectangle to camp
- `PUT /api/camps/:id/rectangles/:rectId` - Update rectangle in camp
- `DELETE /api/camps/:id/rectangles/:rectId` - Delete rectangle from camp

## Map Features

### Creating Camps
1. Click "Enter Edit Mode"
2. Use the polygon tool to draw camp boundaries
3. Enter a name for the camp
4. Camp is automatically saved to database

### Adding Rectangle Areas
1. Select a camp from the edit panel
2. Use the rectangle tool to draw areas within camp boundaries
3. Enter a name for the area
4. Area is automatically saved to database

### Editing Areas
- Click "Edit" next to any area to modify its rotation
- Use the edit tools to resize/move rectangles
- All changes are automatically saved

## Development

### File Structure
```
logisticmap/
├── frontend/           # React frontend application
├── backend/           # Express API server
│   ├── models/        # MongoDB schemas
│   ├── routes/        # API routes
│   └── server.js      # Main server file
├── mongodb-init/      # Database initialization scripts
├── proxy/            # Nginx configuration
├── tileserver/       # Map tile data and config
└── docker-compose.yml # Production configuration
```

### Environment Variables

Backend environment variables:
- `NODE_ENV`: development/production
- `MONGODB_URI`: MongoDB connection string
- `PORT`: API server port

### Adding New Features

1. Update MongoDB schemas in `backend/models/`
2. Add API routes in `backend/routes/`
3. Update frontend API client in `frontend/app/services/api.ts`
4. Modify React components as needed

## Troubleshooting

### Database Issues
- Check MongoDB logs: `docker logs mongodb`
- Verify data persistence: `docker volume ls`
- Restart services: `docker-compose restart mongodb backend`

### Map Not Loading
- Check tileserver: `http://localhost:8080`
- Verify proxy routing: `docker logs nginx`
- Check browser console for errors

### API Connection Issues
- Verify backend health: `http://localhost:5001/health`
- Check network connectivity between containers
- Review nginx configuration for API routing

