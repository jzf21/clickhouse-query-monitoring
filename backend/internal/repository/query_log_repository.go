package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/actio/clickhouse-monitoring/internal/database"
	"github.com/actio/clickhouse-monitoring/internal/models"
)

const (
	// Default and maximum limits for pagination
	defaultLimit = 1000
	maxLimit     = 10000
)

// QueryLogRepository handles database operations for query_log data.
type QueryLogRepository struct {
	db *database.ClickHouseDB
}

// NewQueryLogRepository creates a new QueryLogRepository instance.
func NewQueryLogRepository(db *database.ClickHouseDB) *QueryLogRepository {
	return &QueryLogRepository{db: db}
}

// GetQueryLogs retrieves query logs based on the provided filters.
// It dynamically builds a SQL query using parameterized placeholders to prevent SQL injection.
//
// The dynamic query building follows these principles:
// 1. Base query selects all relevant columns from system.query_log
// 2. WHERE clause is built incrementally based on which filters are set
// 3. All user-provided values are passed as parameters, never interpolated into the query
// 4. Results are ordered by event_time DESC for most recent first
func (r *QueryLogRepository) GetQueryLogs(ctx context.Context, filter models.QueryLogFilter) ([]models.QueryLog, error) {
	// Build the query dynamically based on filters
	query, args := r.buildQueryLogsQuery(filter)

	// Execute the query using database/sql interface
	rows, err := r.db.DB().QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query query_log: %w", err)
	}
	defer rows.Close()

	// Scan results into structs
	var logs []models.QueryLog
	for rows.Next() {
		var log models.QueryLog
		// Use clickhouse.ArraySet for array columns
		var databases, tables []string
		err := rows.Scan(
			&log.QueryID,
			&log.Query,
			&log.EventTime,
			&log.EventDate,
			&log.Type,
			&log.QueryDurationMs,
			&log.MemoryUsage,
			&log.ReadRows,
			&log.ReadBytes,
			&log.WrittenRows,
			&log.WrittenBytes,
			&log.ResultRows,
			&log.ResultBytes,
			&databases,
			&tables,
			&log.ExceptionCode,
			&log.Exception,
			&log.User,
			&log.ClientHostname,
			&log.HTTPUserAgent,
			&log.InitialUser,
			&log.InitialQueryID,
			&log.IsInitialQuery,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan query_log row: %w", err)
		}
		log.Databases = databases
		log.Tables = tables
		logs = append(logs, log)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating query_log rows: %w", err)
	}

	return logs, nil
}

