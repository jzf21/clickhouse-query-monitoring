package models

import (
	"time"
)

// QueryLog represents a row from the ClickHouse system.query_log table.
// This struct includes the most relevant fields for performance analysis.
//
// ClickHouse system.query_log reference:
// https://clickhouse.com/docs/en/operations/system-tables/query_log
type QueryLog struct {
	// QueryID is a unique identifier for the query
	QueryID string `json:"query_id" ch:"query_id"`

	// Query is the actual SQL query text
	Query string `json:"query" ch:"query"`

	// EventTime is when the query event occurred
	EventTime time.Time `json:"event_time" ch:"event_time"`

	// EventDate is the date portion of EventTime (used for partitioning)
	EventDate time.Time `json:"event_date" ch:"event_date"`

	// Type indicates the query event type:
	// 1 = QueryStart, 2 = QueryFinish, 3 = ExceptionBeforeStart, 4 = ExceptionWhileProcessing
	Type string `json:"type" ch:"type"`

	// QueryDurationMs is the total query execution time in milliseconds
	QueryDurationMs uint64 `json:"query_duration_ms" ch:"query_duration_ms"`

	// MemoryUsage is the peak memory usage during query execution in bytes
	MemoryUsage int64 `json:"memory_usage" ch:"memory_usage"`

	// ReadRows is the total number of rows read from all tables and table functions
	ReadRows uint64 `json:"read_rows" ch:"read_rows"`

	// ReadBytes is the total number of bytes read from all tables and table functions
	ReadBytes uint64 `json:"read_bytes" ch:"read_bytes"`

	// WrittenRows is the number of rows written (for INSERT queries)
	WrittenRows uint64 `json:"written_rows" ch:"written_rows"`

	// WrittenBytes is the number of bytes written (for INSERT queries)
	WrittenBytes uint64 `json:"written_bytes" ch:"written_bytes"`

	// ResultRows is the number of rows in the result
	ResultRows uint64 `json:"result_rows" ch:"result_rows"`

	// ResultBytes is the size of the result in bytes
	ResultBytes uint64 `json:"result_bytes" ch:"result_bytes"`

	// Databases is the list of databases accessed by the query
	Databases []string `json:"databases" ch:"databases"`

	// Tables is the list of tables accessed by the query
	Tables []string `json:"tables" ch:"tables"`

	// ExceptionCode is non-zero if an exception occurred
	ExceptionCode int32 `json:"exception_code" ch:"exception_code"`

	// Exception is the exception message if an error occurred
	Exception string `json:"exception" ch:"exception"`

	// User is the user who executed the query
	User string `json:"user" ch:"user"`

	// ClientHostname is the hostname of the client that made the query
	ClientHostname string `json:"client_hostname" ch:"client_hostname"`

	// HTTPUserAgent is the User-Agent header for HTTP interface queries
	HTTPUserAgent string `json:"http_user_agent" ch:"http_user_agent"`

	// InitialUser is the user who initiated the query (for distributed queries)
	InitialUser string `json:"initial_user" ch:"initial_user"`

	// InitialQueryID is the query_id of the initial query (for distributed queries)
	InitialQueryID string `json:"initial_query_id" ch:"initial_query_id"`

	// IsInitialQuery is true if this is the initial query (not a distributed sub-query)
	IsInitialQuery uint8 `json:"is_initial_query" ch:"is_initial_query"`
}

// QueryLogFilter contains optional filters for querying the query_log table.
// All filters are optional - only non-zero/non-empty values are applied.
type QueryLogFilter struct {
	// DBName filters by exact database name match
	DBName string `form:"db_name"`

	// QueryID filters by exact query ID match
	QueryID string `form:"query_id"`

	// OnlyFailed when true, returns only queries with exceptions
	// (exception_code != 0 OR type = 'ExceptionBeforeStart')
	OnlyFailed bool `form:"only_failed"`

	// MinDurationMs filters queries with duration greater than this value
	MinDurationMs uint64 `form:"min_duration_ms"`

	// User filters by exact user match
	User string `form:"user"`

	// QueryContains filters queries containing this substring (case-insensitive)
	QueryContains string `form:"query_contains"`

	// StartTime filters queries after this time
	StartTime *time.Time `form:"start_time" time_format:"2006-01-02T15:04:05Z07:00"`

	// EndTime filters queries before this time
	EndTime *time.Time `form:"end_time" time_format:"2006-01-02T15:04:05Z07:00"`

	// Limit is the maximum number of records to return (default: 100, max: 1000)
	Limit int `form:"limit"`

	// Offset is the number of records to skip for pagination
	Offset int `form:"offset"`
}

// QueryLogResponse wraps the query results with pagination metadata.
type QueryLogResponse struct {
	Data       []QueryLog `json:"data"`
	Pagination Pagination `json:"pagination"`
}

// Pagination contains pagination metadata for list responses.
type Pagination struct {
	Limit  int `json:"limit"`
	Offset int `json:"offset"`
	Count  int `json:"count"` // Number of records returned in this response
}
