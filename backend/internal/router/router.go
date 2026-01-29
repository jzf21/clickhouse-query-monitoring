package router

import (
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"github.com/actio/clickhouse-monitoring/internal/database"
	"github.com/actio/clickhouse-monitoring/internal/handlers"
	"github.com/actio/clickhouse-monitoring/internal/repository"
)

// Setup initializes the Gin router with all routes and middleware.
func Setup(db *database.ClickHouseDB) *gin.Engine {
	// Create Gin router with default middleware (Logger, Recovery)
	router := gin.Default()

	// Configure CORS
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001", "http://127.0.0.1:3001"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept"},
		AllowCredentials: true,
	}))

	// Initialize repositories
	queryLogRepo := repository.NewQueryLogRepository(db)

	// Initialize handlers
	healthHandler := handlers.NewHealthHandler(db)
	queryLogHandler := handlers.NewQueryLogHandler(queryLogRepo)

	// Health check endpoints (outside API versioning)
	router.GET("/health", healthHandler.Health)
	router.GET("/ready", healthHandler.Ready)

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		// Query log endpoints
		logs := v1.Group("/logs")
		{
			logs.GET("", queryLogHandler.GetQueryLogs)
			logs.GET("/metrics", queryLogHandler.GetAggregatedMetrics)
			logs.GET("/export", queryLogHandler.ExportCSV)
			logs.GET("/:id", queryLogHandler.GetQueryLogByID)
		}

		// Database endpoints
		v1.GET("/databases", queryLogHandler.GetDatabases)
	}

	return router
}