// buildQueryLogsQuery constructs the SQL query and arguments based on the provided filters.
//
// Dynamic SQL Generation Logic:
// -----------------------------
// The function builds a parameterized query by:
//
// 1. Starting with a base SELECT statement that retrieves all relevant columns
//
// 2. Building WHERE conditions incrementally:
//   - Each filter check adds a condition only if the filter value is set (non-zero/non-empty)
//   - Conditions are collected in a slice and joined with " AND "
//   - Arguments are collected in parallel, maintaining order correspondence with placeholders
//
// 3. Using ClickHouse parameterized query syntax:
//   - ClickHouse uses positional parameters with types: {param:Type}
//   - We use a simpler approach with ? placeholders and pass args in order
//
// 4. Applying LIMIT and OFFSET for pagination:
//   - Default limit is applied if not specified
//   - Maximum limit is enforced to prevent excessive data retrieval
//
// Security Note:
// All filter values are passed as query parameters, never concatenated into the query string.
// This prevents SQL injection attacks regardless of the filter content.
func (r *QueryLogRepository) buildQueryLogsQuery(filter models.QueryLogFilter) (string, []interface{}) {
	// Base query selecting all relevant performance analysis fields
	baseQuery := `
		SELECT
			query_id,
			query,
			event_time,
			event_date,
			type,
			query_duration_ms,
			memory_usage,
			read_rows,
			read_bytes,
			written_rows,
			written_bytes,
			result_rows,
			result_bytes,
			databases,
			tables,
			exception_code,
			exception,
			user,
			client_hostname,
			http_user_agent,
			initial_user,
			initial_query_id,
			is_initial_query
		FROM system.query_log
	`

	// Collect WHERE conditions and their corresponding arguments
	var conditions []string
	var args []interface{}

	// Filter by database name (exact match)
	// Uses has() function to check if the database is in the databases array
	if filter.DBName != "" {
		conditions = append(conditions, "has(databases, ?)")
		args = append(args, filter.DBName)
	}

	// Filter by query ID (exact match)
	if filter.QueryID != "" {
		conditions = append(conditions, "query_id = ?")
		args = append(args, filter.QueryID)
	}

	// Always exclude QueryStart entries - we only want completed queries
	// QueryStart entries have no useful metrics (duration=0, memory=0, etc.)
	conditions = append(conditions, "type != 'QueryStart'")

	// Filter for failed queries only
	// A query is considered failed if:
	// - exception_code is non-zero (error during execution), OR
	// - type is 'ExceptionBeforeStart' (error before query started)
	if filter.OnlyFailed {
		conditions = append(conditions, "(exception_code != 0 OR type = 'ExceptionBeforeStart')")
		// No args needed - this is a static condition
	}

	// Filter for successful queries only
	// A query is considered successful if:
	// - type is 'QueryFinish' (completed normally), AND
	// - exception_code is 0 (no error)
	if filter.OnlySuccess {
		conditions = append(conditions, "(type = 'QueryFinish' AND exception_code = 0)")
	}

	// Filter by minimum duration (queries slower than this threshold)
	// Useful for finding slow queries that need optimization
	if filter.MinDurationMs > 0 {
		conditions = append(conditions, "query_duration_ms > ?")
		args = append(args, filter.MinDurationMs)
	}

	// Filter by user (exact match)
	if filter.User != "" {
		conditions = append(conditions, "user = ?")
		args = append(args, filter.User)
	}

	// Filter by query content (case-insensitive substring match)
	// Uses positionCaseInsensitive for efficient string search
	if filter.QueryContains != "" {
		conditions = append(conditions, "positionCaseInsensitive(query, ?) > 0")
		args = append(args, filter.QueryContains)
	}

	// Filter by query kind (Select, Insert, Create, Alter, Drop, etc.)
	if filter.QueryKind != "" {
		conditions = append(conditions, "query_kind = ?")
		args = append(args, filter.QueryKind)
	}

	// Filter by time range - start time
	if filter.StartTime != nil {
		conditions = append(conditions, "event_time >= ?")
		args = append(args, *filter.StartTime)
	}

	// Filter by time range - end time
	if filter.EndTime != nil {
		conditions = append(conditions, "event_time <= ?")
		args = append(args, *filter.EndTime)
	}

	// Build the complete query
	var queryBuilder strings.Builder
	queryBuilder.WriteString(baseQuery)

	// Add WHERE clause if we have any conditions
	if len(conditions) > 0 {
		queryBuilder.WriteString(" WHERE ")
		queryBuilder.WriteString(strings.Join(conditions, " AND "))
	}

	// Add ORDER BY - use provided sort or default to event_time DESC
	sortColumn := "event_time"
	sortOrder := "DESC"
	if filter.SortBy != "" && models.ValidSortColumns[filter.SortBy] {
		sortColumn = filter.SortBy
	}
	if filter.SortOrder == "asc" {
		sortOrder = "ASC"
	}
	queryBuilder.WriteString(fmt.Sprintf(" ORDER BY %s %s", sortColumn, sortOrder))

	// Apply pagination with LIMIT and OFFSET
	// Enforce limits to prevent excessive data retrieval
	limit := filter.Limit
	if limit <= 0 {
		limit = defaultLimit
	} else if limit > maxLimit {
		limit = maxLimit
	}

	queryBuilder.WriteString(" LIMIT ?")
	args = append(args, limit)

	// Add OFFSET for pagination
	if filter.Offset > 0 {
		queryBuilder.WriteString(" OFFSET ?")
		args = append(args, filter.Offset)
	}

	return queryBuilder.String(), args
}

// ParseColumns validates and parses the columns parameter.
// Returns the list of valid column names, or all columns if the input is empty.
func ParseColumns(columnsParam string) ([]string, error) {
	if columnsParam == "" {
		return models.AllColumns(), nil
	}

	requested := strings.Split(columnsParam, ",")
	var validated []string
	for _, col := range requested {
		col = strings.TrimSpace(col)
		if col == "" {
			continue
		}
		if !models.ValidColumns[col] {
			return nil, fmt.Errorf("invalid column: %s", col)
		}
		validated = append(validated, col)
	}

	if len(validated) == 0 {
		return nil, fmt.Errorf("at least one valid column is required")
	}

	return validated, nil
}

