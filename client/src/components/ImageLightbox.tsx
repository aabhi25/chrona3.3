import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface ImageLightboxProps {
  images: string[];
  isOpen: boolean;
  currentIndex: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

export function ImageLightbox({ 
  images, 
  isOpen, 
  currentIndex, 
  onClose, 
  onIndexChange 
}: ImageLightboxProps) {
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<number>>(new Set());

  // Preload adjacent images for smooth navigation
  useEffect(() => {
    if (!isOpen || images.length <= 1) return;

    const preloadImage = (src: string) => {
      const img = new Image();
      img.src = src;
    };

    // Preload previous and next images
    const prevIndex = (currentIndex - 1 + images.length) % images.length;
    const nextIndex = (currentIndex + 1) % images.length;
    
    if (prevIndex !== currentIndex) preloadImage(images[prevIndex]);
    if (nextIndex !== currentIndex) preloadImage(images[nextIndex]);
  }, [isOpen, currentIndex, images]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          navigateToPrevious();
          break;
        case 'ArrowRight':
          event.preventDefault();
          navigateToNext();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, images.length]);

  const navigateToPrevious = () => {
    const newIndex = (currentIndex - 1 + images.length) % images.length;
    onIndexChange(newIndex);
  };

  const navigateToNext = () => {
    const newIndex = (currentIndex + 1) % images.length;
    onIndexChange(newIndex);
  };

  const handleImageError = (index: number) => {
    setImageLoadErrors(prev => new Set(prev).add(index));
  };

  const currentImageUrl = images[currentIndex];
  const hasError = imageLoadErrors.has(currentIndex);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-screen-lg w-full h-[90vh] p-0 overflow-hidden bg-black/95 border-none">
        <VisuallyHidden>
          <DialogTitle>Image Viewer</DialogTitle>
          <DialogDescription>
            Viewing image {currentIndex + 1} of {images.length}. Use arrow keys to navigate or press Escape to close.
          </DialogDescription>
        </VisuallyHidden>
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 z-10 text-white hover:bg-white/20 rounded-full"
            onClick={onClose}
          >
            <X className="h-6 w-6" />
          </Button>

          {/* Image counter */}
          {images.length > 1 && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
              {currentIndex + 1} of {images.length}
            </div>
          )}

          {/* Previous button */}
          {images.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-4 z-10 text-white hover:bg-white/20 rounded-full w-12 h-12"
              onClick={navigateToPrevious}
            >
              <ChevronLeft className="h-8 w-8" />
            </Button>
          )}

          {/* Next button */}
          {images.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 z-10 text-white hover:bg-white/20 rounded-full w-12 h-12"
              onClick={navigateToNext}
            >
              <ChevronRight className="h-8 w-8" />
            </Button>
          )}

          {/* Main image */}
          <div className="w-full h-full flex items-center justify-center p-8">
            {hasError ? (
              <div className="text-white text-center">
                <div className="text-lg mb-2">Failed to load image</div>
                <Button
                  variant="outline"
                  onClick={() => window.open(currentImageUrl, '_blank')}
                  className="text-white border-white hover:bg-white/20"
                >
                  Open in new tab
                </Button>
              </div>
            ) : (
              <img
                src={currentImageUrl}
                alt={`Image ${currentIndex + 1}`}
                className="max-w-full max-h-full object-contain"
                onError={() => handleImageError(currentIndex)}
                onLoad={() => {
                  // Remove error state if image loads successfully
                  setImageLoadErrors(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(currentIndex);
                    return newSet;
                  });
                }}
              />
            )}
          </div>

          {/* Mobile touch areas for navigation */}
          {images.length > 1 && (
            <>
              <div
                className="absolute left-0 top-0 w-1/3 h-full z-5 cursor-pointer md:hidden"
                onClick={navigateToPrevious}
              />
              <div
                className="absolute right-0 top-0 w-1/3 h-full z-5 cursor-pointer md:hidden"
                onClick={navigateToNext}
              />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}