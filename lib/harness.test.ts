import {
  validateHarnessManifest,
  loadHarnessFromUrl,
  CODE_ASSISTANT_HARNESS,
  RESEARCH_AGENT_HARNESS,
  DATA_ANALYST_HARNESS,
  DEFAULT_HARNESSES,
  HarnessManifest,
} from './harness';

global.fetch = jest.fn();

describe('Harness Manifests', () => {
  describe('CODE_ASSISTANT_HARNESS', () => {
    it('should have required fields', () => {
      expect(CODE_ASSISTANT_HARNESS.name).toBe('Code Assistant');
      expect(CODE_ASSISTANT_HARNESS.version).toBe('1.0.0');
      expect(CODE_ASSISTANT_HARNESS.harness_type).toBe('code-assistant');
      expect(CODE_ASSISTANT_HARNESS.tools).toBeDefined();
      expect(CODE_ASSISTANT_HARNESS.tools.length).toBeGreaterThan(0);
    });

    it('should have execute_code tool', () => {
      const tool = CODE_ASSISTANT_HARNESS.tools.find((t) => t.name === 'execute_code');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('Execute');
    });

    it('should execute JavaScript code correctly', async () => {
      const tool = CODE_ASSISTANT_HARNESS.tools.find((t) => t.name === 'execute_code')!;
      const result = await tool.handler({ language: 'javascript', code: '2 + 2' });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.output).toBe('4');
    });

    it('should handle JavaScript execution errors', async () => {
      const tool = CODE_ASSISTANT_HARNESS.tools.find((t) => t.name === 'execute_code')!;
      const result = await tool.handler({ language: 'javascript', code: 'invalid syntax!' });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toBeDefined();
    });

    it('should not support Python execution', async () => {
      const tool = CODE_ASSISTANT_HARNESS.tools.find((t) => t.name === 'execute_code')!;
      const result = await tool.handler({ language: 'python', code: 'print("hello")' });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(false);
      expect(parsed.error).toContain('Python');
    });

    it('should have list_files tool', () => {
      const tool = CODE_ASSISTANT_HARNESS.tools.find((t) => t.name === 'list_files');
      expect(tool).toBeDefined();
    });

    it('should list files in directory', async () => {
      const tool = CODE_ASSISTANT_HARNESS.tools.find((t) => t.name === 'list_files')!;
      const result = await tool.handler({ path: '/test' });
      const parsed = JSON.parse(result);

      expect(parsed.files).toBeDefined();
      expect(parsed.path).toBe('/test');
    });

    it('should have read_file tool', () => {
      const tool = CODE_ASSISTANT_HARNESS.tools.find((t) => t.name === 'read_file');
      expect(tool).toBeDefined();
    });

    it('should read file content', async () => {
      const tool = CODE_ASSISTANT_HARNESS.tools.find((t) => t.name === 'read_file')!;
      const result = await tool.handler({ path: '/test.js' });
      const parsed = JSON.parse(result);

      expect(parsed.content).toBeDefined();
      expect(parsed.path).toBe('/test.js');
    });
  });

  describe('RESEARCH_AGENT_HARNESS', () => {
    it('should have required fields', () => {
      expect(RESEARCH_AGENT_HARNESS.name).toBe('Research Agent');
      expect(RESEARCH_AGENT_HARNESS.version).toBe('1.0.0');
      expect(RESEARCH_AGENT_HARNESS.harness_type).toBe('research-agent');
      expect(RESEARCH_AGENT_HARNESS.tools).toBeDefined();
    });

    it('should have web_search tool', () => {
      const tool = RESEARCH_AGENT_HARNESS.tools.find((t) => t.name === 'web_search');
      expect(tool).toBeDefined();
    });

    it('should perform web search', async () => {
      const tool = RESEARCH_AGENT_HARNESS.tools.find((t) => t.name === 'web_search')!;
      const result = await tool.handler({ query: 'test query', results: 5 });
      const parsed = JSON.parse(result);

      expect(parsed.query).toBe('test query');
      expect(parsed.results).toBeDefined();
      expect(Array.isArray(parsed.results)).toBe(true);
    });

    it('should have save_note tool', () => {
      const tool = RESEARCH_AGENT_HARNESS.tools.find((t) => t.name === 'save_note');
      expect(tool).toBeDefined();
    });

    it('should save notes', async () => {
      const tool = RESEARCH_AGENT_HARNESS.tools.find((t) => t.name === 'save_note')!;
      const result = await tool.handler({ title: 'Test Note', content: 'Content here' });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.noteId).toBeDefined();
      expect(parsed.title).toBe('Test Note');
    });

    it('should have generate_citation tool', () => {
      const tool = RESEARCH_AGENT_HARNESS.tools.find((t) => t.name === 'generate_citation');
      expect(tool).toBeDefined();
    });

    it('should generate citation', async () => {
      const tool = RESEARCH_AGENT_HARNESS.tools.find((t) => t.name === 'generate_citation')!;
      const result = await tool.handler({
        title: 'Test Article',
        author: 'John Doe',
        url: 'https://example.com',
      });
      const parsed = JSON.parse(result);

      expect(parsed.citation).toBeDefined();
      expect(parsed.citation).toContain('John Doe');
      expect(parsed.citation).toContain('Test Article');
    });
  });

  describe('DATA_ANALYST_HARNESS', () => {
    it('should have required fields', () => {
      expect(DATA_ANALYST_HARNESS.name).toBe('Data Analyst');
      expect(DATA_ANALYST_HARNESS.version).toBe('1.0.0');
      expect(DATA_ANALYST_HARNESS.harness_type).toBe('data-analyst');
      expect(DATA_ANALYST_HARNESS.tools).toBeDefined();
    });

    it('should have parse_csv tool', () => {
      const tool = DATA_ANALYST_HARNESS.tools.find((t) => t.name === 'parse_csv');
      expect(tool).toBeDefined();
    });

    it('should parse CSV data', async () => {
      const tool = DATA_ANALYST_HARNESS.tools.find((t) => t.name === 'parse_csv')!;
      const result = await tool.handler({ csv_data: 'col1,col2\nval1,val2' });
      const parsed = JSON.parse(result);

      expect(parsed.rows).toBeDefined();
      expect(parsed.columns).toBeDefined();
      expect(parsed.preview).toBeDefined();
    });

    it('should have calculate_stats tool', () => {
      const tool = DATA_ANALYST_HARNESS.tools.find((t) => t.name === 'calculate_stats');
      expect(tool).toBeDefined();
    });

    it('should calculate statistics', async () => {
      const tool = DATA_ANALYST_HARNESS.tools.find((t) => t.name === 'calculate_stats')!;
      const result = await tool.handler({
        data: [1, 2, 3, 4, 5],
        metrics: ['mean', 'median', 'stddev'],
      });
      const parsed = JSON.parse(result);

      expect(parsed.mean).toBeDefined();
      expect(parsed.median).toBeDefined();
      expect(parsed.stddev).toBeDefined();
    });

    it('should have generate_chart tool', () => {
      const tool = DATA_ANALYST_HARNESS.tools.find((t) => t.name === 'generate_chart');
      expect(tool).toBeDefined();
    });

    it('should generate chart', async () => {
      const tool = DATA_ANALYST_HARNESS.tools.find((t) => t.name === 'generate_chart')!;
      const result = await tool.handler({
        type: 'bar',
        data: { labels: ['A', 'B'], values: [10, 20] },
      });
      const parsed = JSON.parse(result);

      expect(parsed.success).toBe(true);
      expect(parsed.chartUrl).toBeDefined();
    });
  });

  describe('DEFAULT_HARNESSES', () => {
    it('should contain all three default harnesses', () => {
      expect(DEFAULT_HARNESSES).toHaveLength(3);
      expect(DEFAULT_HARNESSES).toContain(CODE_ASSISTANT_HARNESS);
      expect(DEFAULT_HARNESSES).toContain(RESEARCH_AGENT_HARNESS);
      expect(DEFAULT_HARNESSES).toContain(DATA_ANALYST_HARNESS);
    });
  });
});