// GetQueryLogsDynamic retrieves query logs with dynamic column selection.
// Only the specified columns are returned in the response.
func (r *QueryLogRepository) GetQueryLogsDynamic(ctx context.Context, filter models.QueryLogFilter, columns []string) ([]map[string]interface{}, error) {
	query, args := r.buildDynamicQuery(filter, columns)

	rows, err := r.db.DB().QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query query_log: %w", err)
	}
	defer rows.Close()

	results := make([]map[string]interface{}, 0)
	for rows.Next() {
		// Create scan targets for each column
		values := make([]interface{}, len(columns))
		for i, col := range columns {
			values[i] = r.createScanTarget(col)
		}

		if err := rows.Scan(values...); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		// Build the result map
		row := make(map[string]interface{})
		for i, col := range columns {
			row[col] = r.extractValue(col, values[i])
		}
		results = append(results, row)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating query_log rows: %w", err)
	}

	return results, nil
}

// createScanTarget creates an appropriate pointer for scanning a column value.
func (r *QueryLogRepository) createScanTarget(col string) interface{} {
	switch col {
	case "query_id", "query", "type", "exception", "user", "client_hostname",
		"http_user_agent", "initial_user", "initial_query_id":
		return new(string)
	case "event_time", "event_date":
		return new(time.Time)
	case "query_duration_ms", "read_rows", "read_bytes", "written_rows",
		"written_bytes", "result_rows", "result_bytes":
		return new(uint64)
	case "memory_usage":
		return new(int64)
	case "exception_code":
		return new(int32)
	case "is_initial_query":
		return new(uint8)
	case "databases", "tables":
		return new([]string)
	default:
		return new(interface{})
	}
}

// extractValue extracts the actual value from a scan target pointer.
func (r *QueryLogRepository) extractValue(col string, ptr interface{}) interface{} {
	switch col {
	case "query_id", "query", "type", "exception", "user", "client_hostname",
		"http_user_agent", "initial_user", "initial_query_id":
		return *ptr.(*string)
	case "event_time", "event_date":
		return *ptr.(*time.Time)
	case "query_duration_ms", "read_rows", "read_bytes", "written_rows",
		"written_bytes", "result_rows", "result_bytes":
		return *ptr.(*uint64)
	case "memory_usage":
		return *ptr.(*int64)
	case "exception_code":
		return *ptr.(*int32)
	case "is_initial_query":
		return *ptr.(*uint8)
	case "databases", "tables":
		return *ptr.(*[]string)
	default:
		return ptr
	}
}

// buildDynamicQuery constructs a SQL query with dynamic column selection.
func (r *QueryLogRepository) buildDynamicQuery(filter models.QueryLogFilter, columns []string) (string, []interface{}) {
	var queryBuilder strings.Builder
	queryBuilder.WriteString("SELECT ")
	queryBuilder.WriteString(strings.Join(columns, ", "))
	queryBuilder.WriteString(" FROM system.query_log")

	// Collect WHERE conditions and their corresponding arguments
	var conditions []string
	var args []interface{}

	if filter.DBName != "" {
		conditions = append(conditions, "has(databases, ?)")
		args = append(args, filter.DBName)
	}

	if filter.QueryID != "" {
		conditions = append(conditions, "query_id = ?")
		args = append(args, filter.QueryID)
	}

	// Always exclude QueryStart entries - we only want completed queries
	conditions = append(conditions, "type != 'QueryStart'")

	if filter.OnlyFailed {
		conditions = append(conditions, "(exception_code != 0 OR type = 'ExceptionBeforeStart')")
	}

	if filter.OnlySuccess {
		conditions = append(conditions, "(type = 'QueryFinish' AND exception_code = 0)")
	}

	if filter.MinDurationMs > 0 {
		conditions = append(conditions, "query_duration_ms > ?")
		args = append(args, filter.MinDurationMs)
	}

	if filter.User != "" {
		conditions = append(conditions, "user = ?")
		args = append(args, filter.User)
	}

	if filter.QueryContains != "" {
		conditions = append(conditions, "positionCaseInsensitive(query, ?) > 0")
		args = append(args, filter.QueryContains)
	}

	if filter.StartTime != nil {
		conditions = append(conditions, "event_time >= ?")
		args = append(args, *filter.StartTime)
	}

	if filter.EndTime != nil {
		conditions = append(conditions, "event_time <= ?")
		args = append(args, *filter.EndTime)
	}

	if len(conditions) > 0 {
		queryBuilder.WriteString(" WHERE ")
		queryBuilder.WriteString(strings.Join(conditions, " AND "))
	}

	queryBuilder.WriteString(" ORDER BY event_time DESC")

	limit := filter.Limit
	if limit <= 0 {
		limit = defaultLimit
	} else if limit > maxLimit {
		limit = maxLimit
	}

	queryBuilder.WriteString(" LIMIT ?")
	args = append(args, limit)

	if filter.Offset > 0 {
		queryBuilder.WriteString(" OFFSET ?")
		args = append(args, filter.Offset)
	}

	return queryBuilder.String(), args
}

