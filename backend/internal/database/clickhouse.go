package database

import (
	"context"
	"crypto/tls"
	"database/sql"
	"fmt"
	"time"

	"github.com/ClickHouse/clickhouse-go/v2"

	"github.com/actio/clickhouse-monitoring/internal/config"
)

// ClickHouseDB wraps the ClickHouse connection with additional functionality.
type ClickHouseDB struct {
	db  *sql.DB
	cfg config.ClickHouseConfig
}

// NewClickHouseDB creates and initializes a new ClickHouse database connection.
// It validates the connection by executing a ping operation.
// For ClickHouse Cloud, set Secure=true to enable TLS over HTTP protocol.
func NewClickHouseDB(cfg config.ClickHouseConfig) (*ClickHouseDB, error) {
	// Determine protocol based on Secure setting
	// ClickHouse Cloud uses HTTPS (port 8443), self-hosted typically uses native (port 9000)
	protocol := clickhouse.Native
	if cfg.Secure {
		protocol = clickhouse.HTTP
	}

	opts := &clickhouse.Options{
		Addr:     []string{fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)},
		Protocol: protocol,
		Auth: clickhouse.Auth{
			Database: cfg.Database,
			Username: cfg.Username,
			Password: cfg.Password,
		},
		Settings: clickhouse.Settings{
			// Limit memory usage per query to prevent OOM
			"max_memory_usage": 1000000000, // 1GB
			// Set query timeout from config
			"max_execution_time": cfg.QueryTimeout,
		},
		DialTimeout: cfg.DialTimeout,
		Compression: &clickhouse.Compression{
			Method: clickhouse.CompressionLZ4,
		},
	}

	// Enable TLS for secure connections (required for ClickHouse Cloud)
	if cfg.Secure {
		opts.TLS = &tls.Config{}
	}

	// Use OpenDB which returns *sql.DB - works better with HTTP protocol
	db := clickhouse.OpenDB(opts)

	// Configure connection pool
	db.SetMaxOpenConns(cfg.MaxOpenConns)
	db.SetMaxIdleConns(cfg.MaxIdleConns)
	db.SetConnMaxLifetime(cfg.ConnMaxLifetime)

	// Verify the connection is working
	ctx, cancel := context.WithTimeout(context.Background(), cfg.DialTimeout)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping clickhouse: %w", err)
	}

	return &ClickHouseDB{
		db:  db,
		cfg: cfg,
	}, nil
}

// DB returns the underlying *sql.DB connection.
func (c *ClickHouseDB) DB() *sql.DB {
	return c.db
}

// Close closes the database connection.
func (c *ClickHouseDB) Close() error {
	return c.db.Close()
}

// Ping checks if the database connection is still alive.
func (c *ClickHouseDB) Ping(ctx context.Context) error {
	return c.db.PingContext(ctx)
}

// HealthCheck performs a comprehensive health check on the database connection.
func (c *ClickHouseDB) HealthCheck(ctx context.Context) error {
	// First, check basic connectivity
	if err := c.db.PingContext(ctx); err != nil {
		return fmt.Errorf("ping failed: %w", err)
	}

	// Then verify we can execute a simple query
	row := c.db.QueryRowContext(ctx, "SELECT 1")
	var result int
	if err := row.Scan(&result); err != nil {
		return fmt.Errorf("health check query failed: %w", err)
	}

	return nil
}

// QueryContext executes a query and returns rows.
func (c *ClickHouseDB) QueryContext(ctx context.Context, query string, args ...interface{}) (*sql.Rows, error) {
	return c.db.QueryContext(ctx, query, args...)
}

// QueryRowContext executes a query that returns a single row.
func (c *ClickHouseDB) QueryRowContext(ctx context.Context, query string, args ...interface{}) *sql.Row {
	return c.db.QueryRowContext(ctx, query, args...)
}

// QueryWithTimeout executes a query with a specified timeout.
func (c *ClickHouseDB) QueryWithTimeout(
	ctx context.Context,
	timeout time.Duration,
	query string,
	args ...interface{},
) (*sql.Rows, error) {
	queryCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	return c.db.QueryContext(queryCtx, query, args...)
}
