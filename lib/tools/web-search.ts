/**
 * Web Search Tool
 * Provides real web search functionality using DuckDuckGo HTML scraping
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchParams {
  query: string;
  results?: number;
}

export interface WebSearchResponse {
  results: SearchResult[];
  query: string;
  count: number;
}

/**
 * Search the web using DuckDuckGo HTML scraping
 * This approach works cross-platform without requiring API keys
 */
export async function webSearch(params: WebSearchParams): Promise<WebSearchResponse> {
  const { query, results = 5 } = params;

  try {
    // Use DuckDuckGo HTML endpoint (no API key required)
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
      timeout: 10000,
    });

    // Parse HTML response
    const $ = cheerio.load(response.data);
    const searchResults: SearchResult[] = [];

    // Extract search results from DuckDuckGo HTML
    $('.result').each((index, element) => {
      if (searchResults.length >= results) return false;

      const titleElement = $(element).find('.result__a');
      const snippetElement = $(element).find('.result__snippet');
      const urlElement = $(element).find('.result__url');

      const title = titleElement.text().trim();
      const snippet = snippetElement.text().trim();
      let url = titleElement.attr('href') || '';

      // DuckDuckGo uses redirect links, extract actual URL
      if (url.startsWith('//duckduckgo.com/l/?uddg=')) {
        try {
          const urlParams = new URLSearchParams(url.split('?')[1]);
          url = decodeURIComponent(urlParams.get('uddg') || '');
        } catch (e) {
          // Keep original URL if parsing fails
        }
      }

      if (title && url) {
        searchResults.push({
          title,
          url,
          snippet: snippet || 'No description available',
        });
      }
    });

    // Fallback if no results found
    if (searchResults.length === 0) {
      return {
        results: [
          {
            title: 'No results found',
            url: '',
            snippet: `No search results were found for query: "${query}". Try rephrasing your search.`,
          },
        ],
        query,
        count: 0,
      };
    }

    return {
      results: searchResults,
      query,
      count: searchResults.length,
    };
  } catch (error) {
    console.error('Web search error:', error);

    // Return error result
    return {
      results: [
        {
          title: 'Search Error',
          url: '',
          snippet: `Error performing search: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      query,
      count: 0,
    };
  }
}

/**
 * Alternative search using DuckDuckGo Instant Answer API (JSON)
 * More reliable but provides less detailed results
 */
export async function webSearchInstantAnswer(params: WebSearchParams): Promise<WebSearchResponse> {
  const { query, results = 5 } = params;

  try {
    const apiUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`;

    const response = await axios.get(apiUrl, { timeout: 10000 });
    const data = response.data;

    const searchResults: SearchResult[] = [];

    // Extract Abstract if available
    if (data.Abstract && data.AbstractURL) {
      searchResults.push({
        title: data.Heading || 'Top Result',
        url: data.AbstractURL,
        snippet: data.Abstract,
      });
    }

    // Extract Related Topics
    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      data.RelatedTopics.slice(0, results - searchResults.length).forEach((topic: any) => {
        if (topic.Text && topic.FirstURL) {
          searchResults.push({
            title: topic.Text.split(' - ')[0] || 'Related Topic',
            url: topic.FirstURL,
            snippet: topic.Text,
          });
        }
      });
    }

    if (searchResults.length === 0) {
      return {
        results: [
          {
            title: 'No instant answer available',
            url: '',
            snippet: `No instant answer found for "${query}". Try using the full search.`,
          },
        ],
        query,
        count: 0,
      };
    }

    return {
      results: searchResults.slice(0, results),
      query,
      count: searchResults.length,
    };
  } catch (error) {
    console.error('Instant answer error:', error);

    return {
      results: [
        {
          title: 'Search Error',
          url: '',
          snippet: `Error performing instant answer search: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      query,
      count: 0,
    };
  }
}
