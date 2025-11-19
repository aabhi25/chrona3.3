import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { DetectedLink } from "@/lib/urlUtils";

interface LinkPreviewProps {
  link: DetectedLink;
}

export function LinkPreview({ link }: LinkPreviewProps) {
  const [imageError, setImageError] = useState(false);

  // YouTube embed
  if (link.type === 'youtube' && link.embedUrl) {
    return (
      <div className="mt-3 rounded-lg overflow-hidden border border-purple-200 dark:border-slate-600 bg-black max-w-2xl">
        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
          <iframe
            src={link.embedUrl}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute top-0 left-0 w-full h-full"
          />
        </div>
        <div className="bg-gray-50 dark:bg-slate-700 px-3 py-2 border-t border-gray-200 dark:border-slate-600">
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            Watch on YouTube
          </a>
        </div>
      </div>
    );
  }

  // Image preview
  if (link.type === 'image' && !imageError) {
    return (
      <div className="mt-3 rounded-lg overflow-hidden border border-purple-200 dark:border-slate-600">
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <img
            src={link.url}
            alt="Linked image"
            className="w-full max-h-96 object-contain bg-gray-100 dark:bg-slate-800"
            onError={() => setImageError(true)}
          />
        </a>
        <div className="bg-gray-50 dark:bg-slate-700 px-3 py-2 border-t border-gray-200 dark:border-slate-600">
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            Open image
          </a>
        </div>
      </div>
    );
  }

  // Generic link preview (just a clickable link in the text)
  return null;
}
