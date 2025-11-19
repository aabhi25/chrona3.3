import { parseTextWithLinks } from "@/lib/urlUtils";
import { LinkPreview } from "@/components/LinkPreview";
import { ExternalLink } from "lucide-react";

interface PostContentProps {
  content: string;
  className?: string;
}

export function PostContent({ content, className = "" }: PostContentProps) {
  const parts = parseTextWithLinks(content);
  
  // Separate text parts and link previews
  const textParts = parts.map((part, index) => {
    if (part.type === 'text') {
      return (
        <span key={index} className="whitespace-pre-wrap">
          {part.content}
        </span>
      );
    } else if (part.link) {
      // Render clickable link inline
      return (
        <a
          key={index}
          href={part.link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-0.5"
        >
          {part.content}
          <ExternalLink className="h-3 w-3 inline" />
        </a>
      );
    }
    return null;
  });

  // Get link previews (YouTube, images)
  const linkPreviews = parts
    .filter(part => part.type === 'link' && part.link && (part.link.type === 'youtube' || part.link.type === 'image'))
    .map((part, index) => (
      <LinkPreview key={`preview-${index}`} link={part.link!} />
    ));

  return (
    <div className={className}>
      <div className="text-sm leading-relaxed dark:text-slate-200">
        {textParts}
      </div>
      {linkPreviews.length > 0 && (
        <div className="space-y-3">
          {linkPreviews}
        </div>
      )}
    </div>
  );
}
