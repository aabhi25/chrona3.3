// URL detection and parsing utilities

export interface DetectedLink {
  url: string;
  start: number;
  end: number;
  type: 'youtube' | 'image' | 'generic';
  embedUrl?: string;
}

// URL regex pattern
const URL_REGEX = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/gi;

// YouTube URL patterns
const YOUTUBE_PATTERNS = [
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
  /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]+)/,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)/,
];

// Image extensions
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

/**
 * Extract YouTube video ID from URL
 */
export function getYouTubeVideoId(url: string): string | null {
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

/**
 * Check if URL is an image
 */
export function isImageUrl(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  return IMAGE_EXTENSIONS.some(ext => lowerUrl.includes(ext));
}

/**
 * Detect all URLs in text
 */
export function detectUrls(text: string): DetectedLink[] {
  const links: DetectedLink[] = [];
  let match;

  // Reset regex
  URL_REGEX.lastIndex = 0;

  while ((match = URL_REGEX.exec(text)) !== null) {
    const url = match[0];
    const start = match.index;
    const end = start + url.length;

    // Determine link type
    const youtubeId = getYouTubeVideoId(url);
    let type: DetectedLink['type'] = 'generic';
    let embedUrl: string | undefined;

    if (youtubeId) {
      type = 'youtube';
      embedUrl = `https://www.youtube.com/embed/${youtubeId}`;
    } else if (isImageUrl(url)) {
      type = 'image';
    }

    links.push({
      url,
      start,
      end,
      type,
      embedUrl,
    });
  }

  return links;
}

/**
 * Split text into parts with links
 */
export interface TextPart {
  type: 'text' | 'link';
  content: string;
  link?: DetectedLink;
}

export function parseTextWithLinks(text: string): TextPart[] {
  const links = detectUrls(text);
  
  if (links.length === 0) {
    return [{ type: 'text', content: text }];
  }

  const parts: TextPart[] = [];
  let lastIndex = 0;

  links.forEach(link => {
    // Add text before link
    if (link.start > lastIndex) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex, link.start),
      });
    }

    // Add link
    parts.push({
      type: 'link',
      content: link.url,
      link,
    });

    lastIndex = link.end;
  });

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.substring(lastIndex),
    });
  }

  return parts;
}
