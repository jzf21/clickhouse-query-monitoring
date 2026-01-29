import { queryLogsTools } from './query-logs.js';
import { metricsTools } from './metrics.js';
import { analysisTools } from './analysis.js';
import { visualizationTools } from './visualization.js';

// Combine all tools
export const allTools = [
  ...queryLogsTools,
  ...metricsTools,
  ...analysisTools,
  ...visualizationTools,
];

// Create a map for easy lookup
export const toolsMap = new Map(allTools.map((tool) => [tool.name, tool]));

// Export individual tool modules
export { queryLogsTools } from './query-logs.js';
export { metricsTools } from './metrics.js';
export { analysisTools } from './analysis.js';
export { visualizationTools } from './visualization.js';
