import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatDistanceToNow } from "date-fns";
import { 
  MessageSquare, 
  Send, 
  Paperclip, 
  MoreHorizontal,
  Edit,
  Trash2,
  School,
  Users,
  X,
  FileText,
  Image,
  Download,
  FileCheck,
  BookOpen
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PostAttachmentsGrid } from "@/components/PostAttachmentsGrid";
import { PostContent } from "@/components/PostContent";

interface Post {
  id: string;
  content: string;
  attachments: Array<{fileId: string; filename: string; mimetype: string}>;
  postedById: string;
  feedScope: 'school' | 'class';
  classId?: string | null;
  schoolId: string;
  isActive: boolean;
  isCircular?: boolean;
  isResource?: boolean;
  createdAt: string;
  updatedAt: string;
  // Additional fields from join (if available)
  authorName?: string;
  authorRole?: string;
}

interface NewsfeedProps {
  feedScope: 'school' | 'class';
  classId?: string;
  className?: string;
  showPostForm?: boolean;
}

export default function Newsfeed({ 
  feedScope, 
  classId, 
  className = "", 
  showPostForm = true 
}: NewsfeedProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newPostContent, setNewPostContent] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [editingPost, setEditingPost] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [selectedAttachments, setSelectedAttachments] = useState<Array<{
    file: File;
    fileId?: string;
    filename?: string;
    mimetype?: string;
    uploading?: boolean;
  }>>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [postFilter, setPostFilter] = useState<'all' | 'circular' | 'resource'>('all');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canPost = user?.role === 'admin' || user?.role === 'teacher';

  // Auto-resize textarea as user types
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNewPostContent(e.target.value);
    
    // Auto-expand textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  // Fetch posts with infinite scroll pagination
  const {
    data: postsData,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<Post[]>({
    queryKey: ["/api/posts", { feedScope, classId, filter: postFilter }],
    queryFn: async ({ pageParam = 0 }) => {
      const offset = typeof pageParam === 'number' ? pageParam : 0;
      const params = new URLSearchParams({ 
        feedScope,
        offset: offset.toString(),
        limit: '5', // Load 5 posts per page
        filter: postFilter
      });
      if (classId) params.append('classId', classId);
      
      const response = await apiRequest("GET", `/api/posts?${params.toString()}`);
      return response.json() as Promise<Post[]>;
    },
    getNextPageParam: (lastPage, allPages) => {
      // More robust pagination: sum all loaded items to avoid skipping
      if (lastPage && lastPage.length === 5) {
        // Calculate total items loaded so far
        const totalLoaded = allPages.reduce((sum, page) => sum + page.length, 0);
        return totalLoaded; // Use sum as next offset
      }
      return undefined; // No more pages
    },
    initialPageParam: 0,
    // Remove periodic refetch to avoid duplication/jumps in infinite scroll
    // refetchInterval: 30000,
  });

  // Flatten all pages into a single array of posts and remove duplicates
  const posts = useMemo(() => {
    const allPosts = postsData?.pages.flat() || [];
    // Deduplicate posts by ID to prevent rendering duplicates
    const uniquePosts = Array.from(
      new Map(allPosts.map(post => [post.id, post])).values()
    );
    return uniquePosts;
  }, [postsData]);

  // Intersection observer for infinite scroll
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Auto-load more posts when reaching second-to-last post
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Set up intersection observer for auto-loading
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          loadMore();
        }
      },
      {
        threshold: 0.1, // Trigger when 10% of the element is visible
        rootMargin: '100px', // Start loading 100px before the element comes into view
      }
    );

    // Observe the second-to-last post element
    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadMore, posts.length]); // Re-run when posts change

  // File upload mutation
  const uploadFileMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('attachment', file);
      
      // Use direct fetch for file uploads with proper authentication
      const token = localStorage.getItem("authToken");
      const headers: Record<string, string> = {};
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const response = await fetch('/api/posts/upload-attachment', {
        method: 'POST',
        headers,
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || 'Failed to upload file');
      }
      
      return response.json();
    },
  });

  // Create post mutation
  const createPostMutation = useMutation({
    mutationFn: async (postData: { 
      content: string; 
      feedScope: string; 
      classId?: string; 
      attachments?: Array<{fileId: string; filename: string; mimetype: string}> 
    }) => {
      const response = await apiRequest("POST", "/api/posts", postData);
      return response.json();
    },
    onSuccess: () => {
      // Reset all filter variants of the posts query
      queryClient.resetQueries({
        predicate: (query) => {
          const key = query.queryKey as [string, Record<string, any>];
          return key[0] === "/api/posts" && 
                 key[1]?.feedScope === feedScope && 
                 key[1]?.classId === classId;
        }
      });
      setNewPostContent("");
      setSelectedAttachments([]);
      setIsPosting(false);
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      
      toast({
        title: "Success",
        description: "Post created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create post",
        variant: "destructive",
      });
    },
  });

  // Update post mutation
  const updatePostMutation = useMutation({
    mutationFn: async ({ id, content, isCircular, isResource }: { id: string; content?: string; isCircular?: boolean; isResource?: boolean }) => {
      const response = await apiRequest("PUT", `/api/posts/${id}`, { content, isCircular, isResource });
      return response.json();
    },
    onSuccess: () => {
      // Reset all filter variants of the posts query
      queryClient.resetQueries({
        predicate: (query) => {
          const key = query.queryKey as [string, Record<string, any>];
          return key[0] === "/api/posts" && 
                 key[1]?.feedScope === feedScope && 
                 key[1]?.classId === classId;
        }
      });
      setEditingPost(null);
      setEditContent("");
      toast({
        title: "Success",
        description: "Post updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update post",
        variant: "destructive",
      });
    },
  });

  // Delete post mutation
  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const response = await apiRequest("DELETE", `/api/posts/${postId}`);
      return response.json();
    },
    onSuccess: () => {
      // Reset all filter variants of the posts query
      queryClient.resetQueries({
        predicate: (query) => {
          const key = query.queryKey as [string, Record<string, any>];
          return key[0] === "/api/posts" && 
                 key[1]?.feedScope === feedScope && 
                 key[1]?.classId === classId;
        }
      });
      toast({
        title: "Success", 
        description: "Post deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete post",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    // Validate file types before upload
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const allowedDocTypes = ['application/pdf', 'text/plain'];
    const allAllowedTypes = [...allowedImageTypes, ...allowedDocTypes];

    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    Array.from(files).forEach(file => {
      if (allAllowedTypes.includes(file.type)) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    });

    // Show error for invalid files
    if (invalidFiles.length > 0) {
      toast({
        title: "Some Files Not Supported",
        description: `These files cannot be displayed in the grid: ${invalidFiles.join(', ')}. Only JPEG, PNG, GIF, WebP images and PDF/TXT documents are supported.`,
        variant: "destructive",
      });
    }

    // Only process valid files
    if (validFiles.length === 0) {
      event.target.value = '';
      return;
    }

    setIsUploadingFiles(true);
    const newAttachments = validFiles.map(file => ({ file, uploading: true }));
    setSelectedAttachments(prev => [...prev, ...newAttachments]);

    // Upload files one by one
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      try {
        const result = await uploadFileMutation.mutateAsync(file);
        setSelectedAttachments(prev => 
          prev.map(attachment => 
            attachment.file === file 
              ? { 
                  ...attachment, 
                  fileId: result.fileId, 
                  filename: result.filename,
                  mimetype: result.mimetype,
                  uploading: false 
                }
              : attachment
          )
        );
      } catch (error) {
        toast({
          title: "Upload Failed",
          description: `Failed to upload ${file.name}`,
          variant: "destructive",
        });
        setSelectedAttachments(prev => prev.filter(attachment => attachment.file !== file));
      }
    }
    setIsUploadingFiles(false);
    
    // Clear the input
    event.target.value = '';
  };

  const removeAttachment = (fileToRemove: File) => {
    setSelectedAttachments(prev => prev.filter(attachment => attachment.file !== fileToRemove));
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim() && selectedAttachments.length === 0) return;
    
    // Check if all files are uploaded
    const hasUploadingFiles = selectedAttachments.some(attachment => attachment.uploading);
    if (hasUploadingFiles) {
      toast({
        title: "Please Wait",
        description: "Please wait for all files to finish uploading",
        variant: "destructive",
      });
      return;
    }
    
    setIsPosting(true);
    const attachmentObjects = selectedAttachments
      .filter(attachment => attachment.fileId && attachment.filename && attachment.mimetype)
      .map(attachment => ({
        fileId: attachment.fileId!,
        filename: attachment.filename!,
        mimetype: attachment.mimetype!
      }));
    
    createPostMutation.mutate({
      content: newPostContent.trim(),
      feedScope,
      classId: feedScope === 'class' ? classId : undefined,
      attachments: attachmentObjects,
    });
  };

  const handleEditPost = (post: Post) => {
    setEditingPost(post.id);
    setEditContent(post.content);
  };

  const handleUpdatePost = () => {
    if (!editContent.trim() || !editingPost) return;
    
    updatePostMutation.mutate({
      id: editingPost,
      content: editContent.trim(),
    });
  };

  const handleDeletePost = (postId: string) => {
    setPostToDelete(postId);
  };

  const confirmDeletePost = () => {
    if (postToDelete) {
      deletePostMutation.mutate(postToDelete);
      setPostToDelete(null);
    }
  };

  const handleToggleCircular = (post: Post) => {
    updatePostMutation.mutate({
      id: post.id,
      isCircular: !post.isCircular,
    });
  };

  const handleToggleResource = (post: Post) => {
    updatePostMutation.mutate({
      id: post.id,
      isResource: !post.isResource,
    });
  };

  const getAuthorInitials = (post: Post) => {
    if (post.authorName) {
      const names = post.authorName.split(' ');
      return names.map(n => n[0]).join('').toUpperCase();
    }
    return post.postedById.slice(0, 2).toUpperCase();
  };

  const canEditPost = (post: Post) => {
    return post.postedById === user?.id || user?.role === 'admin';
  };

  if (error) {
    return (
      <Card className={`border-red-200 ${className}`}>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            Failed to load posts. Please try again.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`bg-gradient-to-br from-purple-50/70 via-white/80 to-purple-100/60 dark:from-slate-800/90 dark:via-slate-700/80 dark:to-slate-800/70 border-purple-200/50 dark:border-slate-600 shadow-lg hover:shadow-xl transition-shadow duration-300 overflow-hidden ${className}`}>
        <CardHeader className="pb-4 pt-5 px-8 bg-gradient-to-r from-purple-50/60 via-white/40 to-violet-50/50 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded-t-xl border-b border-purple-100/50 dark:border-slate-600">
          <CardTitle className="flex items-center space-x-2.5">
            {feedScope === 'school' ? (
              <>
                <div className="p-1.5 bg-gradient-to-br from-purple-500 to-violet-600 rounded-lg">
                  <School className="h-4 w-4 text-white" strokeWidth={2.5} />
                </div>
                <span className="text-lg font-semibold text-purple-700 dark:text-purple-300">School Newsfeed</span>
              </>
            ) : (
              <>
                <div className="p-1.5 bg-gradient-to-br from-purple-500 to-violet-600 rounded-lg">
                  <Users className="h-4 w-4 text-white" strokeWidth={2.5} />
                </div>
                <span className="text-lg font-semibold text-purple-700 dark:text-purple-300">Class Newsfeed</span>
              </>
            )}
          </CardTitle>
        </CardHeader>

        {/* Filter Tabs */}
        <div className="px-8 pt-4 pb-3 bg-white/40 dark:bg-slate-800/40 border-b border-purple-100/50 dark:border-slate-600">
          <div className="flex items-center gap-3">
            <Button
              variant={postFilter === 'all' ? 'default' : 'ghost'}
              size="default"
              onClick={() => setPostFilter('all')}
              className={`rounded-xl px-6 py-5 transition-all duration-300 font-medium ${
                postFilter === 'all' 
                  ? 'bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-white shadow-lg shadow-slate-900/20' 
                  : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-100 hover:bg-purple-50/50 dark:hover:bg-slate-700/50'
              }`}
            >
              All Posts
            </Button>
            <Button
              variant={postFilter === 'circular' ? 'default' : 'ghost'}
              size="default"
              onClick={() => setPostFilter('circular')}
              className={`rounded-xl px-6 py-5 transition-all duration-300 font-medium ${
                postFilter === 'circular' 
                  ? 'bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-white shadow-lg shadow-slate-900/20' 
                  : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-100 hover:bg-purple-50/50 dark:hover:bg-slate-700/50'
              }`}
            >
              <FileText className="h-4 w-4 mr-2" />
              Circulars
            </Button>
            <Button
              variant={postFilter === 'resource' ? 'default' : 'ghost'}
              size="default"
              onClick={() => setPostFilter('resource')}
              className={`rounded-xl px-6 py-5 transition-all duration-300 font-medium ${
                postFilter === 'resource' 
                  ? 'bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-white shadow-lg shadow-slate-900/20' 
                  : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-gray-100 hover:bg-purple-50/50 dark:hover:bg-slate-700/50'
              }`}
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Resources
            </Button>
          </div>
        </div>
      
      <CardContent className="space-y-5 p-6">
        {/* Post Creation Form */}
        {showPostForm && canPost && (
          <div className="space-y-4 pb-5 border-b border-purple-100/50 dark:border-slate-600 bg-gradient-to-br from-purple-50/40 via-white/60 to-violet-50/30 dark:from-slate-700/60 dark:via-slate-600/50 dark:to-slate-700/60 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300">
            <Textarea
              ref={textareaRef}
              placeholder={`Share something with the ${feedScope === 'school' ? 'school' : 'class'}...`}
              value={newPostContent}
              onChange={handleTextareaChange}
              className="min-h-[100px] max-h-[400px] resize-none overflow-y-auto bg-white dark:bg-slate-700 border-2 border-purple-200/60 dark:border-slate-500 focus:border-purple-400 dark:focus:border-purple-400 shadow-sm focus:shadow-md hover:shadow-md transition-all duration-300 rounded-2xl text-base dark:text-gray-100 dark:placeholder:text-gray-400 px-5 py-4"
            />
            
            {/* Selected Attachments Display */}
            {selectedAttachments.length > 0 && (
              <div className="space-y-3">
                <div className="text-sm font-semibold text-slate-700 dark:text-gray-300">Attachments:</div>
                <div className="space-y-2">
                  {selectedAttachments.map((attachment, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-100/60 via-white/70 to-violet-100/50 dark:from-slate-600/70 dark:via-slate-500/60 dark:to-slate-600/70 rounded-xl border border-purple-200/50 dark:border-slate-500 shadow-sm hover:shadow transition-all duration-200">
                      <div className="flex items-center space-x-3">
                        {attachment.file.type.startsWith('image/') ? (
                          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                            <Image className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                        ) : (
                          <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                            <FileText className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                          </div>
                        )}
                        <span className="text-sm font-medium dark:text-slate-200">{attachment.file.name}</span>
                        {attachment.uploading && (
                          <div className="text-xs font-medium text-blue-600 dark:text-blue-400">Uploading...</div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAttachment(attachment.file)}
                        className="h-8 w-8 p-0 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400"
                        disabled={attachment.uploading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center space-x-3">
                <input
                  type="file"
                  id="file-upload"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="default"
                  className="flex items-center space-x-2 rounded-xl px-5 py-5 border-purple-200 dark:border-slate-500 hover:bg-purple-50 dark:hover:bg-slate-700 hover:border-purple-300 dark:hover:border-purple-400 transition-all duration-300"
                  onClick={() => document.getElementById('file-upload')?.click()}
                  disabled={isUploadingFiles}
                >
                  <Paperclip className="h-4 w-4" />
                  <span className="font-medium">{isUploadingFiles ? 'Uploading...' : 'Attach File'}</span>
                </Button>
                <Badge variant="outline" className="text-sm font-medium px-3 py-1.5 rounded-lg border-purple-300 dark:border-slate-500 text-purple-700 dark:text-purple-300">
                  {feedScope === 'school' ? 'School' : 'Class'} Feed
                </Badge>
              </div>
              <Button
                onClick={handleCreatePost}
                disabled={(!newPostContent.trim() && selectedAttachments.length === 0) || isPosting || isUploadingFiles}
                className="flex items-center space-x-2 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white shadow-md hover:shadow-lg transition-all duration-300 rounded-xl px-6 py-5 font-medium"
              >
                <Send className="h-4 w-4" />
                <span>{isPosting ? 'Posting...' : 'Post'}</span>
              </Button>
            </div>
          </div>
        )}

        {/* Posts List */}
        <div className="space-y-5">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse p-6 border border-purple-200/40 dark:border-slate-600 rounded-2xl bg-white dark:bg-slate-800 shadow-sm">
                  <div className="flex space-x-4">
                    <div className="rounded-full bg-purple-200 dark:bg-slate-600 h-12 w-12"></div>
                    <div className="flex-1 space-y-3">
                      <div className="h-4 bg-purple-100 dark:bg-slate-600 rounded-lg w-1/4"></div>
                      <div className="h-4 bg-purple-100 dark:bg-slate-600 rounded-lg w-full"></div>
                      <div className="h-4 bg-purple-100 dark:bg-slate-600 rounded-lg w-3/4"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground dark:text-gray-300">
              <div className="p-6 bg-purple-50/50 dark:bg-slate-700/30 rounded-2xl inline-block mb-4">
                <MessageSquare className="h-16 w-16 opacity-40 dark:opacity-30 text-purple-400 dark:text-purple-500" />
              </div>
              <p className="text-lg font-medium">No posts yet. {canPost ? 'Be the first to share something!' : ''}</p>
            </div>
          ) : (
            posts.map((post, index) => (
              <div 
                key={post.id} 
                className="space-y-4 p-6 border border-purple-200/40 dark:border-slate-600 rounded-2xl bg-white dark:bg-slate-800 shadow-sm hover:shadow-lg transition-all duration-300"
                ref={posts.length > 2 && index === posts.length - 2 ? loadMoreRef : null} // Add ref to second-to-last post (only if we have more than 2 posts)
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <Avatar className="h-12 w-12 ring-2 ring-purple-100 dark:ring-slate-600">
                      <AvatarFallback className="text-base font-semibold bg-gradient-to-br from-purple-500 to-violet-600 text-white">
                        {getAuthorInitials(post)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 flex-wrap gap-2 mb-1">
                        <p className="font-semibold text-base dark:text-slate-100">
                          {post.authorName || `User ${post.postedById.slice(0, 8)}`}
                        </p>
                        {post.authorRole && (
                          <Badge variant="secondary" className="text-xs capitalize font-medium px-2.5 py-0.5 rounded-lg">
                            {post.authorRole.replace('_', ' ')}
                          </Badge>
                        )}
                        <Badge 
                          variant="outline" 
                          className={`text-xs font-medium px-2.5 py-0.5 rounded-lg ${
                            post.feedScope === 'school' 
                              ? 'border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20' 
                              : 'border-green-300 dark:border-green-600 text-green-700 dark:text-green-400 bg-green-50/50 dark:bg-green-900/20'
                          }`}
                        >
                          {post.feedScope === 'school' ? 'School' : 'Class'}
                        </Badge>
                        {post.isCircular && (
                          <Badge variant="default" className="text-xs font-medium px-2.5 py-0.5 rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700">
                            <FileCheck className="h-3 w-3 mr-1" />
                            Circular
                          </Badge>
                        )}
                        {post.isResource && (
                          <Badge variant="default" className="text-xs font-medium px-2.5 py-0.5 rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700">
                            <BookOpen className="h-3 w-3 mr-1" />
                            Resource
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs font-medium text-muted-foreground dark:text-gray-400 mt-1">
                        {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  
                  {/* Post Actions */}
                  {canEditPost(post) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditPost(post)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleCircular(post)}>
                          <FileCheck className="h-4 w-4 mr-2" />
                          {post.isCircular ? 'Unmark as Circular' : 'Mark as Circular'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleResource(post)}>
                          <BookOpen className="h-4 w-4 mr-2" />
                          {post.isResource ? 'Unmark as Resource' : 'Mark as Resource'}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeletePost(post.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {/* Post Content */}
                <div className="pl-16">
                  {editingPost === post.id ? (
                    <div className="space-y-4">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="min-h-[80px] resize-none bg-white/90 dark:bg-slate-600/50 border-2 border-purple-200/60 dark:border-slate-500 focus:border-purple-400 dark:focus:border-purple-400 dark:text-gray-100 rounded-xl px-4 py-3"
                      />
                      <div className="flex items-center space-x-3">
                        <Button
                          size="default"
                          onClick={handleUpdatePost}
                          disabled={!editContent.trim()}
                          className="rounded-xl px-5 py-5 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700"
                        >
                          Save
                        </Button>
                        <Button
                          size="default"
                          variant="outline"
                          onClick={() => {
                            setEditingPost(null);
                            setEditContent("");
                          }}
                          className="rounded-xl px-5 py-5"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {post.content && (
                        <div className="mb-4">
                          <PostContent content={post.content} className="text-base leading-relaxed" />
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* Attachments (if any) */}
                  {post.attachments && post.attachments.length > 0 && (
                    <div className="mt-4">
                      <PostAttachmentsGrid attachments={post.attachments} />
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {/* Loading indicator for infinite scroll */}
          {isFetchingNextPage && (
            <div className="flex justify-center py-4">
              <div className="animate-pulse flex space-x-2">
                <div className="h-2 w-2 bg-purple-400 rounded-full animate-bounce"></div>
                <div className="h-2 w-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="h-2 w-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          )}
        </div>
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={postToDelete !== null} onOpenChange={(open) => !open && setPostToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this post? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeletePost} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}