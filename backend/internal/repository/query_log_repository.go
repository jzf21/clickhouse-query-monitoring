package repository

import (
	"context"
	"fmt"
	"strings"

	"github.com/actio/clickhouse-monitoring/internal/database"
	"github.com/actio/clickhouse-monitoring/internal/models"
)

const (
	// Default and maximum limits for pagination
	defaultLimit = 100
	maxLimit     = 1000
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

	// Filter for failed queries only
	// A query is considered failed if:
	// - exception_code is non-zero (error during execution), OR
	// - type is 'ExceptionBeforeStart' (error before query started)
	if filter.OnlyFailed {
		conditions = append(conditions, "(exception_code != 0 OR type = 'ExceptionBeforeStart')")
		// No args needed - this is a static condition
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

	// Add ORDER BY for consistent, predictable results (most recent first)
	queryBuilder.WriteString(" ORDER BY event_time DESC")

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
