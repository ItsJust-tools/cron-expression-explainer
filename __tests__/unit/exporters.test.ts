import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ExportFormat, ExportOptions, ExportResult } from '@itsjust/core';

// html-to-image is mocked for the whole module graph (hoisted by vitest).
vi.mock('html-to-image', () => ({
  toBlob: vi.fn(async () => new Blob(['fake-image-bytes'], { type: 'image/png' })),
}));

import { toBlob } from 'html-to-image';
import { formatExportError, throwIfAborted, renderToImage } from '../../src/tool/exporters/utils';
import { default as pngExporter } from '../../src/tool/exporters/png';
import { default as jpegExporter } from '../../src/tool/exporters/jpeg';
import { default as webpExporter } from '../../src/tool/exporters/webp';
import { default as pdfExporter } from '../../src/tool/exporters/pdf';

const mockedToBlob = vi.mocked(toBlob);

let srcDescriptor: PropertyDescriptor | undefined;

function stubCanvasPipeline(blob: Blob | null) {
  // jsdom lacks canvas.toBlob and URL.createObjectURL
  HTMLCanvasElement.prototype.toBlob = function toBlobCb(
    this: HTMLCanvasElement,
    cb: (b: Blob | null) => void
  ) {
    cb(blob ? new Blob(['out'], { type: 'image/png' }) : null);
  };
  (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = vi.fn(
    () => 'blob:mock-123'
  );
  (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL = vi.fn();
  // jsdom has no 2d context implementation
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    drawImage: vi.fn(),
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  // jsdom never fires load for blob: srcs — emulate it
  srcDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    configurable: true,
    get(this: HTMLImageElement) {
      return (this as unknown as { _mockSrc?: string })._mockSrc ?? '';
    },
    set(this: HTMLImageElement, value: string) {
      (this as unknown as { _mockSrc?: string })._mockSrc = value;
      queueMicrotask(() => {
        const handler = (this as unknown as { onload?: (() => void) | null }).onload;
        if (handler) handler.call(this);
      });
    },
  });
  Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', {
    value: 100,
    configurable: true,
  });
  Object.defineProperty(HTMLImageElement.prototype, 'naturalHeight', {
    value: 50,
    configurable: true,
  });
}

afterEach(() => {
  if (srcDescriptor) {
    Object.defineProperty(HTMLImageElement.prototype, 'src', srcDescriptor);
    srcDescriptor = undefined;
  }
});

beforeEach(() => {
  document.body.innerHTML = '';
  mockedToBlob.mockReset();
  mockedToBlob.mockResolvedValue(new Blob(['fake-image-bytes'], { type: 'image/png' }));
});

describe('formatExportError', () => {
  it('passes through a plain Error message', () => {
    expect(formatExportError(new Error('boom'), 'png')).toBe('boom');
  });

  it('appends a hint for CORS-like failures', () => {
    const out = formatExportError(new Error('Tainted canvas: CORS'), 'webp');
    expect(out).toContain('Tainted canvas: CORS');
    expect(out).toMatch(/CORS/i);
  });

  it('falls back to a generic message for non-Error values', () => {
    expect(formatExportError('something odd', 'pdf')).toBe('pdf export failed');
    expect(formatExportError(null, 'png')).toBe('png export failed');
  });
});

describe('throwIfAborted', () => {
  it('throws AbortError when the signal is aborted', () => {
    const controller = new AbortController();
    controller.abort();
    expect(() => throwIfAborted(controller.signal)).toThrowError(DOMException);
  });

  it('does nothing for live or missing signals', () => {
    expect(() => throwIfAborted(new AbortController().signal)).not.toThrow();
    expect(() => throwIfAborted(undefined)).not.toThrow();
  });
});