// GetDatabases retrieves all database names from ClickHouse.
func (r *QueryLogRepository) GetDatabases(ctx context.Context) ([]string, error) {
	query := `SELECT name FROM system.databases ORDER BY name`

	rows, err := r.db.DB().QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query databases: %w", err)
	}
	defer rows.Close()

	var databases []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("failed to scan database name: %w", err)
		}
		databases = append(databases, name)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating database rows: %w", err)
	}

	return databases, nil
}

// GetQueryLogByID retrieves a single query log entry by its query_id.
// Note: query_id may not be unique across time, so this returns the most recent match.
func (r *QueryLogRepository) GetQueryLogByID(ctx context.Context, queryID string) (*models.QueryLog, error) {
	query := `
		SELECT
			query_id,
			query,
			event_time,
			event_date,
			type,
			query_duration_ms,
			memory_usage,
			read_rows,
			read_bytes,
			written_rows,
			written_bytes,
			result_rows,
			result_bytes,
			databases,
			tables,
			exception_code,
			exception,
			user,
			client_hostname,
			http_user_agent,
			initial_user,
			initial_query_id,
			is_initial_query
		FROM system.query_log
		WHERE query_id = ?
		ORDER BY event_time DESC
		LIMIT 1
	`

	row := r.db.DB().QueryRowContext(ctx, query, queryID)

	var log models.QueryLog
	var databases, tables []string
	err := row.Scan(
		&log.QueryID,
		&log.Query,
		&log.EventTime,
		&log.EventDate,
		&log.Type,
		&log.QueryDurationMs,
		&log.MemoryUsage,
		&log.ReadRows,
		&log.ReadBytes,
		&log.WrittenRows,
		&log.WrittenBytes,
		&log.ResultRows,
		&log.ResultBytes,
		&databases,
		&tables,
		&log.ExceptionCode,
		&log.Exception,
		&log.User,
		&log.ClientHostname,
		&log.HTTPUserAgent,
		&log.InitialUser,
		&log.InitialQueryID,
		&log.IsInitialQuery,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get query log by ID: %w", err)
	}
	log.Databases = databases
	log.Tables = tables

	return &log, nil
}

// BucketSize represents a time bucket configuration for aggregation.
type BucketSize struct {
	Interval string // ClickHouse interval string (e.g., "1 SECOND", "1 MINUTE")
	Label    string // Human-readable label (e.g., "1s", "1m")
}

// determineBucketSize selects the optimal bucket size based on the time range.
// This ensures charts have a reasonable number of data points (roughly 60-120).
func determineBucketSize(startTime, endTime *time.Time) BucketSize {
	if startTime == nil || endTime == nil {
		// Default to 1 minute if no time range specified
		return BucketSize{Interval: "1 MINUTE", Label: "1m"}
	}

	duration := endTime.Sub(*startTime)

	switch {
	case duration <= 5*time.Minute:
		// Up to 5 min: bucket by 5 seconds (~60 points max)
		return BucketSize{Interval: "5 SECOND", Label: "5s"}
	case duration <= 30*time.Minute:
		// Up to 30 min: bucket by 30 seconds (~60 points max)
		return BucketSize{Interval: "30 SECOND", Label: "30s"}
	case duration <= 2*time.Hour:
		// Up to 2 hours: bucket by 1 minute (~120 points max)
		return BucketSize{Interval: "1 MINUTE", Label: "1m"}
	case duration <= 6*time.Hour:
		// Up to 6 hours: bucket by 3 minutes (~120 points max)
		return BucketSize{Interval: "3 MINUTE", Label: "3m"}
	case duration <= 24*time.Hour:
		// Up to 1 day: bucket by 15 minutes (~96 points max)
		return BucketSize{Interval: "15 MINUTE", Label: "15m"}
	case duration <= 7*24*time.Hour:
		// Up to 1 week: bucket by 1 hour (~168 points max)
		return BucketSize{Interval: "1 HOUR", Label: "1h"}
	case duration <= 30*24*time.Hour:
		// Up to 30 days: bucket by 6 hours (~120 points max)
		return BucketSize{Interval: "6 HOUR", Label: "6h"}
	default:
		// More than 30 days: bucket by 1 day
		return BucketSize{Interval: "1 DAY", Label: "1d"}
	}
}

