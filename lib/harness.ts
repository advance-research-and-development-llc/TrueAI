import { webSearch } from './tools/web-search';
import { listFiles, readFile, writeFile } from './tools/file-system';
import { getSystemInfo, getStorageInfo, getSystemSummary } from './tools/system-info';
import { parseCSV, calculateStats } from './tools/data-analysis';

export interface HarnessToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  handler: (params: any) => Promise<string>;
}

export interface HarnessManifest {
  name: string;
  version: string;
  harness_type: string;
  description?: string;
  author?: string;
  homepage?: string;
  license?: string;
  tools: HarnessToolDefinition[];
  system_prompt_injection?: string;
  ui_components?: string[];
  required_permissions?: string[];
}

export const CODE_ASSISTANT_HARNESS: HarnessManifest = {
  name: 'Code Assistant',
  version: '2.0.0',
  harness_type: 'code-assistant',
  description: 'Tools for code execution, file management, and GitHub integration',
  author: 'TrueAI Team',
  tools: [
    {
      name: 'execute_code',
      description: 'Execute JavaScript code safely in a sandboxed environment',
      parameters: {
        language: { type: 'string', enum: ['javascript', 'python'] },
        code: { type: 'string', description: 'Code to execute' },
      },
      handler: async (params) => {
        try {
          if (params.language === 'javascript') {
            const result = Function('"use strict"; return (' + params.code + ')')();
            return JSON.stringify({ output: String(result), success: true });
          }
          return JSON.stringify({ error: 'Python execution not supported in sandbox', success: false });
        } catch (error) {
          return JSON.stringify({ error: String(error), success: false });
        }
      },
    },
    {
      name: 'list_files',
      description: 'List files in a directory relative to the app document directory',
      parameters: {
        path: { type: 'string', description: 'Directory path (relative to document directory)' },
      },
      handler: async (params) => {
        const result = await listFiles({ path: params.path });
        return JSON.stringify(result);
      },
    },
    {
      name: 'read_file',
      description: 'Read file contents from the app document directory',
      parameters: {
        path: { type: 'string', description: 'File path (relative to document directory)' },
      },
      handler: async (params) => {
        const result = await readFile({ path: params.path });
        return JSON.stringify(result);
      },
    },
    {
      name: 'write_file',
      description: 'Write content to a file in the app document directory',
      parameters: {
        path: { type: 'string', description: 'File path (relative to document directory)' },
        content: { type: 'string', description: 'Content to write' },
      },
      handler: async (params) => {
        const result = await writeFile({ path: params.path, content: params.content });
        return JSON.stringify(result);
      },
    },
  ],
  system_prompt_injection: 'You are a helpful code assistant. Help users write, debug, and optimize code. You can execute JavaScript code, and manage files in the app document directory.',
  required_permissions: ['read_files', 'write_files', 'execute_code'],
};

