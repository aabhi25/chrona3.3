import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send, Plus, Search, Users, Circle, CircleDot, ArrowLeft, Menu, Trash2, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

const messageSchema = z.object({
  receiverId: z.string().min(1, "Please select a recipient"),
  content: z.string().min(1, "Message cannot be empty").max(1000, "Message too long"),
});

type MessageFormData = z.infer<typeof messageSchema>;

interface User {
  id: string;
  name: string;
  email?: string;
  role: string;
  profilePictureUrl?: string;
}

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  senderName: string;
  receiverName: string;
}

interface Conversation {
  otherUserId: string;
  otherUserName: string;
  otherUserRole: string;
  otherUserProfilePicture?: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isLastMessageFromMe: boolean;
}

interface SelectedConversation {
  userId: string;
  userType: string;
}

export default function MessagingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedConversation, setSelectedConversation] = useState<SelectedConversation | null>(null);
  const [isComposeDialogOpen, setIsComposeDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showMobileConversations, setShowMobileConversations] = useState(true);
  const [recipientSearchTerm, setRecipientSearchTerm] = useState("");
  const [showNewMessageForm, setShowNewMessageForm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const form = useForm<MessageFormData>({
    resolver: zodResolver(messageSchema),
    defaultValues: {
      receiverId: "",
      content: "",
    },
  });

  const { data: conversations = [], isLoading: conversationsLoading } = useQuery({
    queryKey: ["/api/messages/conversations"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/messages/conversations");
      return await response.json();
    },
    refetchInterval: 5000,
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ["/api/messages/conversation", selectedConversation?.userType, selectedConversation?.userId],
    queryFn: async () => {
      if (!selectedConversation) return [];
      const response = await apiRequest("GET", `/api/messages/conversation/${selectedConversation.userType}/${selectedConversation.userId}`);
      return await response.json();
    },
    enabled: !!selectedConversation,
    refetchInterval: 3000,
  });

  const { data: allowedUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ["/api/messages/allowed-users"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/messages/allowed-users");
      return await response.json();
    },
  });

  const filteredRecipients = allowedUsers.filter((allowedUser: User) => {
    if (!allowedUser || !allowedUser.role || !allowedUser.name) return false;
    const searchMatch = recipientSearchTerm === "" || 
      allowedUser.name.toLowerCase().startsWith(recipientSearchTerm.toLowerCase());
    return searchMatch;
  }).slice(0, 7);

  const selectedRecipientName = form.watch("receiverId") ? 
    allowedUsers.find((user: User) => user.id === form.watch("receiverId"))?.name || "" : 
    "";

  const resetForm = () => {
    form.reset();
    setRecipientSearchTerm("");
    setIsComposeDialogOpen(false);
    setShowNewMessageForm(false);
  };

  const handleRecipientSelect = (userId: string) => {
    form.setValue("receiverId", userId);
    setRecipientSearchTerm("");
  };

  const { data: unreadData } = useQuery({
    queryKey: ["/api/messages/unread-count"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/messages/unread-count");
      return await response.json();
    },
    refetchInterval: 5000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: MessageFormData) => {
      const recipient = allowedUsers.find((u: User) => u.id === messageData.receiverId);
      const receiverType = recipient?.role || 'student';
      
      const response = await apiRequest("POST", "/api/messages/send", {
        receiverId: messageData.receiverId,
        receiverType,
        content: messageData.content,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/conversation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/unread-count"] });
      resetForm();
      toast({
        title: "Success",
        description: "Message sent successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const sendQuickReplyMutation = useMutation({
    mutationFn: async (messageData: { content: string }) => {
      if (!selectedConversation) throw new Error("No conversation selected");
      
      const response = await apiRequest("POST", "/api/messages/send", {
        receiverId: selectedConversation.userId,
        receiverType: selectedConversation.userType,
        content: messageData.content,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/conversation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/unread-count"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (conversation: SelectedConversation) => {
      const response = await apiRequest("PUT", `/api/messages/conversation/${conversation.userType}/${conversation.userId}/read`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/unread-count"] });
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (conversation: SelectedConversation) => {
      const response = await apiRequest("DELETE", `/api/messages/conversation/${conversation.userType}/${conversation.userId}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/messages/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/messages/unread-count"] });
      setSelectedConversation(null);
      setShowMobileConversations(true);
      setIsDeleteDialogOpen(false);
      toast({
        title: "Success",
        description: "Conversation deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete conversation",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (selectedConversation) {
      markAsReadMutation.mutate(selectedConversation);
    }
  }, [selectedConversation]);

  const handleSendMessage = (data: MessageFormData) => {
    sendMessageMutation.mutate(data);
  };

  const filteredConversations = conversations.filter((conv: Conversation) =>
    conv.otherUserName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedConversationData = conversations.find(
    (conv: Conversation) => conv.otherUserId === selectedConversation?.userId
  );

  const getRoleGradient = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-gradient-to-r from-red-500 to-pink-500";
      case "teacher":
        return "bg-gradient-to-r from-blue-500 to-cyan-500";
      case "student":
        return "bg-gradient-to-r from-green-500 to-emerald-500";
      case "parent":
        return "bg-gradient-to-r from-purple-500 to-violet-500";
      default:
        return "bg-gradient-to-r from-gray-500 to-slate-500";
    }
  };

  const getMessagingPermissionsText = () => {
    switch (user?.role) {
      case "admin":
      case "super_admin":
        return "You can message teachers, students, parents, and other admins";
      case "teacher":
        return "You can message teachers, students, parents, and admins";
      case "student":
        return "You can only message teachers";
      case "parent":
        return "You can only message teachers";
      default:
        return "";
    }
  };

  const handleConversationSelect = (conversation: Conversation) => {
    const userType = conversation.otherUserRole;
    setSelectedConversation({
      userId: conversation.otherUserId,
      userType
    });
    setShowMobileConversations(false);
  };

  const handleMobileBack = () => {
    setSelectedConversation(null);
    setShowMobileConversations(true);
  };

  const handleDeleteConversation = () => {
    if (selectedConversation) {
      deleteConversationMutation.mutate(selectedConversation);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-blue-50/50 via-purple-50/30 to-pink-50/50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Mobile Header */}
      <div className="md:hidden border-b dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {!showMobileConversations && selectedConversation && (
              <Button variant="ghost" size="sm" onClick={handleMobileBack} className="hover:bg-blue-50 dark:hover:bg-gray-700">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div>
              <h1 className="text-lg md:text-xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {!showMobileConversations && selectedConversationData
                  ? selectedConversationData.otherUserName
                  : "Messages"
                }
              </h1>
              {!showMobileConversations && selectedConversationData && (
                <div className="flex items-center space-x-2 mt-1">
                  <Badge className={`text-xs ${getRoleGradient(selectedConversationData.otherUserRole)} text-white border-0`}>
                    {selectedConversationData.otherUserRole}
                  </Badge>
                  <div className="flex items-center space-x-1">
                    <div className="relative">
                      <Circle className="h-2 w-2 fill-green-500 text-green-500 animate-pulse" />
                      <div className="absolute inset-0 h-2 w-2 bg-green-500 rounded-full animate-ping opacity-75"></div>
                    </div>
                    <span className="text-xs text-muted-foreground dark:text-gray-400">Online</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          {showMobileConversations ? (
            <Dialog open={isComposeDialogOpen} onOpenChange={setIsComposeDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 shadow-lg shadow-blue-500/30">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[540px]">
                <DialogHeader>
                  <DialogTitle className="text-xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Send New Message</DialogTitle>
                  <DialogDescription>
                    Send a message to another user in your school
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSendMessage)} className="space-y-2">
                    <FormField
                      control={form.control}
                      name="receiverId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Recipient</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a recipient" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {allowedUsers.map((allowedUser: User) => (
                                <SelectItem key={allowedUser.id} value={allowedUser.id}>
                                  <div className="flex items-center space-x-2">
                                    <span>{allowedUser.name}</span>
                                    <Badge className={`text-xs ${getRoleGradient(allowedUser.role)} text-white border-0`}>
                                      {allowedUser.role}
                                    </Badge>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="content"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Message</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Type your message..."
                              className="min-h-[140px] resize-none"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button 
                        type="submit" 
                        disabled={sendMessageMutation.isPending}
                        className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 shadow-lg shadow-blue-500/30"
                      >
                        {sendMessageMutation.isPending ? "Sending..." : "Send Message"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setIsDeleteDialogOpen(true)} className="hover:bg-red-50">
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          )}
        </div>
      </div>

      {/* Messaging Permissions Info */}
      <div className="px-4 md:px-6 lg:px-8 py-2 border-b dark:border-gray-700 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-gray-800/50 dark:to-gray-900/50">
        <p className="text-xs md:text-sm text-muted-foreground dark:text-gray-400 flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
          <span>{getMessagingPermissionsText()}</span>
        </p>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex md:p-6 lg:p-8 overflow-hidden">
        <div className="flex w-full md:gap-6 h-full">
          {/* Conversations List */}
          <div className={`${
            showMobileConversations ? 'block' : 'hidden'
          } md:block w-full md:w-80 lg:w-96 flex-shrink-0`}>
            <Card className="h-full flex flex-col border-none md:border md:border-gray-200 dark:md:border-gray-700 rounded-none md:rounded-2xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl md:shadow-xl md:shadow-blue-500/10 overflow-hidden">
              <CardHeader className="pb-3 hidden md:block border-b dark:border-gray-700 bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-gray-800/50 dark:to-gray-900/50">
                <div className="flex justify-between items-center mb-4">
                  <CardTitle className="text-lg font-semibold dark:text-gray-200">
                    {showNewMessageForm ? "Send New Message" : "Conversations"}
                  </CardTitle>
                  {showNewMessageForm ? (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setShowNewMessageForm(false)}
                      className="border-blue-300 dark:border-gray-600"
                    >
                      Cancel
                    </Button>
                  ) : (
                    <Button 
                      size="sm" 
                      onClick={() => setShowNewMessageForm(true)}
                      className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 shadow-lg shadow-blue-500/30"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      New
                    </Button>
                  )}
                </div>
                
                {!showNewMessageForm && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search conversations..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 bg-white/80 dark:bg-gray-900/50 border-blue-100 dark:border-gray-700 focus:border-purple-300 dark:focus:border-purple-500"
                    />
                  </div>
                )}
              </CardHeader>

              <div className="p-4 md:hidden border-b dark:border-gray-700 bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-gray-800/50 dark:to-gray-900/50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search conversations..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 bg-white/80 dark:bg-gray-900/50 border-blue-100 dark:border-gray-700 focus:border-purple-300 dark:focus:border-purple-500"
                  />
                </div>
              </div>
              
              <CardContent className="flex-1 p-0 overflow-hidden">
                {showNewMessageForm ? (
                  <div className="p-6">
                    {/* Elegant Header Message */}
                    <div className="mb-6 text-center">
                      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 mb-3">
                        <Send className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <p className="text-sm text-muted-foreground dark:text-gray-400">
                        Compose and send a message to connect with users in your school
                      </p>
                    </div>

                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(handleSendMessage)} className="space-y-5">
                        {/* Recipient Selection */}
                        <FormField
                          control={form.control}
                          name="receiverId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <Users className="h-4 w-4 text-blue-500" />
                                Select Recipient
                              </FormLabel>
                              <div className="relative">
                                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-10">
                                  <Search className="h-4 w-4 text-gray-400" />
                                </div>
                                <FormControl>
                                  <Input
                                    placeholder="Search by name or email..."
                                    value={selectedRecipientName || recipientSearchTerm}
                                    onChange={(e) => {
                                      if (!selectedRecipientName) {
                                        setRecipientSearchTerm(e.target.value);
                                      }
                                    }}
                                    onFocus={() => {
                                      if (selectedRecipientName) {
                                        form.setValue("receiverId", "");
                                        setRecipientSearchTerm("");
                                      }
                                    }}
                                    className="pl-10 h-11 bg-gradient-to-r from-white to-blue-50/30 dark:from-gray-900 dark:to-blue-900/10 border-blue-200 dark:border-gray-700 focus:border-purple-400 dark:focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900/30 transition-all duration-200"
                                  />
                                </FormControl>
                                
                                {/* Recipient Dropdown */}
                                {recipientSearchTerm && filteredRecipients.length > 0 && (
                                  <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl overflow-hidden max-h-[280px] overflow-y-auto">
                                    {filteredRecipients.map((user: User) => (
                                      <button
                                        key={user.id}
                                        type="button"
                                        className="w-full px-4 py-3 text-left hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-blue-900/30 dark:hover:to-purple-900/30 focus:bg-gradient-to-r focus:from-blue-50 focus:to-purple-50 dark:focus:from-blue-900/30 dark:focus:to-purple-900/30 focus:outline-none border-b border-gray-100 dark:border-gray-700/50 last:border-b-0 transition-all duration-200"
                                        onClick={() => handleRecipientSelect(user.id)}
                                      >
                                        <div className="flex items-center space-x-3">
                                          <Avatar className="h-9 w-9 ring-2 ring-blue-100 dark:ring-blue-900/50">
                                            <AvatarImage src={user.profilePictureUrl} alt={user.name} />
                                            <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-blue-500 to-purple-500 text-white">
                                              {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                            </AvatarFallback>
                                          </Avatar>
                                          <div className="flex-1 min-w-0">
                                            <div className="flex items-center space-x-2 mb-0.5">
                                              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{user.name}</span>
                                              <Badge className={`text-[10px] px-2 py-0.5 ${getRoleGradient(user.role)} text-white border-0 shadow-sm`}>
                                                {user.role}
                                              </Badge>
                                            </div>
                                            {user.email && (
                                              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                                            )}
                                          </div>
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                )}
                                
                                {/* No Results */}
                                {recipientSearchTerm && filteredRecipients.length === 0 && (
                                  <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-4 text-center">
                                    <div className="text-gray-400 dark:text-gray-500 mb-2">
                                      <Search className="h-8 w-8 mx-auto opacity-50" />
                                    </div>
                                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No users found</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Try searching with a different name or email</p>
                                  </div>
                                )}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Message Content */}
                        <FormField
                          control={form.control}
                          name="content"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <MessageSquare className="h-4 w-4 text-purple-500" />
                                Your Message
                              </FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Write your message here..."
                                  className="min-h-[160px] resize-none bg-gradient-to-r from-white to-purple-50/30 dark:from-gray-900 dark:to-purple-900/10 border-purple-200 dark:border-gray-700 focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900/30 transition-all duration-200"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Send Button */}
                        <div className="flex justify-end pt-2">
                          <Button 
                            type="submit" 
                            disabled={sendMessageMutation.isPending}
                            className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg shadow-blue-500/40 hover:shadow-xl hover:shadow-blue-500/50 transition-all duration-300 px-8 h-11 font-semibold"
                          >
                            {sendMessageMutation.isPending ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                                Sending...
                              </>
                            ) : (
                              <>
                                <Send className="h-4 w-4 mr-2" />
                                Send Message
                              </>
                            )}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </div>
                ) : (
                  <ScrollArea className="h-full">
                  {conversationsLoading ? (
                    <div className="p-4 space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center space-x-3 p-3 animate-pulse bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-800 rounded-xl">
                          <div className="w-12 h-12 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 rounded-full flex-shrink-0"></div>
                          <div className="flex-1 space-y-2">
                            <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded-lg w-3/4"></div>
                            <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded-lg w-1/2"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : filteredConversations.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground dark:text-gray-400">
                      <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4">
                        <MessageSquare className="h-12 w-12 text-blue-500 dark:text-blue-400" />
                      </div>
                      <p className="font-semibold text-lg mb-2 dark:text-gray-300">No conversations yet</p>
                      <p className="text-sm dark:text-gray-400">Start a new conversation to get started</p>
                    </div>
                  ) : (
                    <div className="p-2">
                      {filteredConversations.map((conversation: Conversation) => (
                        <div
                          key={conversation.otherUserId}
                          className={`
                            flex items-center space-x-3 p-3 mb-2 cursor-pointer rounded-xl
                            transition-all duration-300 ease-in-out
                            hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-blue-900/30 dark:hover:to-purple-900/30
                            hover:shadow-md hover:scale-[1.02]
                            active:scale-[0.98]
                            ${selectedConversation?.userId === conversation.otherUserId 
                              ? "bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 shadow-md md:border-r-4 md:border-blue-500 dark:md:border-blue-400" 
                              : "bg-white/50 dark:bg-gray-800/50"
                            }
                          `}
                          onClick={() => handleConversationSelect(conversation)}
                        >
                          <div className="relative">
                            <Avatar className="w-12 h-12 flex-shrink-0 ring-2 ring-blue-100">
                              <AvatarImage src={conversation.otherUserProfilePicture} />
                              <AvatarFallback className={`text-sm font-medium ${getRoleGradient(conversation.otherUserRole)} text-white`}>
                                {conversation.otherUserName.split(" ").map((n: string) => n[0]).join("").toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="absolute -bottom-0.5 -right-0.5">
                              <div className="relative">
                                <Circle className="h-3 w-3 fill-green-500 text-green-500" />
                                <div className="absolute inset-0 h-3 w-3 bg-green-500 rounded-full animate-ping opacity-75"></div>
                              </div>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-1">
                              <div className="flex items-center space-x-2 min-w-0 flex-1">
                                <p className="font-semibold text-sm truncate dark:text-gray-200">{conversation.otherUserName}</p>
                                <Badge className={`text-xs ${getRoleGradient(conversation.otherUserRole)} text-white border-0 flex-shrink-0`}>
                                  {conversation.otherUserRole}
                                </Badge>
                              </div>
                              {conversation.unreadCount > 0 && (
                                <Badge className="bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs ml-2 flex-shrink-0 shadow-lg shadow-red-500/30 animate-pulse">
                                  {conversation.unreadCount}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground dark:text-gray-400 truncate">
                              {conversation.isLastMessageFromMe ? "You: " : ""}{conversation.lastMessage}
                            </p>
                            <p className="text-xs text-muted-foreground dark:text-gray-500 mt-1">
                              {formatInTimeZone(new Date(conversation.lastMessageTime), "Asia/Kolkata", "MMM d, h:mm a")}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Messages View */}
          <div className={`${
            !showMobileConversations ? 'block' : 'hidden'
          } md:block flex-1 flex flex-col min-w-0`}>
            <Card className="h-full flex flex-col md:border md:rounded-2xl border-none rounded-none bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl md:shadow-xl md:shadow-purple-500/10 overflow-hidden dark:md:border-gray-700">
              {selectedConversation ? (
                <>
                  <CardHeader className="pb-3 border-b dark:border-gray-700 hidden md:block bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-gray-800/50 dark:to-gray-900/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          <Avatar className="w-12 h-12 ring-2 ring-blue-200">
                            <AvatarImage src={selectedConversationData?.otherUserProfilePicture} />
                            <AvatarFallback className={`${getRoleGradient(selectedConversationData?.otherUserRole || "")} text-white`}>
                              {selectedConversationData?.otherUserName.split(" ").map((n: string) => n[0]).join("").toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-0.5 -right-0.5">
                            <div className="relative">
                              <Circle className="h-3 w-3 fill-green-500 text-green-500" />
                              <div className="absolute inset-0 h-3 w-3 bg-green-500 rounded-full animate-ping opacity-75"></div>
                            </div>
                          </div>
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg dark:text-gray-200">{selectedConversationData?.otherUserName}</h3>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge className={`text-xs ${getRoleGradient(selectedConversationData?.otherUserRole || "")} text-white border-0`}>
                              {selectedConversationData?.otherUserRole}
                            </Badge>
                            <span className="text-xs text-muted-foreground dark:text-gray-400">Online</span>
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setIsDeleteDialogOpen(true)} className="hover:bg-red-50 dark:hover:bg-red-900/30 transition-all duration-200">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 p-0 overflow-hidden">
                    <ScrollArea className="h-full p-4 md:p-6">
                      {messagesLoading ? (
                        <div className="space-y-2">
                          {[...Array(3)].map((_, i) => (
                            <div key={i} className="flex space-x-3 animate-pulse">
                              <div className="w-8 h-8 bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-600 dark:to-gray-700 rounded-full"></div>
                              <div className="flex-1 space-y-2">
                                <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded-lg w-1/4"></div>
                                <div className="h-20 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-2xl w-3/4"></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : messages.length === 0 ? (
                        <div className="text-center text-muted-foreground dark:text-gray-400 py-16">
                          <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 w-28 h-28 rounded-full flex items-center justify-center mx-auto mb-6">
                            <MessageSquare className="h-14 w-14 text-blue-500 dark:text-blue-400" />
                          </div>
                          <p className="font-semibold text-xl mb-2 dark:text-gray-300">No messages yet</p>
                          <p className="text-sm dark:text-gray-400">Send a message to start the conversation</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {messages.map((message: Message) => {
                            const isFromMe = message.senderId === user?.id;
                            return (
                              <div
                                key={message.id}
                                className={`flex ${isFromMe ? "justify-end" : "justify-start"} group`}
                              >
                                <div className={`max-w-[85%] sm:max-w-[75%] lg:max-w-[70%] ${isFromMe ? "order-2" : "order-1"}`}>
                                  <div
                                    className={`
                                      rounded-2xl px-5 py-3 transition-all duration-300
                                      ${isFromMe
                                        ? "bg-gradient-to-br from-blue-500 to-purple-500 text-white ml-auto rounded-br-md shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-[1.02]"
                                        : "bg-gradient-to-br from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md hover:from-gray-200 hover:to-gray-100 dark:hover:from-gray-600 dark:hover:to-gray-700 hover:shadow-md hover:scale-[1.02]"
                                      }
                                    `}
                                  >
                                    <p className="text-sm leading-relaxed break-words">{message.content}</p>
                                  </div>
                                  <div className={`flex items-center mt-2 space-x-1 ${isFromMe ? "justify-end" : "justify-start"}`}>
                                    <p className="text-xs text-muted-foreground dark:text-gray-500">
                                      {formatInTimeZone(new Date(message.createdAt), "Asia/Kolkata", "MMM d, h:mm a")}
                                    </p>
                                    {isFromMe && (
                                      <span className="ml-1">
                                        {message.isRead ? (
                                          <CircleDot className="h-3 w-3 text-green-500" />
                                        ) : (
                                          <Circle className="h-3 w-3 text-blue-400" />
                                        )}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          <div ref={messagesEndRef} />
                        </div>
                      )}
                    </ScrollArea>
                  </CardContent>

                  <div className="border-t dark:border-gray-700 p-4 bg-gradient-to-br from-blue-50/30 to-purple-50/30 dark:from-gray-800/30 dark:to-gray-900/30 backdrop-blur-xl sticky bottom-0">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.target as HTMLFormElement);
                        const content = formData.get("messageContent") as string;
                        if (content.trim() && selectedConversation) {
                          sendQuickReplyMutation.mutate({
                            content: content.trim(),
                          });
                          (e.target as HTMLFormElement).reset();
                        }
                      }}
                      className="flex space-x-3"
                    >
                      <Input
                        name="messageContent"
                        placeholder="Type a message..."
                        className="flex-1 h-11 text-base bg-white/80 dark:bg-gray-900/50 border-blue-100 dark:border-gray-700 focus:border-purple-300 dark:focus:border-purple-500 rounded-xl"
                        autoComplete="off"
                      />
                      <Button 
                        type="submit" 
                        size="icon" 
                        disabled={sendQuickReplyMutation.isPending}
                        className="h-11 w-11 flex-shrink-0 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 shadow-lg shadow-blue-500/30 transition-all duration-300 hover:scale-110 active:scale-95"
                      >
                        <Send className="h-5 w-5" />
                      </Button>
                    </form>
                  </div>
                </>
              ) : (
                <CardContent className="flex-1 flex items-center justify-center p-6">
                  <div className="text-center text-muted-foreground dark:text-gray-400 max-w-sm">
                    <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-8">
                      <MessageSquare className="h-16 w-16 text-blue-500 dark:text-blue-400" />
                    </div>
                    <h3 className="text-lg md:text-xl font-semibold mb-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Select a conversation</h3>
                    <p className="text-base dark:text-gray-400">Choose a conversation from the list to start messaging</p>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Floating Action Button - Mobile Only */}
      {showMobileConversations && (
        <div className="md:hidden fixed bottom-6 right-6 z-50">
          <Dialog open={isComposeDialogOpen} onOpenChange={setIsComposeDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                size="lg" 
                className="h-14 w-14 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 shadow-2xl shadow-blue-500/40 transition-all duration-300 hover:scale-110 active:scale-95"
              >
                <Plus className="h-6 w-6" />
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">Delete Conversation</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Are you sure you want to delete this conversation with {selectedConversationData?.otherUserName}? This action cannot be undone and will delete all messages in this conversation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConversation}
              className="bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 rounded-xl shadow-lg shadow-red-500/30"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
