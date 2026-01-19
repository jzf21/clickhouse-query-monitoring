package config

import (
	"os"
	"strconv"
	"time"
)

// Config holds all configuration for the application.
type Config struct {
	Server     ServerConfig
	ClickHouse ClickHouseConfig
}

// ServerConfig holds HTTP server configuration.
type ServerConfig struct {
	Port         string
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
}

// ClickHouseConfig holds ClickHouse connection configuration.
type ClickHouseConfig struct {
	Host     string
	Port     int
	Database string
	Username string
	Password string

	// Secure enables TLS for the connection (required for ClickHouse Cloud)
	Secure bool

	// Connection pool settings
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration

	// Query settings
	DialTimeout  time.Duration
	ReadTimeout  time.Duration
	QueryTimeout int
}

// Load creates a Config from environment variables with sensible defaults.
func Load() *Config {
	return &Config{
		Server: ServerConfig{
			Port:         getEnv("SERVER_PORT", "8080"),
			ReadTimeout:  getDurationEnv("SERVER_READ_TIMEOUT", 30*time.Second),
			WriteTimeout: getDurationEnv("SERVER_WRITE_TIMEOUT", 30*time.Second),
		},
		ClickHouse: ClickHouseConfig{
			Host:            getEnv("CLICKHOUSE_HOST", "localhost"),
			Port:            getIntEnv("CLICKHOUSE_PORT", 9000),
			Database:        getEnv("CLICKHOUSE_DATABASE", "system"),
			Username:        getEnv("CLICKHOUSE_USERNAME", "default"),
			Password:        getEnv("CLICKHOUSE_PASSWORD", ""),
			Secure:          getBoolEnv("CLICKHOUSE_SECURE", false),
			MaxOpenConns:    getIntEnv("CLICKHOUSE_MAX_OPEN_CONNS", 10),
			MaxIdleConns:    getIntEnv("CLICKHOUSE_MAX_IDLE_CONNS", 5),
			ConnMaxLifetime: getDurationEnv("CLICKHOUSE_CONN_MAX_LIFETIME", 1*time.Hour),
			DialTimeout:     getDurationEnv("CLICKHOUSE_DIAL_TIMEOUT", 10*time.Second),
			ReadTimeout:     getDurationEnv("CLICKHOUSE_READ_TIMEOUT", 30*time.Second),
			QueryTimeout:    getIntEnv("CLICKHOUSE_QUERY_TIMEOUT", 70),
		},
	}
}

// getEnv retrieves an environment variable or returns a default value.
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getIntEnv retrieves an environment variable as int or returns a default value.
func getIntEnv(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}

// getDurationEnv retrieves an environment variable as time.Duration or returns a default.
func getDurationEnv(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	return defaultValue
}

// getBoolEnv retrieves an environment variable as bool or returns a default value.
func getBoolEnv(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolVal, err := strconv.ParseBool(value); err == nil {
			return boolVal
		}
	}
	return defaultValue
}
