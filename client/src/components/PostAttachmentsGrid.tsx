import React, { useState } from "react";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageLightbox } from "@/components/ImageLightbox";

interface PostAttachmentsGridProps {
  attachments: Array<{fileId: string; filename: string; mimetype: string}> | string[];
}

export function PostAttachmentsGrid({ attachments }: PostAttachmentsGridProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Debug logging (remove in production)
  // console.log('[PostAttachmentsGrid] Raw attachments:', attachments);

  // Normalize attachments to handle both old format (strings) and new format (objects)
  const normalizeAttachments = (attachments: Array<{fileId: string; filename: string; mimetype: string}> | string[]) => {
    if (!Array.isArray(attachments)) return [];
    
    return attachments.map(attachment => {
      if (typeof attachment === 'string') {
        // Old format: just fileId string
        return {
          fileId: attachment,
          filename: 'Attachment',
          mimetype: 'application/octet-stream'
        };
      } else {
        // New format: object with fileId, filename, mimetype
        return attachment;
      }
    });
  };

  // Classify attachments into displayable images vs other files
  const classifyAttachments = (attachmentObjects: Array<{fileId: string; filename: string; mimetype: string}>) => {
    const images: {fileId: string; filename: string; mimetype: string}[] = [];
    const nonImages: {fileId: string; filename: string; mimetype: string}[] = [];

    attachmentObjects.forEach(attachment => {
      // Safely check mimetype with null checks
      const mimetype = attachment.mimetype || 'application/octet-stream';
      
      // Check if it's an image based on mimetype or file extension (for legacy files)
      const isImage = mimetype.startsWith('image/') && 
                     ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'].includes(mimetype);
      
      // For legacy files, also check by fileId pattern (UUID = likely image based on our previous logic)
      const isLegacyImage = mimetype === 'application/octet-stream' && 
                           /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attachment.fileId);
      
      if (isImage || isLegacyImage) {
        images.push(attachment);
      } else {
        nonImages.push(attachment);
      }
    });

    return { images, nonImages };
  };

  const normalizedAttachments = normalizeAttachments(attachments);
  // console.log('[PostAttachmentsGrid] Normalized attachments:', normalizedAttachments);
  
  const { images, nonImages } = classifyAttachments(normalizedAttachments);
  // console.log('[PostAttachmentsGrid] Classified - Images:', images, 'Non-images:', nonImages);

  // Generate secure image URLs with auth token
  const getImageUrl = (attachment: {fileId: string; filename: string; mimetype: string}) => {
    const token = localStorage.getItem("authToken");
    const isFileId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attachment.fileId);
    
    return isFileId 
      ? `/api/files/${attachment.fileId}${token ? `?token=${encodeURIComponent(token)}` : ''}`
      : attachment.fileId;
  };

  const imageUrls = images.map(getImageUrl);

  const openLightbox = (index: number) => {
    setCurrentImageIndex(index);
    setLightboxOpen(true);
  };

  const renderImageGrid = () => {
    if (images.length === 0) return null;

    if (images.length === 1) {
      // Single image - full width
      return (
        <div className="w-full group">
          <img
            src={imageUrls[0]}
            alt="Posted image"
            className="w-full h-80 object-cover rounded-2xl cursor-pointer shadow-md hover:shadow-2xl transition-all duration-300 border border-gray-100 dark:border-gray-700 group-hover:scale-[1.01]"
            loading="lazy"
            decoding="async"
            onClick={() => openLightbox(0)}
            onError={(e) => {
              // Fallback to attachment card if image fails to load
              const target = e.target as HTMLImageElement;
              const container = target.parentElement;
              if (container) {
                container.innerHTML = `
                  <div class="flex items-center justify-between p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                    <div class="flex items-center space-x-3">
                      <svg class="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                      </svg>
                      <div class="flex flex-col">
                        <span class="text-sm font-medium">Attachment</span>
                        <span class="text-xs text-muted-foreground">File</span>
                      </div>
                    </div>
                    <button class="flex items-center space-x-1 px-2 py-1 text-xs rounded hover:bg-background/80">
                      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                      </svg>
                      <span>View</span>
                    </button>
                  </div>
                `;
              }
            }}
          />
        </div>
      );
    }

    if (images.length === 2) {
      // Two images - side by side
      return (
        <div className="grid grid-cols-2 gap-3">
          {images.map((_, index) => (
            <div key={index} className="group overflow-hidden rounded-2xl">
              <img
                src={imageUrls[index]}
                alt={`Posted image ${index + 1}`}
                className="w-full h-64 object-cover cursor-pointer shadow-md hover:shadow-2xl transition-all duration-300 border border-gray-100 dark:border-gray-700 group-hover:scale-105"
                loading="lazy"
                decoding="async"
                onClick={() => openLightbox(index)}
              />
            </div>
          ))}
        </div>
      );
    }

    if (images.length === 3) {
      // Mosaic layout - one large on left, two stacked on right
      return (
        <div className="grid grid-cols-2 grid-rows-2 gap-3 h-[450px]">
          <div className="col-span-1 row-span-2 group overflow-hidden rounded-2xl">
            <img
              src={imageUrls[0]}
              alt="Posted image 1"
              className="w-full h-full object-cover cursor-pointer shadow-md hover:shadow-2xl transition-all duration-300 border border-gray-100 dark:border-gray-700 group-hover:scale-105"
              loading="lazy"
              decoding="async"
              onClick={() => openLightbox(0)}
            />
          </div>
          <div className="group overflow-hidden rounded-2xl">
            <img
              src={imageUrls[1]}
              alt="Posted image 2"
              className="w-full h-full object-cover cursor-pointer shadow-md hover:shadow-2xl transition-all duration-300 border border-gray-100 dark:border-gray-700 group-hover:scale-105"
              loading="lazy"
              decoding="async"
              onClick={() => openLightbox(1)}
            />
          </div>
          <div className="group overflow-hidden rounded-2xl">
            <img
              src={imageUrls[2]}
              alt="Posted image 3"
              className="w-full h-full object-cover cursor-pointer shadow-md hover:shadow-2xl transition-all duration-300 border border-gray-100 dark:border-gray-700 group-hover:scale-105"
              loading="lazy"
              decoding="async"
              onClick={() => openLightbox(2)}
            />
          </div>
        </div>
      );
    }

    if (images.length === 4) {
      // 2x2 grid
      return (
        <div className="grid grid-cols-2 gap-3">
          {images.map((_, index) => (
            <div key={index} className="group overflow-hidden rounded-2xl">
              <img
                src={imageUrls[index]}
                alt={`Posted image ${index + 1}`}
                className="w-full h-56 object-cover cursor-pointer shadow-md hover:shadow-2xl transition-all duration-300 border border-gray-100 dark:border-gray-700 group-hover:scale-105"
                loading="lazy"
                decoding="async"
                onClick={() => openLightbox(index)}
              />
            </div>
          ))}
        </div>
      );
    }

    // 5+ images - show first 4 with +N overlay on the last one
    const remainingCount = images.length - 3;
    return (
      <div className="grid grid-cols-2 gap-3">
        {images.slice(0, 3).map((_, index) => (
          <div key={index} className="group overflow-hidden rounded-2xl">
            <img
              src={imageUrls[index]}
              alt={`Posted image ${index + 1}`}
              className="w-full h-56 object-cover cursor-pointer shadow-md hover:shadow-2xl transition-all duration-300 border border-gray-100 dark:border-gray-700 group-hover:scale-105"
              loading="lazy"
              decoding="async"
              onClick={() => openLightbox(index)}
            />
          </div>
        ))}
        <div className="relative group overflow-hidden rounded-2xl">
          <img
            src={imageUrls[3]}
            alt={`Posted image 4`}
            className="w-full h-56 object-cover cursor-pointer shadow-md hover:shadow-2xl transition-all duration-300 border border-gray-100 dark:border-gray-700 group-hover:scale-105"
            loading="lazy"
            decoding="async"
            onClick={() => openLightbox(3)}
          />
          {remainingCount > 0 && (
            <div 
              className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/60 to-black/70 backdrop-blur-sm rounded-2xl flex items-center justify-center cursor-pointer hover:from-black/80 hover:via-black/70 hover:to-black/80 transition-all duration-300"
              onClick={() => openLightbox(3)}
            >
              <div className="text-white text-3xl font-bold flex items-center drop-shadow-lg">
                <Plus className="h-8 w-8 mr-2" />
                {remainingCount}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderNonImageAttachments = () => {
    if (nonImages.length === 0) return null;

    // Separate PDFs from other files
    const pdfs = nonImages.filter(att => att.mimetype === 'application/pdf');
    const otherFiles = nonImages.filter(att => att.mimetype !== 'application/pdf');

    // Helper function to render a single PDF card
    const renderPDFCard = (pdf: typeof nonImages[0]) => {
      const handleFileView = () => {
        const token = localStorage.getItem("authToken");
        window.open(`/api/files/${pdf.fileId}${token ? `?token=${encodeURIComponent(token)}` : ''}`, '_blank');
      };

      return (
        <div 
          className="group cursor-pointer bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-3 hover:shadow-lg transition-all duration-300 hover:scale-[1.005]"
          onClick={handleFileView}
        >
          <div className="flex items-center space-x-3">
            {/* PDF Icon */}
            <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg p-2.5 shadow-md group-hover:shadow-lg transition-shadow">
              <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
                <path d="M14 2v6h6"/>
                <text x="7" y="18" fontSize="6" fill="white" fontWeight="bold">PDF</text>
              </svg>
            </div>
            
            {/* File Info */}
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1" title={pdf.filename}>
                {pdf.filename}
              </span>
              <span className="text-xs text-gray-600 dark:text-gray-400">
                PDF Document
              </span>
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="mt-3 space-y-2">
        {/* Render all PDFs with card style */}
        {pdfs.map((pdf, index) => (
          <div key={`pdf-${index}`}>
            {renderPDFCard(pdf)}
          </div>
        ))}

        {/* Render other files in list style */}
        {otherFiles.length > 0 && (
          <>
            {pdfs.length > 0 && <div className="pt-1" />}
            <div className="text-sm font-medium text-muted-foreground">Other Attachments:</div>
            {otherFiles.map((attachment, index) => {
              const handleFileView = () => {
                const token = localStorage.getItem("authToken");
                window.open(`/api/files/${attachment.fileId}${token ? `?token=${encodeURIComponent(token)}` : ''}`, '_blank');
              };

              const getFileTypeDisplay = (mimetype: string, filename: string) => {
                if (mimetype === 'text/plain') {
                  return { label: filename, type: 'Text File' };
                } else if (mimetype === 'application/octet-stream' && filename === 'Attachment') {
                  return { label: 'Attachment', type: 'Legacy File' };
                } else {
                  return { label: filename, type: 'Document' };
                }
              };

              const { label, type } = getFileTypeDisplay(attachment.mimetype, attachment.filename);

              return (
                <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium" title={label}>
                        {label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {type}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex items-center space-x-1"
                    onClick={handleFileView}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                    </svg>
                    <span className="text-xs">View</span>
                  </Button>
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {renderImageGrid()}
      {renderNonImageAttachments()}
      
      {images.length > 0 && (
        <ImageLightbox
          images={imageUrls}
          isOpen={lightboxOpen}
          currentIndex={currentImageIndex}
          onClose={() => setLightboxOpen(false)}
          onIndexChange={setCurrentImageIndex}
        />
      )}
    </div>
  );
}