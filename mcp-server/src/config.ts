import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  // Backend API
  backendUrl: string;

  // HTTP Server
  port: number;

  // AI Provider
  aiBaseUrl: string;
  aiApiKey: string;
  aiModel: string;

  // Chart Generation
  quickchartUrl: string;
}

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] ?? defaultValue;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadConfig(): Config {
  return {
    backendUrl: getEnvVar('BACKEND_URL', 'http://localhost:8080'),
    port: parseInt(getEnvVar('PORT', '3001'), 10),
    aiBaseUrl: getEnvVar('AI_BASE_URL', 'https://api.openai.com/v1'),
    aiApiKey: getEnvVar('AI_API_KEY', ''),
    aiModel: getEnvVar('AI_MODEL', 'gpt-4o'),
    quickchartUrl: getEnvVar('QUICKCHART_URL', 'https://quickchart.io'),
  };
}

export const config = loadConfig();
