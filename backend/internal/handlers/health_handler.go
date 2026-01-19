package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/actio/clickhouse-monitoring/internal/database"
)

// HealthHandler handles health check endpoints.
type HealthHandler struct {
	db *database.ClickHouseDB
}

// NewHealthHandler creates a new HealthHandler instance.
func NewHealthHandler(db *database.ClickHouseDB) *HealthHandler {
	return &HealthHandler{db: db}
}

// Health handles GET /health
// Returns basic health status without checking dependencies.
func (h *HealthHandler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
	})
}

// Ready handles GET /ready
// Performs a comprehensive health check including database connectivity.
func (h *HealthHandler) Ready(c *gin.Context) {
	if err := h.db.HealthCheck(c.Request.Context()); err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"status":  "unhealthy",
			"error":   "database_unavailable",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "ready",
		"checks": gin.H{
			"database": "ok",
		},
	})
}
