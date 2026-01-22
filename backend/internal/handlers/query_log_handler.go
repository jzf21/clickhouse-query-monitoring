package handlers

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

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
//   - columns: Comma-separated list of columns to return (if omitted, returns all columns)
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
//
// When columns parameter is provided, response includes:
//
//	{
//	  "data": [...],
//	  "columns": ["query_id", "query", ...],
//	  "pagination": {...}
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

	// Determine the effective limit for pagination metadata
	limit := filter.Limit
	if limit <= 0 {
		limit = 100
	} else if limit > 1000 {
		limit = 1000
	}

	// If columns parameter is provided, use dynamic column query
	if filter.Columns != "" {
		columns, err := repository.ParseColumns(filter.Columns)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "invalid_columns",
				"message": err.Error(),
			})
			return
		}

		logs, err := h.repo.GetQueryLogsDynamic(c.Request.Context(), filter, columns)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "database_error",
				"message": "Failed to retrieve query logs",
			})
			return
		}

		response := models.QueryLogDynamicResponse{
			Data:    logs,
			Columns: columns,
			Pagination: models.Pagination{
				Limit:  limit,
				Offset: filter.Offset,
				Count:  len(logs),
			},
		}

		c.JSON(http.StatusOK, response)
		return
	}

	// Call repository to get filtered query logs (full columns)
	logs, err := h.repo.GetQueryLogs(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "database_error",
			"message": "Failed to retrieve query logs",
		})
		return
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

// GetDatabases handles GET /api/v1/databases
//
// Response: List of database names
func (h *QueryLogHandler) GetDatabases(c *gin.Context) {
	databases, err := h.repo.GetDatabases(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "database_error",
			"message": "Failed to retrieve databases",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"databases": databases,
	})
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

// GetAggregatedMetrics handles GET /api/v1/logs/metrics
//
// Returns time-bucketed aggregated metrics for chart visualization.
// The bucket size is automatically determined based on the time range:
//   - <= 5 min: 5 second buckets
//   - <= 30 min: 30 second buckets
//   - <= 2 hours: 1 minute buckets
//   - <= 6 hours: 3 minute buckets
//   - <= 1 day: 15 minute buckets
//   - <= 1 week: 1 hour buckets
//   - <= 30 days: 6 hour buckets
//   - > 30 days: 1 day buckets
//
// Query Parameters: Same as GetQueryLogs (except limit/offset/columns)
//
// Response:
//
//	{
//	  "data": [
//	    {
//	      "time_bucket": "2024-01-22T10:00:00Z",
//	      "total_queries": 150,
//	      "avg_duration_ms": 45.5,
//	      "max_duration_ms": 1200,
//	      "avg_memory_usage": 1048576,
//	      "max_memory_usage": 10485760,
//	      "total_read_bytes": 50000000,
//	      "total_written_bytes": 1000000,
//	      "failed_queries": 2
//	    },
//	    ...
//	  ],
//	  "bucket_size": "1m",
//	  "bucket_label": "1 minute"
//	}
func (h *QueryLogHandler) GetAggregatedMetrics(c *gin.Context) {
	var filter models.QueryLogFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_parameters",
			"message": err.Error(),
		})
		return
	}

	metrics, bucket, err := h.repo.GetAggregatedMetrics(c.Request.Context(), filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "database_error",
			"message": "Failed to retrieve aggregated metrics",
		})
		return
	}

	response := models.QueryLogMetricsResponse{
		Data:        metrics,
		BucketSize:  bucket.Label,
		BucketLabel: bucket.Interval,
	}

	c.JSON(http.StatusOK, response)
}

// ExportCSV handles GET /api/v1/logs/export
//
// Exports query logs as CSV file with user-specified columns and limit.
//
// Query Parameters:
//   - columns: Comma-separated list of columns to export (required)
//   - limit: Maximum number of records to export (default: 1000, max: 100000)
//   - All other filter parameters from GetQueryLogs
//
// Response: CSV file download
func (h *QueryLogHandler) ExportCSV(c *gin.Context) {
	var filter models.QueryLogFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_parameters",
			"message": err.Error(),
		})
		return
	}

	// Parse columns - required for CSV export
	if filter.Columns == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "missing_columns",
			"message": "columns parameter is required for CSV export",
		})
		return
	}

	columns, err := repository.ParseColumns(filter.Columns)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_columns",
			"message": err.Error(),
		})
		return
	}

	// Set higher limit for CSV export (max 100000)
	if filter.Limit <= 0 {
		filter.Limit = 1000
	} else if filter.Limit > 100000 {
		filter.Limit = 100000
	}

	// Fetch the data
	logs, err := h.repo.GetQueryLogsDynamic(c.Request.Context(), filter, columns)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "database_error",
			"message": "Failed to retrieve query logs for export",
		})
		return
	}

	// Generate filename with timestamp
	filename := fmt.Sprintf("query_logs_%s.csv", time.Now().Format("20060102_150405"))

	// Set headers for CSV download
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))

	// Create CSV writer
	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	// Write header row
	if err := writer.Write(columns); err != nil {
		return
	}

	// Write data rows
	for _, row := range logs {
		record := make([]string, len(columns))
		for i, col := range columns {
			record[i] = formatCSVValue(row[col])
		}
		if err := writer.Write(record); err != nil {
			return
		}
	}
}

// formatCSVValue converts a value to a CSV-friendly string representation.
func formatCSVValue(v interface{}) string {
	if v == nil {
		return ""
	}

	switch val := v.(type) {
	case string:
		return val
	case time.Time:
		return val.Format(time.RFC3339)
	case []string:
		return strings.Join(val, ";")
	case *[]string:
		if val != nil {
			return strings.Join(*val, ";")
		}
		return ""
	case int, int32, int64, uint, uint32, uint64, uint8:
		return fmt.Sprintf("%d", val)
	case float32, float64:
		return strconv.FormatFloat(val.(float64), 'f', -1, 64)
	default:
		return fmt.Sprintf("%v", val)
	}
}
