# Docker Commands Quick Reference

## Build & Start
```powershell
# Build and start all services
docker-compose up --build -d

# Start without rebuilding
docker-compose up -d

# Rebuild specific service
docker-compose up --build -d backend
docker-compose up --build -d frontend
```

## Stop & Remove
```powershell
# Stop all containers
docker-compose down

# Stop and remove volumes (WARNING: deletes database data)
docker-compose down -v
```

## View Logs
```powershell
# View all logs
docker-compose logs

# Follow logs (live)
docker-compose logs -f

# Specific service logs
docker logs chatbot-backend --tail 50
docker logs chatbot-frontend --tail 50
docker logs chatbot-mysql --tail 50
```

## Cleanup (Free Space)
```powershell
# Run the cleanup script
.\docker-cleanup.ps1

# Manual cleanup commands
docker system prune -a -f              # Remove unused images
docker builder prune -f                 # Remove build cache
docker volume prune -f                  # Remove unused volumes
docker image prune -a -f               # Remove all unused images
```

## Check Status
```powershell
# View running containers
docker-compose ps

# View disk usage
docker system df

# View images
docker images
```

## Rebuild from Scratch
```powershell
# Complete rebuild (recommended after major changes)
docker-compose down
docker system prune -a -f
docker-compose up --build -d
```

## Optimizations Applied

### Backend Dockerfile
- ✅ Using `python:3.13-slim` (50% smaller)
- ✅ Multi-stage build with dependency caching
- ✅ Non-root user for security
- ✅ Health checks
- ✅ Optimized `.dockerignore`

### Frontend Dockerfile  
- ✅ Multi-stage build (build + nginx)
- ✅ Optimized layer caching
- ✅ Non-root user for security
- ✅ Health checks
- ✅ Optimized `.dockerignore`

### docker-compose.yml
- ✅ Removed deprecated `version` field
- ✅ Added health checks for all services
- ✅ Added service dependencies with conditions
- ✅ Named images for easier cleanup
- ✅ Optimized restart policies

## Tips
1. **Run cleanup weekly**: `.\docker-cleanup.ps1` to free space
2. **Use named builds**: Images are now tagged as `chatbot-backend:latest` and `chatbot-frontend:latest`
3. **Watch logs during development**: `docker-compose logs -f backend`
4. **Check health**: All services have health checks, use `docker-compose ps` to see status
