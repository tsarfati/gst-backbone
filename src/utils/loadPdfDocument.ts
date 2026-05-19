export const isSafariBrowser = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/i.test(ua);
};

type PdfJsModule = {
  getDocument: (source: any) => any;
};

export async function loadPdfDocumentWithFallback(
  pdfjs: PdfJsModule,
  url: string,
  options?: {
    preferArrayBuffer?: boolean;
    signal?: AbortSignal;
  },
) {
  const loadFromArrayBuffer = async () => {
    const response = await fetch(url, {
      credentials: "omit",
      signal: options?.signal,
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    return pdfjs.getDocument({ data: buffer });
  };

  const loadFromUrl = () =>
    pdfjs.getDocument({
      url,
      withCredentials: false,
      disableAutoFetch: false,
      disableStream: false,
      rangeChunkSize: 1024 * 1024,
    });

  if (options?.preferArrayBuffer || isSafariBrowser()) {
    return loadFromArrayBuffer();
  }

  try {
    return loadFromUrl();
  } catch {
    return loadFromArrayBuffer();
  }
}
