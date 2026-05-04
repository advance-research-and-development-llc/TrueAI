/**
 * Data Analysis Tools
 * Provides CSV parsing, statistical calculations, and data processing
 */

export interface ParseCSVParams {
  csv_data: string;
}

export interface ParseCSVResponse {
  rows: number;
  columns: string[];
  preview: any[];
  data: any[];
}

export interface CalculateStatsParams {
  data: number[];
  metrics?: string[];
}

export interface CalculateStatsResponse {
  mean: number;
  median: number;
  stddev: number;
  min: number;
  max: number;
  sum: number;
  count: number;
}

/**
 * Parse CSV data into structured format
 */
export function parseCSV(params: ParseCSVParams): ParseCSVResponse {
  try {
    const { csv_data } = params;

    // Split into lines
    const lines = csv_data.trim().split('\n');
    if (lines.length === 0) {
      return {
        rows: 0,
        columns: [],
        preview: [],
        data: [],
      };
    }

    // Parse header (first line)
    const columns = lines[0].split(',').map((col) => col.trim());

    // Parse data rows
    const data: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((val) => val.trim());
      const row: any = {};

      columns.forEach((col, index) => {
        // Try to parse as number, otherwise keep as string
        const value = values[index];
        row[col] = isNaN(Number(value)) ? value : Number(value);
      });

      data.push(row);
    }

    // Create preview (first 5 rows)
    const preview = data.slice(0, 5);

    return {
      rows: data.length,
      columns,
      preview,
      data,
    };
  } catch (error) {
    console.error('CSV parse error:', error);
    return {
      rows: 0,
      columns: [],
      preview: [],
      data: [],
    };
  }
}

/**
 * Calculate statistical measures for numerical data
 */
export function calculateStats(params: CalculateStatsParams): CalculateStatsResponse {
  try {
    const { data, metrics = ['mean', 'median', 'stddev', 'min', 'max'] } = params;

    if (!Array.isArray(data) || data.length === 0) {
      return {
        mean: 0,
        median: 0,
        stddev: 0,
        min: 0,
        max: 0,
        sum: 0,
        count: 0,
      };
    }

    // Filter to only numeric values
    const numbers = data.filter((val) => typeof val === 'number' && !isNaN(val));
    if (numbers.length === 0) {
      return {
        mean: 0,
        median: 0,
        stddev: 0,
        min: 0,
        max: 0,
        sum: 0,
        count: 0,
      };
    }

    // Calculate sum
    const sum = numbers.reduce((acc, val) => acc + val, 0);

    // Calculate mean
    const mean = sum / numbers.length;

    // Calculate median
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

    // Calculate standard deviation
    const variance = numbers.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / numbers.length;
    const stddev = Math.sqrt(variance);

    // Get min and max
    const min = Math.min(...numbers);
    const max = Math.max(...numbers);

    return {
      mean: parseFloat(mean.toFixed(4)),
      median: parseFloat(median.toFixed(4)),
      stddev: parseFloat(stddev.toFixed(4)),
      min,
      max,
      sum: parseFloat(sum.toFixed(4)),
      count: numbers.length,
    };
  } catch (error) {
    console.error('Stats calculation error:', error);
    return {
      mean: 0,
      median: 0,
      stddev: 0,
      min: 0,
      max: 0,
      sum: 0,
      count: 0,
    };
  }
}

/**
 * Group data by a specific column
 */
export function groupBy(data: any[], column: string): Record<string, any[]> {
  const groups: Record<string, any[]> = {};

  data.forEach((row) => {
    const key = row[column];
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(row);
  });

  return groups;
}

/**
 * Filter data based on conditions
 */
export function filterData(data: any[], conditions: Record<string, any>): any[] {
  return data.filter((row) => {
    return Object.entries(conditions).every(([key, value]) => {
      if (typeof value === 'function') {
        return value(row[key]);
      }
      return row[key] === value;
    });
  });
}

/**
 * Sort data by column
 */
export function sortData(data: any[], column: string, order: 'asc' | 'desc' = 'asc'): any[] {
  return [...data].sort((a, b) => {
    const aVal = a[column];
    const bVal = b[column];

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return order === 'asc' ? aVal - bVal : bVal - aVal;
    }

    const aStr = String(aVal);
    const bStr = String(bVal);
    return order === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
  });
}

/**
 * Get unique values from a column
 */
export function getUniqueValues(data: any[], column: string): any[] {
  const values = data.map((row) => row[column]);
  return [...new Set(values)];
}

/**
 * Calculate correlation between two numerical columns
 */
export function calculateCorrelation(data: any[], column1: string, column2: string): number {
  try {
    const pairs = data
      .map((row) => ({ x: row[column1], y: row[column2] }))
      .filter((pair) => typeof pair.x === 'number' && typeof pair.y === 'number');

    if (pairs.length < 2) return 0;

    const n = pairs.length;
    const sumX = pairs.reduce((acc, p) => acc + p.x, 0);
    const sumY = pairs.reduce((acc, p) => acc + p.y, 0);
    const sumXY = pairs.reduce((acc, p) => acc + p.x * p.y, 0);
    const sumX2 = pairs.reduce((acc, p) => acc + p.x * p.x, 0);
    const sumY2 = pairs.reduce((acc, p) => acc + p.y * p.y, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    if (denominator === 0) return 0;

    return numerator / denominator;
  } catch (error) {
    console.error('Correlation calculation error:', error);
    return 0;
  }
}

/**
 * Generate simple text-based chart
 */
export function generateTextChart(data: number[], labels?: string[]): string {
  if (data.length === 0) return 'No data to display';

  const max = Math.max(...data);
  const barLength = 50;

  const lines: string[] = [];
  data.forEach((value, index) => {
    const label = labels && labels[index] ? labels[index] : `Item ${index + 1}`;
    const barWidth = Math.round((value / max) * barLength);
    const bar = '█'.repeat(barWidth);
    lines.push(`${label.padEnd(15)} | ${bar} ${value}`);
  });

  return lines.join('\n');
}