describe('validateHarnessManifest', () => {
  it('should validate valid manifest', () => {
    const validManifest: HarnessManifest = {
      name: 'Test Harness',
      version: '1.0.0',
      harness_type: 'test',
      tools: [],
    };

    expect(validateHarnessManifest(validManifest)).toBe(true);
  });

  it('should reject null or undefined', () => {
    expect(validateHarnessManifest(null)).toBe(false);
    expect(validateHarnessManifest(undefined)).toBe(false);
  });

  it('should reject non-object types', () => {
    expect(validateHarnessManifest('string')).toBe(false);
    expect(validateHarnessManifest(123)).toBe(false);
    expect(validateHarnessManifest([])).toBe(false);
  });

  it('should reject manifest without name', () => {
    const invalid = {
      version: '1.0.0',
      harness_type: 'test',
      tools: [],
    };

    expect(validateHarnessManifest(invalid)).toBe(false);
  });

  it('should reject manifest without version', () => {
    const invalid = {
      name: 'Test',
      harness_type: 'test',
      tools: [],
    };

    expect(validateHarnessManifest(invalid)).toBe(false);
  });

  it('should reject manifest without harness_type', () => {
    const invalid = {
      name: 'Test',
      version: '1.0.0',
      tools: [],
    };

    expect(validateHarnessManifest(invalid)).toBe(false);
  });

  it('should reject manifest without tools array', () => {
    const invalid = {
      name: 'Test',
      version: '1.0.0',
      harness_type: 'test',
    };

    expect(validateHarnessManifest(invalid)).toBe(false);
  });

  it('should reject manifest with non-array tools', () => {
    const invalid = {
      name: 'Test',
      version: '1.0.0',
      harness_type: 'test',
      tools: 'not an array',
    };

    expect(validateHarnessManifest(invalid)).toBe(false);
  });

  it('should accept manifest with optional fields', () => {
    const valid = {
      name: 'Test',
      version: '1.0.0',
      harness_type: 'test',
      tools: [],
      description: 'A test harness',
      author: 'Test Author',
      system_prompt_injection: 'You are a test assistant',
    };

    expect(validateHarnessManifest(valid)).toBe(true);
  });
});

describe('loadHarnessFromUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should load valid harness from URL', async () => {
    const validManifest = {
      name: 'Remote Harness',
      version: '1.0.0',
      harness_type: 'remote',
      tools: [],
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => validManifest,
    });

    const result = await loadHarnessFromUrl('https://example.com/harness.json');

    expect(result).toEqual(validManifest);
    expect(global.fetch).toHaveBeenCalledWith('https://example.com/harness.json');
  });

  it('should return null when fetch fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 404,
    });

    const result = await loadHarnessFromUrl('https://example.com/notfound.json');

    expect(result).toBeNull();
  });

  it('should return null when JSON is invalid', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error('Invalid JSON');
      },
    });

    const result = await loadHarnessFromUrl('https://example.com/invalid.json');

    expect(result).toBeNull();
  });

  it('should return null when manifest validation fails', async () => {
    const invalidManifest = {
      name: 'Invalid',
      // missing required fields
    };

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => invalidManifest,
    });

    const result = await loadHarnessFromUrl('https://example.com/invalid.json');

    expect(result).toBeNull();
  });

  it('should return null on network error', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const result = await loadHarnessFromUrl('https://example.com/harness.json');

    expect(result).toBeNull();
  });
});