// GetAggregatedMetrics retrieves time-bucketed aggregated metrics for charts.
// It automatically determines the bucket size based on the time range.
func (r *QueryLogRepository) GetAggregatedMetrics(ctx context.Context, filter models.QueryLogFilter) ([]models.QueryLogMetrics, BucketSize, error) {
	bucket := determineBucketSize(filter.StartTime, filter.EndTime)

	// Build aggregation query
	query, args := r.buildAggregationQuery(filter, bucket.Interval)

	rows, err := r.db.DB().QueryContext(ctx, query, args...)
	if err != nil {
		return nil, bucket, fmt.Errorf("failed to query aggregated metrics: %w", err)
	}
	defer rows.Close()

	var metrics []models.QueryLogMetrics
	for rows.Next() {
		var m models.QueryLogMetrics
		err := rows.Scan(
			&m.TimeBucket,
			&m.TotalQueries,
			&m.AvgDurationMs,
			&m.MaxDurationMs,
			&m.AvgMemoryUsage,
			&m.MaxMemoryUsage,
			&m.TotalReadBytes,
			&m.TotalWrittenBytes,
			&m.FailedQueries,
		)
		if err != nil {
			return nil, bucket, fmt.Errorf("failed to scan aggregated metrics row: %w", err)
		}
		metrics = append(metrics, m)
	}

	if err := rows.Err(); err != nil {
		return nil, bucket, fmt.Errorf("error iterating aggregated metrics rows: %w", err)
	}

	return metrics, bucket, nil
}

// buildAggregationQuery constructs the SQL query for time-bucketed aggregation.
func (r *QueryLogRepository) buildAggregationQuery(filter models.QueryLogFilter, bucketInterval string) (string, []interface{}) {
	// Build the aggregation query with the specified bucket interval
	// Note: bucketInterval is a controlled value from determineBucketSize, not user input
	baseQuery := fmt.Sprintf(`
		SELECT
			toStartOfInterval(event_time, INTERVAL %s) as time_bucket,
			COUNT(*) as total_queries,
			AVG(query_duration_ms) as avg_duration_ms,
			MAX(query_duration_ms) as max_duration_ms,
			AVG(memory_usage) as avg_memory_usage,
			MAX(memory_usage) as max_memory_usage,
			SUM(read_bytes) as total_read_bytes,
			SUM(written_bytes) as total_written_bytes,
			SUM(CASE WHEN exception_code != 0 OR type = 'ExceptionBeforeStart' THEN 1 ELSE 0 END) as failed_queries
		FROM system.query_log
	`, bucketInterval)

	var conditions []string
	var args []interface{}

	// Always exclude QueryStart entries - we only want completed queries
	conditions = append(conditions, "type != 'QueryStart'")

	// Apply the same filters as regular queries
	if filter.DBName != "" {
		conditions = append(conditions, "has(databases, ?)")
		args = append(args, filter.DBName)
	}

	if filter.OnlyFailed {
		conditions = append(conditions, "(exception_code != 0 OR type = 'ExceptionBeforeStart')")
	}

	if filter.OnlySuccess {
		conditions = append(conditions, "(type = 'QueryFinish' AND exception_code = 0)")
	}

	if filter.MinDurationMs > 0 {
		conditions = append(conditions, "query_duration_ms > ?")
		args = append(args, filter.MinDurationMs)
	}

	if filter.User != "" {
		conditions = append(conditions, "user = ?")
		args = append(args, filter.User)
	}

	if filter.QueryContains != "" {
		conditions = append(conditions, "positionCaseInsensitive(query, ?) > 0")
		args = append(args, filter.QueryContains)
	}

	if filter.StartTime != nil {
		conditions = append(conditions, "event_time >= ?")
		args = append(args, *filter.StartTime)
	}

	if filter.EndTime != nil {
		conditions = append(conditions, "event_time <= ?")
		args = append(args, *filter.EndTime)
	}

	var queryBuilder strings.Builder
	queryBuilder.WriteString(baseQuery)

	if len(conditions) > 0 {
		queryBuilder.WriteString(" WHERE ")
		queryBuilder.WriteString(strings.Join(conditions, " AND "))
	}

	queryBuilder.WriteString(" GROUP BY time_bucket ORDER BY time_bucket ASC")

	return queryBuilder.String(), args
}
