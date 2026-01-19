package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/actio/clickhouse-monitoring/internal/models"
	"github.com/actio/clickhouse-monitoring/internal/repository"
)

// QueryLogHandler handles HTTP requests for query log operations.
type QueryLogHandler struct {
	repo *repository.QueryLogRepository
}

// NewQueryLogHandler creates a new QueryLogHandler instance.
func NewQueryLogHandler(repo *repository.QueryLogRepository) *QueryLogHandler {
	return &QueryLogHandler{repo: repo}
}

// GetQueryLogs handles GET /api/v1/logs
//
// Query Parameters:
//   - db_name: Filter by database name (exact match)
//   - query_id: Filter by query ID (exact match)
//   - only_failed: If "true", return only failed queries
//   - min_duration_ms: Filter queries with duration greater than this value
//   - user: Filter by user (exact match)
//   - query_contains: Filter queries containing this substring
//   - start_time: Filter queries after this time (RFC3339 format)
//   - end_time: Filter queries before this time (RFC3339 format)
//   - limit: Maximum number of records to return (default: 100, max: 1000)
//   - offset: Number of records to skip for pagination
//
// Response:
//
//	{
//	  "data": [...],
//	  "pagination": {
//	    "limit": 100,
//	    "offset": 0,
//	    "count": 50
//	  }
//	}
func (h *QueryLogHandler) GetQueryLogs(c *gin.Context) {
	// Parse query parameters into filter struct
	var filter models.QueryLogFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_parameters",
			"message": err.Error(),
		})
		return
	}

	// Call repository to get filtered query logs
	logs, err := h.repo.GetQueryLogs(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "database_error",
			"message": "Failed to retrieve query logs",
		})
		// Log the actual error for debugging (in production, use proper logging)
		// log.Printf("Error fetching query logs: %v", err)
		return
	}

	// Determine the effective limit for pagination metadata
	limit := filter.Limit
	if limit <= 0 {
		limit = 100
	} else if limit > 1000 {
		limit = 1000
	}

	// Return response with pagination metadata
	response := models.QueryLogResponse{
		Data: logs,
		Pagination: models.Pagination{
			Limit:  limit,
			Offset: filter.Offset,
			Count:  len(logs),
		},
	}

	c.JSON(http.StatusOK, response)
}

// GetQueryLogByID handles GET /api/v1/logs/:id
//
// Path Parameters:
//   - id: The query ID to retrieve
//
// Response: Single QueryLog object or 404 if not found
func (h *QueryLogHandler) GetQueryLogByID(c *gin.Context) {
	queryID := c.Param("id")
	if queryID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "missing_parameter",
			"message": "query_id is required",
		})
		return
	}

	log, err := h.repo.GetQueryLogByID(c.Request.Context(), queryID)
	if err != nil {
		// Check if it's a "not found" error
		// In a real application, you'd have a custom error type for this
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "not_found",
			"message": "Query log not found",
		})
		return
	}

	c.JSON(http.StatusOK, log)
}
