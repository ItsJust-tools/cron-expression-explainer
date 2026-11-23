import { describe, it, expect } from 'vitest';
import { generateToolMetadata, generateJsonLd } from '../../src/lib/seo';
import toolConfig from '../../src/tool/tool.config';
import { getPublicSiteUrl } from '../../src/tool/template-metadata';
import type { ToolConfig } from '@itsjust/core';

const baseConfig: ToolConfig = {
  id: 'demo-tool',
  name: 'Demo Tool',
  description: 'A demo tool',
  version: '1.0.0',
  exportFormats: ['json', 'pdf'],
  features: {
    export: true,
    autoSave: true,
    undoRedo: true,
    sidebar: true,
    statusBar: true,
    darkMode: true,
  },
};

interface ToolMetadataShape {
  title?: { default?: string };
  description?: string;
  keywords?: string[];
  openGraph?: { images?: Array<{ url?: string }> };
  twitter?: { card?: string };
  robots?: { googleBot?: { index?: boolean } };
}

interface JsonLdShape {
  '@type': string;
  name: string;
  url: string;
  featureList: string[];
}

describe('getPublicSiteUrl', () => {
  it('uses NEXT_PUBLIC_URL when set', () => {
    const prev = process.env.NEXT_PUBLIC_URL;
    process.env.NEXT_PUBLIC_URL = 'https://example.com/';
    expect(getPublicSiteUrl()).toBe('https://example.com/');
    if (prev === undefined) delete process.env.NEXT_PUBLIC_URL;
    else process.env.NEXT_PUBLIC_URL = prev;
  });

  it('falls back to the dev URL', () => {
    const prev = process.env.NEXT_PUBLIC_URL;
    delete process.env.NEXT_PUBLIC_URL;
    expect(getPublicSiteUrl()).toBe('http://localhost:3000');
    if (prev !== undefined) process.env.NEXT_PUBLIC_URL = prev;
  });
});

describe('generateToolMetadata', () => {
  it('builds full metadata from a config', () => {
    const meta = generateToolMetadata(baseConfig) as unknown as ToolMetadataShape;
    expect(meta.title?.default).toBe('Demo Tool');
    expect(meta.description).toBe('A demo tool');
    expect(meta.keywords).toContain('json export');
    expect(meta.keywords).toContain('export to pdf');
    expect(meta.openGraph?.images).toHaveLength(1);
    expect(meta.twitter?.card).toBe('summary_large_image');
    expect(meta.robots?.googleBot?.index).toBe(true);
  });

  it('uses the configured ogImage when present', () => {
    const withOg = { ...baseConfig, ogImage: '/custom-og.png' };
    const meta = generateToolMetadata(withOg) as unknown as ToolMetadataShape;
    const site = getPublicSiteUrl();
    expect(meta.openGraph?.images?.[0]?.url).toBe(`${site}/custom-og.png`);
  });

  it('falls back to the default og.svg without ogImage', () => {
    const meta = generateToolMetadata(baseConfig) as unknown as ToolMetadataShape;
    const site = getPublicSiteUrl();
    expect(meta.openGraph?.images?.[0]?.url).toBe(`${site}/og.svg`);
  });
});

describe('generateJsonLd', () => {
  it('includes all feature-list entries when all features are on', () => {
    const jsonLd = generateJsonLd(baseConfig) as unknown as JsonLdShape;
    expect(jsonLd['@type']).toBe('WebApplication');
    expect(jsonLd.name).toBe('Demo Tool');
    expect(jsonLd.featureList).toContain('Export as json, pdf');
    expect(jsonLd.featureList).toContain('Auto-save');
    expect(jsonLd.featureList).toContain('Undo & Redo');
    expect(jsonLd.featureList).toContain('Dark mode');
  });

  it('drops disabled feature entries', () => {
    const stripped: ToolConfig = {
      ...baseConfig,
      features: {
        export: false,
        autoSave: false,
        undoRedo: false,
        sidebar: true,
        statusBar: true,
        darkMode: false,
      },
    };
    const jsonLd = generateJsonLd(stripped) as unknown as JsonLdShape;
    expect(jsonLd.featureList).toEqual([]);
  });

  it('reflects the real tool config', () => {
    const meta = generateToolMetadata(toolConfig) as unknown as ToolMetadataShape;
    expect(meta.title?.default).toBe(toolConfig.name);
    const jsonLd = generateJsonLd(toolConfig) as unknown as JsonLdShape;
    expect(jsonLd.name).toBe(toolConfig.name);
    expect(jsonLd.url).toBe(getPublicSiteUrl());
  });
});