export const RESEARCH_AGENT_HARNESS: HarnessManifest = {
  name: 'Research Agent',
  version: '2.0.0',
  harness_type: 'research-agent',
  description: 'Web search, note-taking, and citation tools for research',
  author: 'TrueAI Team',
  tools: [
    {
      name: 'web_search',
      description: 'Search the web for information using DuckDuckGo',
      parameters: {
        query: { type: 'string', description: 'Search query' },
        results: { type: 'number', description: 'Number of results (1-10)', default: 5 },
      },
      handler: async (params) => {
        const result = await webSearch({
          query: params.query,
          results: Math.min(params.results || 5, 10),
        });
        return JSON.stringify(result);
      },
    },
    {
      name: 'save_note',
      description: 'Save a research note to the app document directory',
      parameters: {
        title: { type: 'string', description: 'Note title (used as filename)' },
        content: { type: 'string', description: 'Note content' },
      },
      handler: async (params) => {
        const filename = `notes/${params.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
        const result = await writeFile({
          path: filename,
          content: `${params.title}\n${'='.repeat(params.title.length)}\n\n${params.content}`,
        });
        return JSON.stringify({
          success: result.success,
          noteId: filename,
          title: params.title,
          path: result.path,
        });
      },
    },
    {
      name: 'generate_citation',
      description: 'Generate a citation in APA format',
      parameters: {
        title: { type: 'string', description: 'Source title' },
        author: { type: 'string', description: 'Source author' },
        url: { type: 'string', description: 'Source URL' },
        year: { type: 'string', description: 'Publication year (optional)' },
      },
      handler: async (params) => {
        const year = params.year || new Date().getFullYear().toString();
        return JSON.stringify({
          citation: `${params.author} (${year}). ${params.title}. Retrieved from ${params.url}`,
          format: 'APA',
        });
      },
    },
  ],
  system_prompt_injection:
    'You are a research assistant with web search capabilities. Help users find information, take notes, and cite sources properly. Use web_search to find current information online.',
  required_permissions: ['web_search', 'read_notes', 'write_notes'],
};

export const DATA_ANALYST_HARNESS: HarnessManifest = {
  name: 'Data Analyst',
  version: '2.0.0',
  harness_type: 'data-analyst',
  description: 'CSV parsing, charting, and data analysis tools',
  author: 'TrueAI Team',
  tools: [
    {
      name: 'parse_csv',
      description: 'Parse and analyze CSV data. Returns rows, columns, and preview.',
      parameters: {
        csv_data: { type: 'string', description: 'CSV data string with headers' },
      },
      handler: async (params) => {
        const result = parseCSV({ csv_data: params.csv_data });
        return JSON.stringify(result);
      },
    },
    {
      name: 'calculate_stats',
      description: 'Calculate statistical measures (mean, median, stddev, min, max) for numerical data',
      parameters: {
        data: { type: 'array', description: 'Array of numbers' },
        metrics: { type: 'array', description: 'Metrics to calculate (optional)' },
      },
      handler: async (params) => {
        const result = calculateStats({
          data: params.data,
          metrics: params.metrics,
        });
        return JSON.stringify(result);
      },
    },
    {
      name: 'generate_chart',
      description: 'Generate a text-based chart visualization (simple bar chart)',
      parameters: {
        type: { type: 'string', enum: ['bar', 'text'], description: 'Chart type (currently only bar/text supported)' },
        data: { type: 'array', description: 'Array of numbers' },
        labels: { type: 'array', description: 'Array of labels (optional)' },
      },
      handler: async (params) => {
        try {
          // Import the generateTextChart function
          const { generateTextChart } = await import('./tools/data-analysis');
          const chart = generateTextChart(params.data, params.labels);
          return JSON.stringify({
            chart,
            type: 'text',
            success: true,
          });
        } catch (error) {
          return JSON.stringify({
            error: String(error),
            success: false,
          });
        }
      },
    },
  ],
  system_prompt_injection:
    'You are a data analysis assistant. Help users understand data, identify patterns, and visualize insights. You can parse CSV data, calculate statistics, and generate simple charts.',
  required_permissions: ['read_files', 'parse_data', 'generate_charts'],
};

export const SYSTEM_INFO_HARNESS: HarnessManifest = {
  name: 'System Info',
  version: '1.0.0',
  harness_type: 'system-info',
  description: 'Device and system information tools',
  author: 'TrueAI Team',
  tools: [
    {
      name: 'get_system_info',
      description: 'Get comprehensive device and system information including OS, device model, and memory',
      parameters: {},
      handler: async () => {
        const result = await getSystemInfo();
        return JSON.stringify(result);
      },
    },
    {
      name: 'get_storage_info',
      description: 'Get storage information including disk capacity and free space',
      parameters: {},
      handler: async () => {
        const result = await getStorageInfo();
        return JSON.stringify(result);
      },
    },
    {
      name: 'get_system_summary',
      description: 'Get a comprehensive human-readable summary of system information',
      parameters: {},
      handler: async () => {
        const result = await getSystemSummary();
        return JSON.stringify({ summary: result });
      },
    },
  ],
  system_prompt_injection:
    'You have access to system information tools. Use these to provide users with device details, storage information, and system capabilities.',
  required_permissions: ['read_system_info'],
};

export const DEFAULT_HARNESSES = [
  CODE_ASSISTANT_HARNESS,
  RESEARCH_AGENT_HARNESS,
  DATA_ANALYST_HARNESS,
  SYSTEM_INFO_HARNESS,
];

export function validateHarnessManifest(manifest: unknown): manifest is HarnessManifest {
  if (!manifest || typeof manifest !== 'object') return false;

  const m = manifest as Record<string, unknown>;
  return (
    typeof m.name === 'string' &&
    typeof m.version === 'string' &&
    typeof m.harness_type === 'string' &&
    Array.isArray(m.tools)
  );
}

export async function loadHarnessFromUrl(url: string): Promise<HarnessManifest | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (validateHarnessManifest(data)) {
      return data;
    }
    return null;
  } catch (error) {
    console.error('Error loading harness:', error);
    return null;
  }
}