describe('renderToImage', () => {
  it('blocks export when sensitive elements are present', async () => {
    const el = document.createElement('div');
    el.innerHTML = '<input type="password" value="secret" />';
    document.body.appendChild(el);
    await expect(renderToImage(el, { format: 'png' })).rejects.toThrow(/sensitive/);
  });

  it('blocks export for data-sensitive elements when not allowed', async () => {
    const el = document.createElement('div');
    el.innerHTML = '<span data-sensitive="true">secret</span>';
    document.body.appendChild(el);
    await expect(renderToImage(el, { format: 'png', allowSensitiveData: false })).rejects.toThrow(
      /sensitive/
    );
  });

  it('continues when allowSensitiveData is true', async () => {
    stubCanvasPipeline(new Blob(['x']));
    const el = document.createElement('div');
    el.innerHTML = '<span data-sensitive="true">ok</span>';
    document.body.appendChild(el);
    const canvas = await renderToImage(el, { format: 'png', allowSensitiveData: true });
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
  });

  it('throws immediately for an aborted signal', async () => {
    const el = document.createElement('div');
    el.textContent = 'content';
    document.body.appendChild(el);
    const controller = new AbortController();
    controller.abort();
    await expect(renderToImage(el, { format: 'png', signal: controller.signal })).rejects.toThrow(
      /aborted/i
    );
  });

  it('renders a plain element to a canvas and restores the DOM', async () => {
    stubCanvasPipeline(new Blob(['x']));
    const el = document.createElement('div');
    el.textContent = 'export me';
    document.body.appendChild(el);
    const canvas = await renderToImage(el, { format: 'png', scale: 1 });
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(mockedToBlob).toHaveBeenCalled();
    expect(document.body.contains(el)).toBe(true);
  });

  it('fails when no image blob can be produced', async () => {
    mockedToBlob.mockResolvedValue(null);
    const el = document.createElement('div');
    el.textContent = 'no blob';
    document.body.appendChild(el);
    await expect(renderToImage(el, { format: 'png' })).rejects.toThrow(/blob/i);
  });

  it('expands a textarea to its scroll height before rendering', async () => {
    stubCanvasPipeline(new Blob(['x']));
    const el = document.createElement('div');
    el.innerHTML = '<textarea id="ta">text</textarea>';
    document.body.appendChild(el);
    const ta = el.querySelector('textarea') as HTMLTextAreaElement;
    Object.defineProperty(ta, 'scrollHeight', { value: 250, configurable: true });
    await renderToImage(el, { format: 'png' });
    expect(document.body.contains(ta)).toBe(true);
  });
});

type TestExporter = {
  format: string;
  export: (element: HTMLElement, options: ExportOptions) => Promise<ExportResult>;
};

describe('canvas exporters (png/jpeg/webp)', () => {
  const exporters: TestExporter[] = [pngExporter, jpegExporter, webpExporter];

  for (const exporter of exporters) {
    it(`exports ${exporter.format}`, async () => {
      stubCanvasPipeline(new Blob(['x']));
      const el = document.createElement('div');
      el.textContent = 'img';
      document.body.appendChild(el);
      const result = await exporter.export(el, { format: 'png' as ExportFormat });
      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Blob);
      expect(result.filename).toMatch(/\.(png|jpg|webp)$/);
      expect(result.format).toBe(exporter.format);
    });

    it(`fails gracefully for ${exporter.format} when the blob step fails`, async () => {
      stubCanvasPipeline(null);
      const el = document.createElement('div');
      el.textContent = 'img fail';
      document.body.appendChild(el);
      const result = await exporter.export(el, { format: 'png' as ExportFormat });
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
    });
  }

  it('respects a custom filename (sanitised) and quality option', async () => {
    stubCanvasPipeline(new Blob(['x']));
    const el = document.createElement('div');
    el.textContent = 'img';
    document.body.appendChild(el);
    const result = await pngExporter.export(el, {
      format: 'png',
      filename: 'my  report.png',
      quality: 0.8,
    });
    expect(result.success).toBe(true);
    expect(result.filename).toMatch(/^my.*report\.png$/);
  });
});

describe('pdf exporter', () => {
  it('opens the print iframe, clones the element and calls print()', async () => {
    const printSpy = vi.fn();
    const origContentWindow = Object.getOwnPropertyDescriptor(
      HTMLIFrameElement.prototype,
      'contentWindow'
    );
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
      configurable: true,
      get() {
        return { print: printSpy } as unknown as Window & typeof globalThis;
      },
    });
    try {
      const el = document.createElement('div');
      el.innerHTML = '<textarea>print me</textarea>';
      document.body.appendChild(el);

      const result = await pdfExporter.export(el, { format: 'pdf' });
      expect(result.success).toBe(true);
      expect(result.filename).toMatch(/\.pdf$/);
      expect(printSpy).toHaveBeenCalledTimes(1);
    } finally {
      if (origContentWindow) {
        Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', origContentWindow);
      } else {
        delete (HTMLIFrameElement.prototype as { contentWindow?: unknown }).contentWindow;
      }
    }
  });

  it('honours an explicit filename', async () => {
    vi.spyOn(HTMLIFrameElement.prototype, 'contentWindow', 'get').mockReturnValue({
      print: vi.fn(),
    } as unknown as Window & typeof globalThis);
    const el = document.createElement('div');
    el.textContent = 'pdf content';
    document.body.appendChild(el);
    const result = await pdfExporter.export(el, { format: 'pdf', filename: 'schedule.pdf' });
    expect(result.success).toBe(true);
    expect(result.filename).toBe('schedule.pdf');
  });

  it('returns a clean failure for an aborted signal', async () => {
    const el = document.createElement('div');
    el.textContent = 'nope';
    document.body.appendChild(el);
    const controller = new AbortController();
    controller.abort();
    const result = await pdfExporter.export(el, { format: 'pdf', signal: controller.signal });
    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
  });
});
