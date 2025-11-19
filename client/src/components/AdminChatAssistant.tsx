import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  MessageCircle, 
  Send, 
  Bot, 
  User, 
  Loader2,
  Minimize2,
  Expand,
  Shrink,
  Zap,
  Activity,
  ExternalLink,
  Sparkles,
  Download
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { ChatTimetableDisplay } from "./ChatTimetableDisplay";
import { FieldSelectionDialog } from "./FieldSelectionDialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TimetableData {
  classInfo: {
    grade: string;
    section: string;
  };
  weekStart: string;
  weekEnd: string;
  timetableData: any[];
  timeSlots: any[];
  workingDays: string[];
}

interface AnalyticsData {
  query: string;
  data: Record<string, any>[];
  rowCount: number;
}

interface NavigationLink {
  url: string;
  label: string;
}

interface ProfileData {
  type: 'student' | 'teacher';
  id: string;
  name: string;
  email?: string;
  phone?: string;
  profilePicture?: string;
  // Student-specific
  admissionNumber?: string;
  class?: { name: string; grade: string; section: string; room?: string };
  address?: string;
  gender?: string;
  dateOfBirth?: string;
  parents?: Array<{ name: string; email: string; phone: string; relationship: string }>;
  // Teacher-specific
  schoolId?: string;
  designation?: string;
  bloodGroup?: string;
  subjects?: Array<{ className: string; subjectName: string; subjectCode: string; periodsPerWeek: number }>;
  workload?: { totalClassesAssigned: number; totalPeriodsPerWeek: number };
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isTyping?: boolean;
  timetableData?: TimetableData;
  analyticsData?: AnalyticsData;
  navigationLink?: NavigationLink;
  absentList?: {
    type: 'students' | 'teachers';
    list: Array<{ name: string; class?: string; schoolId?: string }>;
  };
  entityTable?: {
    type: 'students' | 'teachers' | 'free_teachers';
    data: Array<{ id: string; name: string; admissionNumber?: string; className?: string; email?: string; schoolId?: string; classesTaught?: string }>;
    totalCount: number;
    redirectUrl?: string;
    redirectLabel?: string;
    period?: number;
    day?: string;
    timeSlot?: any;
  };
  profileData?: ProfileData;
  confirmationList?: {
    confirmationType: 'student_selection' | 'teacher_selection' | 'attendance_teacher_selection';
    options: Array<{ 
      id?: string;
      name: string; 
      schoolId?: string; 
      admissionNumber?: string; 
      className?: string; 
      email?: string; 
      designation?: string;
      classes?: string;
      currentStatus?: string;
    }>;
    attendanceAction?: {
      status: string;
      date: string;
      type: string;
    };
  };
  attendanceConfirmation?: {
    personType: 'student' | 'teacher';
    name: string;
    id: string;
    schoolId?: string;
    admissionNumber?: string;
    class?: string;
    classes?: string;
    status: string;
    date: string;
    pendingConfirmation?: {
      id: string;
      type: string;
      status: string;
    };
  };
  attendanceSuccess?: {
    personType: 'student' | 'teacher';
    name: string;
    schoolId?: string;
    admissionNumber?: string;
    class?: string;
    classes?: string;
    status: 'present' | 'absent' | 'late';
    date: string;
  };
}

interface AdminChatAssistantProps {
  onSystemAction?: (action: string, data?: any) => void;
}

// Chroney's rotating intro messages for better user engagement
const getRandomIntroMessage = () => {
  const introMessages = [
    "Hey there! I'm Chroney, your AI assistant. I do classes, attendance, timetables… basically everything except homework. Don't even try 😏",
    "What's up! Chroney here 🚀. I run your school system smoother than a principal on a Friday afternoon. What's the mission today?",
    "Yo! I'm Chroney, your school's brainy sidekick 🤓. Wanna take attendance or should I just mark everyone present and go home early?",
    "Sup, human? Chroney reporting for duty 🤖. Tell me what you want—attendance, classes, timetable—or I'll just start rapping the ABCs.",
    "Hey hey! Chroney here 🕶️. Think of me as the class topper who actually does your work. What do you need today?"
  ];
  
  return introMessages[Math.floor(Math.random() * introMessages.length)];
};

export function AdminChatAssistant({ onSystemAction }: AdminChatAssistantProps) {
  const [location] = useLocation();
  const isFullPage = location === '/admin-chat';
  
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: getRandomIntroMessage(),
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(isFullPage);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAiConnected, setIsAiConnected] = useState(true);
  const [fieldSelectionData, setFieldSelectionData] = useState<{
    type: 'students' | 'teachers';
    count: number;
    availableFields: any[];
  } | null>(null);
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
  }>({ open: false, title: '', message: '' });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Quota tracking is no longer used
  const quota = { 
    requestsUsed: 0,
    requestsTotal: 0,
    earliestResetTime: null
  };

  const scrollToBottom = (smooth = false) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: smooth ? 'smooth' : 'auto',
        block: 'end'
      });
    }
  };

  useEffect(() => {
    // Auto-scroll whenever messages change
    scrollToBottom(true);
  }, [messages]);

  useEffect(() => {
    // Also scroll when messages array length changes (new message added)
    const timeoutId = setTimeout(() => {
      scrollToBottom(true);
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [messages.length]);

  // Check AI connection status on mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await apiRequest('GET', '/api/chat/status');
        const data = await response.json() as { connected: boolean };
        setIsAiConnected(data.connected);
      } catch (error) {
        setIsAiConnected(false);
      }
    };

    checkConnection();
    // Check connection status every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    
    return () => clearInterval(interval);
  }, []);

  // Reset chat memory when chat is first opened (page refresh)
  const hasResetMemory = useRef(false);
  
  useEffect(() => {
    // Only reset when chat is expanded and we haven't reset yet
    if (isExpanded && !hasResetMemory.current) {
      const resetMemory = async () => {
        try {
          await apiRequest('POST', '/api/chroney/reset');
          console.log('[CHAT] Memory reset - starting fresh conversation');
          hasResetMemory.current = true;
        } catch (error) {
          console.error('[CHAT] Failed to reset memory:', error);
        }
      };

      resetMemory();
    }
  }, [isExpanded]); // Reset when chat is first expanded

  // Typing animation helper
  const animateTyping = (
    fullText: string, 
    messageId: string, 
    additionalData?: Partial<ChatMessage>
  ) => {
    const words = fullText.split(' ');
    let currentIndex = 0;

    // Create initial message with empty content
    const initialMessage: ChatMessage = {
      id: messageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      ...additionalData
    };
    setMessages(prev => [...prev, initialMessage]);

    // Animate word by word
    const typingInterval = setInterval(() => {
      if (currentIndex < words.length) {
        const currentText = words.slice(0, currentIndex + 1).join(' ');
        setMessages(prev => 
          prev.map(msg => 
            msg.id === messageId 
              ? { ...msg, content: currentText }
              : msg
          )
        );
        currentIndex++;
      } else {
        clearInterval(typingInterval);
      }
    }, 80); // 80ms delay between words
  };

  const handleSendMessage = async (hiddenMessage?: string) => {
    if (!inputValue.trim() || isLoading) return;

    // Display message is what the user sees in chat
    // Hidden message is what actually gets sent to the backend (for technical data)
    const displayContent = inputValue.trim();
    const backendContent = hiddenMessage || displayContent;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: displayContent,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    // OPTIMIZATION: Enhanced typing indicator with context-aware message
    const getTypingMessage = (query: string) => {
      const lowerQuery = query.toLowerCase();
      if (/timetable|schedule/.test(lowerQuery)) return 'Chroney is checking the timetable...';
      if (/absent|attendance|present/.test(lowerQuery)) return 'Chroney is checking attendance records...';
      if (/student|teacher/.test(lowerQuery)) return 'Chroney is searching profiles...';
      if (/report|export|excel/.test(lowerQuery)) return 'Chroney is generating your report...';
      return 'Chroney is thinking...';
    };
    
    const typingMessage: ChatMessage = {
      id: 'typing',
      role: 'assistant',
      content: getTypingMessage(displayContent),
      timestamp: new Date(),
      isTyping: true
    };
    setMessages(prev => [...prev, typingMessage]);

    try {
      const response = await apiRequest('POST', '/api/chroney/chat', {
        message: backendContent
      });

      const data = await response.json() as {reply: string, action?: string, actionData?: any};

      // Remove typing indicator
      setMessages(prev => prev.filter(msg => msg.id !== 'typing'));

      const messageId = (Date.now() + 1).toString();

      // Handle attendance report with export button
      if (data.action === 'show_attendance_report' && data.actionData) {
        // Show report with export button embedded
        animateTyping(data.reply, messageId, {
          attendanceReport: {
            dateRange: data.actionData.dateRange,
            teachers: data.actionData.teachers,
            students: data.actionData.students,
            dailyBreakdown: data.actionData.dailyBreakdown, // Day-by-day breakdown for ≤7 days
            exportData: data.actionData.exportData
          }
        });
      } else if (data.action === 'download_excel' && data.actionData) {
        // Trigger automatic download of Excel file
        const { filename, base64Data } = data.actionData;
        
        // Convert base64 to blob and trigger download
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        // Show success message
        animateTyping(data.reply, messageId);
      } else if (data.action === 'show_timetable' && data.actionData) {
        // Data is already in the correct format from the backend
        const timetableData = data.actionData;
        
        animateTyping(data.reply, messageId, { timetableData });
      } else if (data.action === 'analytics_results' && data.actionData) {
        // Handle analytics results action
        const analyticsData: AnalyticsData = {
          query: data.actionData.query,
          data: data.actionData.data || [],
          rowCount: data.actionData.rowCount || 0
        };
        
        animateTyping(data.reply, messageId, { analyticsData });
      } else if (data.action === 'show_field_selection' && data.actionData) {
        // Handle field selection dialog
        setFieldSelectionData({
          type: data.actionData.type,
          count: data.actionData.count,
          availableFields: data.actionData.availableFields
        });
        
        animateTyping(data.reply, messageId);
      } else if (data.action === 'show_entity_table' && data.actionData) {
        // Handle entity table display (students/teachers)
        animateTyping(data.reply, messageId, {
          entityTable: {
            type: data.actionData.type,
            data: data.actionData.data,
            totalCount: data.actionData.totalCount,
            redirectUrl: data.actionData.redirectUrl,
            redirectLabel: data.actionData.redirectLabel
          }
        });
      } else if (data.action === 'show_navigation_link' && data.actionData) {
        // Handle navigation link display
        animateTyping(data.reply, messageId, {
          navigationLink: {
            url: data.actionData.url,
            label: data.actionData.label
          }
        });
      } else if (data.action === 'show_absent_list' && data.actionData) {
        // Handle absent list display
        animateTyping(data.reply, messageId, {
          absentList: {
            type: data.actionData.type,
            list: data.actionData.list
          }
        });
      } else if (data.action === 'show_confirmation_list' && data.actionData) {
        // Handle confirmation list display (multiple profile matches or attendance selection)
        animateTyping(data.reply, messageId, {
          confirmationList: {
            confirmationType: data.actionData.confirmationType,
            options: data.actionData.options,
            attendanceAction: data.actionData.attendanceAction  // Include attendance action data
          }
        });
      } else if (data.action === 'show_profile_dialog' && data.actionData) {
        // Handle profile dialog display
        animateTyping(data.reply, messageId, {
          profileData: {
            type: data.actionData.profileType,
            ...data.actionData.profileData
          }
        });
      } else if (data.action === 'show_attendance_confirmation' && data.actionData) {
        // Handle attendance confirmation card
        animateTyping(data.reply, messageId, {
          attendanceConfirmation: {
            personType: data.actionData.personType,
            name: data.actionData.name,
            id: data.actionData.id,
            schoolId: data.actionData.schoolId,
            admissionNumber: data.actionData.admissionNumber,
            class: data.actionData.class,
            classes: data.actionData.classes,
            pendingConfirmation: data.actionData.pendingConfirmation, // Store full confirmation context
            status: '', // Will be extracted from message
            date: '' // Will be extracted from message
          }
        });
      } else if (data.action === 'show_attendance_success' && data.actionData) {
        // Handle attendance success card
        animateTyping(data.reply, messageId, {
          attendanceSuccess: {
            personType: data.actionData.personType,
            name: data.actionData.name,
            schoolId: data.actionData.schoolId,
            admissionNumber: data.actionData.admissionNumber,
            class: data.actionData.class,
            classes: data.actionData.classes,
            status: data.actionData.status,
            date: data.actionData.date
          }
        });
      } else if (data.action === 'open_timetable_generation_dialog') {
        // Handle timetable generation dialog - navigate to timetable page
        animateTyping(data.reply, messageId);
        
        // Navigate to timetable page with parameter to auto-open dialog
        setTimeout(() => {
          window.location.href = '/timetable?openGenerateDialog=true';
        }, 500); // Small delay to let user see the message
      } else {
        animateTyping(data.reply, messageId);

        // Handle other system actions
        if (data.action && onSystemAction) {
          onSystemAction(data.action, data.actionData);
        }
      }

    } catch (error) {
      // Remove typing indicator
      setMessages(prev => prev.filter(msg => msg.id !== 'typing'));
      
      const errorMessageId = (Date.now() + 1).toString();
      animateTyping(
        "I apologize, but I'm having trouble processing your request right now. Please try again later or contact support if the issue persists.",
        errorMessageId
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  // Handle analytics data export (Excel only)
  const handleExportAnalytics = (analyticsData: AnalyticsData) => {
    try {
      const data = analyticsData.data;
      const timestamp = new Date().toISOString().split('T')[0];
      
      if (data.length === 0) return;
      
      // Import XLSX library
      import('xlsx').then((XLSX) => {
        // Create workbook and worksheet
        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(data);
        
        // Auto-size columns
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        const columnWidths: any[] = [];
        
        for (let C = range.s.c; C <= range.e.c; ++C) {
          let maxWidth = 10;
          for (let R = range.s.r; R <= range.e.r; ++R) {
            const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
            const cell = worksheet[cellAddress];
            if (cell && cell.v) {
              const cellLength = cell.v.toString().length;
              if (cellLength > maxWidth) {
                maxWidth = cellLength;
              }
            }
          }
          columnWidths.push({ width: Math.min(maxWidth + 2, 50) });
        }
        worksheet['!cols'] = columnWidths;
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Analytics Data');
        
        // Generate Excel file and download
        XLSX.writeFile(workbook, `analytics_export_${timestamp}.xlsx`);
      }).catch(() => {
        // Fallback to chat message if XLSX import fails
        setInputValue(`export this as excel`);
        handleSendMessage();
      });
    } catch (error) {
      console.error('Export failed:', error);
      setInputValue('export this as excel');
      handleSendMessage();
    }
  };

  // Compact/Collapsed State - Futuristic AI Robot
  if (!isExpanded) {
    return (
      <div className="relative mb-6 px-4">
        {/* Clean AI Bot Container */}
        <div 
          className="relative bg-gradient-to-br from-card via-purple-50/30 dark:via-purple-900/20 to-blue-50/20 dark:to-blue-900/20 rounded-xl p-3 shadow-lg border border-border overflow-hidden cursor-pointer hover:shadow-xl hover:border-purple-300/50 dark:hover:border-purple-600/50 transition-all duration-200"
          onClick={() => setIsExpanded(true)}
        >
          {/* Subtle Background Effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-100/20 dark:from-purple-800/10 via-transparent to-blue-100/20 dark:to-blue-800/10"></div>
          
          <div className="relative flex items-center space-x-3 z-10">
            {/* AI Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center shadow-md">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              {/* Status Indicator */}
              <div className={`absolute -top-0.5 -right-0.5 w-3.5 h-3.5 ${isAiConnected ? 'bg-green-500' : 'bg-gray-400'} rounded-full flex items-center justify-center`}>
                <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
              </div>
            </div>
            
            {/* AI Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-semibold text-foreground">
                  Hi Chroney
                </h3>
                <Badge className={`${isAiConnected ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-700' : 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700'} text-[10px] px-1.5 py-0 border`}>
                  {isAiConnected ? 'Online' : 'Offline'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">AI School Management Assistant</p>
            </div>
            
            {/* Expand Button */}
            <Button
              onClick={() => setIsExpanded(true)}
              className="bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white border-0 rounded-lg px-3 py-2 shadow-md hover:shadow-lg transition-all duration-200 flex-shrink-0"
            >
              <MessageCircle className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Chat</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Expanded State - Full Chat Interface
  return (
    <div className={`${isFullPage ? '' : 'relative mb-6 px-4'}`}>
      {/* Clean Expanded Chat Container */}
      <div className={`${isFullPage ? '' : 'bg-card rounded-xl shadow-lg border border-border overflow-hidden'}`}>
        {/* Header */}
        <div className={`bg-gradient-to-r from-red-500 via-purple-600 to-blue-600 px-6 py-3 border-b border-border ${isFullPage ? 'fixed top-0 left-0 right-0 z-10' : ''}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">
                  Hi Chroney
                </h3>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 ${isAiConnected ? 'bg-green-300' : 'bg-gray-400'} rounded-full`}></div>
                  <span className="text-xs text-purple-100">{isAiConnected ? 'AI Assistant Active' : 'Offline'}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {!isFullPage && (
                <>
                  <Button
                    onClick={() => window.location.href = '/admin-chat'}
                    variant="ghost"
                    size="sm"
                    className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg"
                    title="Open in Full Page"
                  >
                    <Expand className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={() => {
                      setIsExpanded(false);
                      setIsFullscreen(false);
                    }}
                    variant="ghost"
                    size="sm"
                    className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg"
                    title="Close Chat"
                  >
                    <Minimize2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className={`${isFullPage ? 'fixed left-0 right-0 top-[4rem] bottom-[6.5rem] flex flex-col' : 'px-6 pt-6 pb-3 relative flex flex-col max-h-[calc(100vh-200px)]'}`}>
          {/* Chat Messages */}
          <div className={`${isFullPage ? 'flex-1 overflow-y-auto pt-6 pb-4' : 'flex-1 overflow-y-auto min-h-[200px]'} ${isFullPage ? '' : 'bg-muted/30 rounded-lg border border-border p-4 mb-3'}`}>
            {/* Centered Container for Full Page */}
            <div className={`${isFullPage ? 'max-w-3xl mx-auto px-6 space-y-4' : 'space-y-4'}`}>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-purple-500 to-blue-600 text-white shadow-sm'
                      : 'bg-card text-card-foreground border border-border shadow-sm'
                  }`}
                >
                  <div className="flex items-start space-x-2">
                    <div className={`flex-shrink-0 ${message.role === 'user' ? 'order-2' : ''}`}>
                      {message.role === 'user' ? (
                        <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                          <User className="w-3 h-3" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
                          {message.isTyping ? (
                            <Loader2 className="w-3 h-3 animate-spin text-white" />
                          ) : (
                            <Sparkles className="w-3 h-3 text-white" />
                          )}
                        </div>
                      )}
                    </div>
                    <div className={`flex-1 ${message.role === 'user' ? 'order-1' : ''}`}>
                      {message.isTyping ? (
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                        </div>
                      ) : (
                        <>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap">
                            {message.content}
                          </div>
                          {/* Render attendance report with export button */}
                          {message.attendanceReport && (
                            <div className="mt-3 bg-card border rounded-lg p-4 shadow-sm">
                              <div className="space-y-3">
                                {/* Day-by-Day Breakdown (only for ≤ 7 days) */}
                                {message.attendanceReport.dailyBreakdown && message.attendanceReport.dailyBreakdown.length > 0 && (
                                  <div className="space-y-2 mb-4">
                                    <h4 className="text-sm font-semibold text-foreground mb-3">📅 Daily Breakdown</h4>
                                    {message.attendanceReport.dailyBreakdown.map((day: any) => (
                                      <div key={day.date} className="border-l-2 border-purple-500 pl-3 py-2 bg-muted/30 rounded-r">
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="text-sm font-semibold text-foreground">
                                            {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                          </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                                          <div>
                                            <span className="font-medium">👨‍🏫 Teachers:</span> {day.teachers.present}/{day.teachers.total} ({day.teachers.attendance_rate}%)
                                            {day.teachers.absent > 0 && `, ${day.teachers.absent} absent`}
                                          </div>
                                          <div>
                                            <span className="font-medium">👨‍🎓 Students:</span> {day.students.present}/{day.students.total} ({day.students.attendance_rate}%)
                                            {day.students.absent > 0 && `, ${day.students.absent} absent`}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                
                                {/* Export Button */}
                                <button
                                  onClick={() => {
                                    const { filename, base64Data } = message.attendanceReport.exportData;
                                    const byteCharacters = atob(base64Data);
                                    const byteNumbers = new Array(byteCharacters.length);
                                    for (let i = 0; i < byteCharacters.length; i++) {
                                      byteNumbers[i] = byteCharacters.charCodeAt(i);
                                    }
                                    const byteArray = new Uint8Array(byteNumbers);
                                    const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                                    const url = window.URL.createObjectURL(blob);
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.download = filename;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                    window.URL.revokeObjectURL(url);
                                  }}
                                  className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-lg hover:from-purple-600 hover:to-blue-700 transition-all shadow-sm font-medium text-sm"
                                >
                                  <Download className="w-4 h-4" />
                                  Export to Excel
                                </button>
                              </div>
                            </div>
                          )}
                          {/* Render timetable if present */}
                          {message.timetableData && (
                            <div className="mt-3">
                              <ChatTimetableDisplay {...message.timetableData} />
                            </div>
                          )}
                          {/* Render analytics table if present */}
                          {message.analyticsData && (
                            <div className="mt-3">
                              <div className="bg-card border rounded-lg p-4 shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-sm font-semibold text-foreground flex items-center">
                                    📊 <span className="ml-1">Analytics Results</span>
                                  </h4>
                                  <Badge variant="secondary" className="text-xs">
                                    {message.analyticsData.rowCount} records
                                  </Badge>
                                </div>
                                
                                <div className="overflow-x-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="hover:bg-transparent">
                                        {message.analyticsData.data.length > 0 && 
                                          Object.keys(message.analyticsData.data[0]).map((header) => (
                                            <TableHead key={header} className="bg-muted/50 font-semibold text-foreground capitalize">
                                              {header.replace(/_/g, ' ')}
                                            </TableHead>
                                          ))
                                        }
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {message.analyticsData.data.map((row, index) => (
                                        <TableRow key={index} className="hover:bg-muted/30 transition-colors">
                                          {Object.entries(row).map(([key, value], cellIndex) => (
                                            <TableCell key={cellIndex} className="font-medium">
                                              {value === null || value === undefined ? (
                                                <span className="text-muted-foreground">-</span>
                                              ) : (
                                                <span className={key === 'status' && value === 'absent' ? 'text-red-600 font-semibold' : 
                                                              key === 'status' && value === 'present' ? 'text-green-600 font-semibold' :
                                                              key === 'status' && value === 'late' ? 'text-yellow-600 font-semibold' : ''}>
                                                  {value.toString()}
                                                </span>
                                              )}
                                            </TableCell>
                                          ))}
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                              
                              <div className="mt-3 flex justify-end">
                                <Button 
                                  size="sm" 
                                  onClick={() => handleExportAnalytics(message.analyticsData!)}
                                  className="text-xs bg-purple-600 hover:bg-purple-700"
                                >
                                  📊 Export Excel
                                </Button>
                              </div>
                            </div>
                          )}
                          {/* Render navigation link if present */}
                          {message.navigationLink && (
                            <div className="mt-3">
                              <Button 
                                size="sm" 
                                onClick={() => window.location.href = message.navigationLink!.url}
                                className="text-xs bg-purple-600 hover:bg-purple-700 flex items-center gap-2"
                              >
                                <span>{message.navigationLink.label}</span>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </Button>
                            </div>
                          )}
                          {/* Render absent list if present */}
                          {message.absentList && (
                            <div className="mt-3 bg-white border border-gray-200 rounded-lg p-3 max-w-md">
                              <div className="text-sm text-gray-600 mb-2 font-medium">
                                {message.absentList.type === 'students' ? 'Absent Students:' : 'Absent Teachers:'}
                              </div>
                              <div className="space-y-1">
                                {message.absentList.list.map((item, idx) => (
                                  <div key={idx} className="text-sm text-gray-800 flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
                                    <span className="font-medium">{item.name}</span>
                                    {item.class && <span className="text-xs text-gray-500 ml-2 bg-gray-100 px-2 py-0.5 rounded">{item.class}</span>}
                                    {item.schoolId && <span className="text-xs text-gray-500 ml-2 bg-gray-100 px-2 py-0.5 rounded">{item.schoolId}</span>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Render entity table if present (students/teachers) */}
                          {message.entityTable && (
                            <div className="mt-3 bg-white border border-gray-200 rounded-lg overflow-hidden">
                              <div className="overflow-x-auto max-h-96">
                                <Table>
                                  <TableHeader className="bg-gray-50">
                                    <TableRow>
                                      {message.entityTable.type === 'students' ? (
                                        <>
                                          <TableHead className="font-semibold">Name</TableHead>
                                          <TableHead className="font-semibold">Admission #</TableHead>
                                          <TableHead className="font-semibold">Class</TableHead>
                                        </>
                                      ) : message.entityTable.type === 'free_teachers' ? (
                                        <>
                                          <TableHead className="font-semibold">Name</TableHead>
                                          <TableHead className="font-semibold">School ID</TableHead>
                                          <TableHead className="font-semibold">Classes Taught</TableHead>
                                        </>
                                      ) : (
                                        <>
                                          <TableHead className="font-semibold">Name</TableHead>
                                          <TableHead className="font-semibold">School ID</TableHead>
                                          <TableHead className="font-semibold">Email</TableHead>
                                        </>
                                      )}
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {message.entityTable.data.map((item, idx) => (
                                      <TableRow key={`${item.id}-${idx}`} className="hover:bg-gray-50 transition-colors">
                                        <TableCell className="font-medium">{item.name}</TableCell>
                                        {message.entityTable!.type === 'students' ? (
                                          <>
                                            <TableCell className="text-sm text-gray-600">{item.admissionNumber || '-'}</TableCell>
                                            <TableCell className="text-sm">
                                              {item.className ? (
                                                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">
                                                  {item.className}
                                                </span>
                                              ) : '-'}
                                            </TableCell>
                                          </>
                                        ) : message.entityTable!.type === 'free_teachers' ? (
                                          <>
                                            <TableCell className="text-sm text-gray-600">{item.schoolId || '-'}</TableCell>
                                            <TableCell className="text-sm text-gray-600">{item.classesTaught || 'None'}</TableCell>
                                          </>
                                        ) : (
                                          <>
                                            <TableCell className="text-sm text-gray-600">{item.schoolId || '-'}</TableCell>
                                            <TableCell className="text-sm text-gray-600">{item.email || '-'}</TableCell>
                                          </>
                                        )}
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                              <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 flex items-center justify-between">
                                <div className="text-sm text-gray-600">
                                  {message.entityTable.type === 'free_teachers' ? (
                                    <>Showing {message.entityTable.data.length} free {message.entityTable.data.length === 1 ? 'teacher' : 'teachers'}</>
                                  ) : (
                                    <>Showing {message.entityTable.data.length} of {message.entityTable.totalCount} total {message.entityTable.type}</>
                                  )}
                                </div>
                                {message.entityTable.type !== 'free_teachers' && <Button 
                                  size="sm" 
                                  onClick={async () => {
                                    try {
                                      // Get auth token from localStorage
                                      const token = localStorage.getItem("authToken");
                                      const headers: Record<string, string> = {};
                                      
                                      if (token) {
                                        headers["Authorization"] = `Bearer ${token}`;
                                      }
                                      
                                      // Fetch all data for the entity type
                                      const response = await fetch(`/api/${message.entityTable!.type}`, {
                                        headers,
                                        credentials: 'include'
                                      });
                                      
                                      if (!response.ok) throw new Error('Failed to fetch data');
                                      
                                      const result = await response.json();
                                      const allData = message.entityTable!.type === 'teachers' ? result.teachers : result.students;
                                      
                                      // Import XLSX dynamically
                                      const XLSX = await import('xlsx');
                                      
                                      // Prepare Excel data based on entity type
                                      let excelData: any[] = [];
                                      
                                      if (message.entityTable!.type === 'teachers') {
                                        excelData = allData.map((teacher: any) => ({
                                          'Name': teacher.name || '',
                                          'Employee ID': teacher.employeeId || '',
                                          'Email': teacher.email || '',
                                          'Contact Number': teacher.contactNumber || '',
                                          'Designation': teacher.designation || '',
                                          'Gender': teacher.gender || '',
                                          'Blood Group': teacher.bloodGroup || '',
                                          'Date of Birth': teacher.dateOfBirth || '',
                                          'Address': teacher.address || '',
                                          'Status': teacher.status || ''
                                        }));
                                      } else {
                                        excelData = allData.map((student: any) => ({
                                          'Name': `${student.firstName} ${student.lastName}`,
                                          'Admission Number': student.admissionNumber || '',
                                          'Roll Number': student.rollNumber || '',
                                          'Class': student.class ? `${student.class.grade} ${student.class.section}` : '',
                                          'Email': student.email || '',
                                          'Contact Number': student.contactNumber || '',
                                          'Gender': student.gender || '',
                                          'Date of Birth': student.dateOfBirth || '',
                                          'Blood Group': student.bloodGroup || '',
                                          'Guardian Name': student.guardianName || '',
                                          'Guardian Contact': student.guardianContact || '',
                                          'Address': student.address || '',
                                          'Status': student.isActive ? 'Active' : 'Inactive'
                                        }));
                                      }
                                      
                                      // Create workbook and worksheet
                                      const worksheet = XLSX.utils.json_to_sheet(excelData);
                                      const workbook = XLSX.utils.book_new();
                                      XLSX.utils.book_append_sheet(workbook, worksheet, message.entityTable!.type === 'teachers' ? 'Teachers' : 'Students');
                                      
                                      // Generate filename with current date
                                      const now = new Date();
                                      const dateStr = now.toISOString().split('T')[0];
                                      const filename = `${message.entityTable!.type}_list_${dateStr}.xlsx`;
                                      
                                      // Download the file
                                      XLSX.writeFile(workbook, filename);
                                    } catch (error) {
                                      console.error('Error exporting to Excel:', error);
                                      setErrorDialog({
                                        open: true,
                                        title: 'Export Failed',
                                        message: 'Failed to export data. Please try again.'
                                      });
                                    }
                                  }}
                                  className="text-xs bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 flex items-center gap-2"
                                >
                                  <Download className="w-3 h-3" />
                                  Export via Excel
                                </Button>}
                              </div>
                            </div>
                          )}
                          {/* Render confirmation list if present (multiple profile matches) */}
                          {message.confirmationList && (
                            <div className="mt-3 bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
                              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">
                                Please select one:
                              </h4>
                              <div className="space-y-2">
                                {message.confirmationList.options.map((option, idx) => {
                                  const confirmationType = message.confirmationList?.confirmationType;
                                  const attendanceAction = message.confirmationList?.attendanceAction;
                                  
                                  return (
                                    <button
                                      key={idx}
                                      onClick={async () => {
                                        if (!confirmationType) return;
                                        
                                        // Handle attendance teacher selection - directly mark attendance
                                        if (confirmationType === 'attendance_teacher_selection' && attendanceAction) {
                                          // Use the teacher's school ID - more user-friendly than UUID
                                          const message = `Mark ${option.schoolId} as ${attendanceAction.status} for today`;
                                          setInputValue(message);
                                          
                                          // Auto-send the message
                                          setTimeout(() => {
                                            handleSendMessage();
                                          }, 100);
                                        } else {
                                          // Handle profile selection - populate input field
                                          const identifier = confirmationType === 'teacher_selection' 
                                            ? option.schoolId 
                                            : option.admissionNumber;
                                          setInputValue(identifier || option.name);
                                          inputRef.current?.focus();
                                        }
                                      }}
                                      className="w-full text-left px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 hover:from-purple-100 hover:to-blue-100 dark:hover:from-purple-900/30 dark:hover:to-blue-900/30 border border-purple-200 dark:border-purple-700 rounded-lg transition-all"
                                    >
                                      <div className="font-medium text-gray-900 dark:text-gray-100">{option.name}</div>
                                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                        {confirmationType === 'teacher_selection' || confirmationType === 'attendance_teacher_selection' ? (
                                          <>
                                            {option.schoolId && <span>ID: {option.schoolId}</span>}
                                            {option.designation && <span> • {option.designation}</span>}
                                            {option.classes && <span> • Classes: {option.classes}</span>}
                                            {option.email && <span className="block text-xs mt-1">{option.email}</span>}
                                            {confirmationType === 'attendance_teacher_selection' && option.currentStatus && (
                                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mt-1 ${
                                                option.currentStatus === 'present' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                                                option.currentStatus === 'absent' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                                                option.currentStatus === 'late' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                                'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
                                              }`}>
                                                Current: {option.currentStatus === 'not_marked' ? 'Not marked' : option.currentStatus.charAt(0).toUpperCase() + option.currentStatus.slice(1)}
                                              </span>
                                            )}
                                          </>
                                        ) : (
                                          <>
                                            {option.admissionNumber && <span>Admission: {option.admissionNumber}</span>}
                                            {option.className && <span> • {option.className}</span>}
                                            {option.email && <span className="block text-xs mt-1">{option.email}</span>}
                                          </>
                                        )}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          
                          {/* Render attendance confirmation card */}
                          {message.attendanceConfirmation && (
                            <div className="mt-4">
                              <Card className="border-2 border-purple-300 dark:border-purple-700 bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-purple-950/30 dark:via-gray-900 dark:to-blue-950/30">
                                <CardHeader className="pb-3">
                                  <CardTitle className="text-lg flex items-center gap-2">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-white text-lg font-bold">
                                      {message.attendanceConfirmation.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <div className="text-gray-900 dark:text-gray-100">
                                        {message.attendanceConfirmation.name}
                                      </div>
                                      <Badge variant="outline" className="mt-1 text-xs">
                                        {message.attendanceConfirmation.personType === 'teacher' ? '👨‍🏫 Teacher' : '🎓 Student'}
                                      </Badge>
                                    </div>
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                  {/* Details Grid */}
                                  <div className="grid grid-cols-2 gap-3 p-3 bg-white/70 dark:bg-gray-800/50 rounded-lg border border-purple-200 dark:border-purple-800">
                                    {message.attendanceConfirmation.personType === 'teacher' ? (
                                      <>
                                        <div>
                                          <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">School ID</div>
                                          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                            {message.attendanceConfirmation.schoolId || 'Not set'}
                                          </div>
                                        </div>
                                        <div>
                                          <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Classes</div>
                                          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                            {message.attendanceConfirmation.classes || 'None assigned'}
                                          </div>
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <div>
                                          <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Admission No.</div>
                                          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                            {message.attendanceConfirmation.admissionNumber || 'Not set'}
                                          </div>
                                        </div>
                                        <div>
                                          <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Class</div>
                                          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                            {message.attendanceConfirmation.class || 'Not assigned'}
                                          </div>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                  
                                  {/* Confirmation Buttons */}
                                  <div className="flex gap-3 pt-2">
                                    <Button
                                      onClick={() => {
                                        // Send full confirmation context so AI knows exactly what to mark
                                        const confirmation = (message.attendanceConfirmation as any)?.pendingConfirmation;
                                        if (confirmation) {
                                          // Show clean message to user, send technical data to backend
                                          setInputValue('Yes, confirm');
                                          setTimeout(() => handleSendMessage(`CONFIRM_ATTENDANCE: ${JSON.stringify(confirmation)}`), 100);
                                        } else {
                                          setInputValue('Yes, confirm');
                                          setTimeout(() => handleSendMessage(), 100);
                                        }
                                      }}
                                      className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
                                    >
                                      ✓ Yes, Confirm
                                    </Button>
                                    <Button
                                      onClick={() => {
                                        setInputValue('No, cancel');
                                        setTimeout(() => handleSendMessage(), 100);
                                      }}
                                      variant="outline"
                                      className="flex-1 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                                    >
                                      ✗ No, Cancel
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          )}
                          
                          {/* Render attendance success card */}
                          {message.attendanceSuccess && message.attendanceSuccess.name && (() => {
                            const isAbsent = message.attendanceSuccess.status === 'absent';
                            const isLate = message.attendanceSuccess.status === 'late';
                            const isPresent = message.attendanceSuccess.status === 'present';
                            
                            const cardBg = isAbsent 
                              ? 'bg-gradient-to-br from-red-50 via-white to-rose-50 dark:from-red-950/30 dark:via-gray-900 dark:to-rose-950/30'
                              : isLate
                              ? 'bg-gradient-to-br from-yellow-50 via-white to-amber-50 dark:from-yellow-950/30 dark:via-gray-900 dark:to-amber-950/30'
                              : 'bg-gradient-to-br from-green-50 via-white to-emerald-50 dark:from-green-950/30 dark:via-gray-900 dark:to-emerald-950/30';
                            
                            const cardBorder = isAbsent
                              ? 'border-red-300 dark:border-red-700'
                              : isLate
                              ? 'border-yellow-300 dark:border-yellow-700'
                              : 'border-green-300 dark:border-green-700';
                            
                            const avatarBg = isAbsent
                              ? 'from-red-500 to-rose-600'
                              : isLate
                              ? 'from-yellow-500 to-amber-600'
                              : 'from-green-500 to-emerald-600';
                            
                            const detailsBorder = isAbsent
                              ? 'border-red-200 dark:border-red-800'
                              : isLate
                              ? 'border-yellow-200 dark:border-yellow-800'
                              : 'border-green-200 dark:border-green-800';
                            
                            const statusBg = isAbsent
                              ? 'bg-gradient-to-r from-red-100 to-rose-100 dark:from-red-900/30 dark:to-rose-900/30'
                              : isLate
                              ? 'bg-gradient-to-r from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30'
                              : 'bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30';
                            
                            const statusBorder = isAbsent
                              ? 'border-red-300 dark:border-red-700'
                              : isLate
                              ? 'border-yellow-300 dark:border-yellow-700'
                              : 'border-green-300 dark:border-green-700';
                            
                            const statusText = isAbsent
                              ? 'text-red-800 dark:text-red-200'
                              : isLate
                              ? 'text-yellow-800 dark:text-yellow-200'
                              : 'text-green-800 dark:text-green-200';
                            
                            const statusSubtext = isAbsent
                              ? 'text-red-700 dark:text-red-300'
                              : isLate
                              ? 'text-yellow-700 dark:text-yellow-300'
                              : 'text-green-700 dark:text-green-300';
                            
                            return (
                              <div className="mt-3">
                                <Card className={`border-2 ${cardBorder} ${cardBg}`}>
                                  <CardHeader className="pb-2">
                                    <CardTitle className="text-base flex items-center gap-2">
                                      <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${avatarBg} flex items-center justify-center text-white font-bold`}>
                                        {message.attendanceSuccess.name.charAt(0).toUpperCase()}
                                      </div>
                                      <div>
                                        <div className="text-gray-900 dark:text-gray-100 text-sm">
                                          {message.attendanceSuccess.name}
                                        </div>
                                        <Badge variant="outline" className="mt-0.5 text-xs">
                                          {message.attendanceSuccess.personType === 'teacher' ? '👨‍🏫 Teacher' : '🎓 Student'}
                                        </Badge>
                                      </div>
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="space-y-2">
                                    {/* Details Grid */}
                                    <div className={`grid grid-cols-2 gap-2 p-2 bg-white/70 dark:bg-gray-800/50 rounded-lg border ${detailsBorder}`}>
                                      {message.attendanceSuccess.personType === 'teacher' ? (
                                        <>
                                          <div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">School ID</div>
                                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                              {message.attendanceSuccess.schoolId || 'Not set'}
                                            </div>
                                          </div>
                                          <div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Classes</div>
                                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                              {message.attendanceSuccess.classes || 'None assigned'}
                                            </div>
                                          </div>
                                        </>
                                      ) : (
                                        <>
                                          <div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Admission No.</div>
                                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                              {message.attendanceSuccess.admissionNumber || 'Not set'}
                                            </div>
                                          </div>
                                          <div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Class</div>
                                            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                              {message.attendanceSuccess.class || 'Not assigned'}
                                            </div>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                    
                                    {/* Success Status Badge */}
                                    <div className={`flex items-center justify-center gap-2 p-3 ${statusBg} rounded-lg border-2 ${statusBorder}`}>
                                      <div className="text-xl">
                                        {isPresent ? '✓' : isAbsent ? '✗' : '⏰'}
                                      </div>
                                      <div className="text-center">
                                        <div className={`text-base font-bold ${statusText}`}>
                                          Marked {message.attendanceSuccess.status.charAt(0).toUpperCase() + message.attendanceSuccess.status.slice(1)}
                                        </div>
                                        <div className={`text-xs ${statusSubtext}`}>
                                          {message.attendanceSuccess.date}
                                        </div>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            );
                          })()}
                          
                          {/* Render profile dialog if present */}
                          {message.profileData && (
                            <div className="mt-3 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                              <div className="flex items-start gap-4">
                                {/* Profile Picture */}
                                <div className="flex-shrink-0">
                                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-white text-2xl font-bold">
                                    {message.profileData.name.charAt(0).toUpperCase()}
                                  </div>
                                </div>
                                
                                {/* Profile Details */}
                                <div className="flex-1">
                                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{message.profileData.name}</h3>
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                    {message.profileData.type === 'student' ? (
                                      <>
                                        {message.profileData.admissionNumber && `Admission: ${message.profileData.admissionNumber}`}
                                        {message.profileData.class && ` • ${message.profileData.class.name}`}
                                      </>
                                    ) : (
                                      <>
                                        {message.profileData.employeeId && `ID: ${message.profileData.employeeId}`}
                                        {message.profileData.designation && ` • ${message.profileData.designation}`}
                                      </>
                                    )}
                                  </p>
                                  
                                  {/* Contact Info */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                                    {message.profileData.email && (
                                      <div className="text-sm">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">Email:</span>
                                        <span className="ml-2 text-gray-600 dark:text-gray-400">{message.profileData.email}</span>
                                      </div>
                                    )}
                                    {message.profileData.phone && (
                                      <div className="text-sm">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">Phone:</span>
                                        <span className="ml-2 text-gray-600 dark:text-gray-400">{message.profileData.phone}</span>
                                      </div>
                                    )}
                                    {message.profileData.gender && (
                                      <div className="text-sm">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">Gender:</span>
                                        <span className="ml-2 text-gray-600 dark:text-gray-400">{message.profileData.gender}</span>
                                      </div>
                                    )}
                                    {message.profileData.dateOfBirth && (
                                      <div className="text-sm">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">DOB:</span>
                                        <span className="ml-2 text-gray-600 dark:text-gray-400">{message.profileData.dateOfBirth}</span>
                                      </div>
                                    )}
                                    {message.profileData.bloodGroup && (
                                      <div className="text-sm">
                                        <span className="font-medium text-gray-700 dark:text-gray-300">Blood Group:</span>
                                        <span className="ml-2 text-gray-600 dark:text-gray-400">{message.profileData.bloodGroup}</span>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Student-specific: Parents */}
                                  {message.profileData.type === 'student' && message.profileData.parents && message.profileData.parents.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-800">
                                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Parents/Guardians</h4>
                                      <div className="space-y-2">
                                        {message.profileData.parents.map((parent, idx) => (
                                          <div key={idx} className="text-sm bg-white/50 dark:bg-gray-800/50 rounded p-2">
                                            <div className="font-medium text-gray-800 dark:text-gray-200">{parent.name} ({parent.relationship})</div>
                                            <div className="text-gray-600 dark:text-gray-400">{parent.email} • {parent.phone}</div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Teacher-specific: Subjects */}
                                  {message.profileData.type === 'teacher' && message.profileData.subjects && message.profileData.subjects.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-800">
                                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Subjects Teaching</h4>
                                      <div className="flex flex-wrap gap-2">
                                        {message.profileData.subjects.map((subject, idx) => (
                                          <span key={idx} className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full text-xs font-medium">
                                            {subject.className} - {subject.subjectName} ({subject.periodsPerWeek}p/w)
                                          </span>
                                        ))}
                                      </div>
                                      {message.profileData.workload && (
                                        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                          Total Workload: {message.profileData.workload.totalPeriodsPerWeek} periods/week across {message.profileData.workload.totalClassesAssigned} classes
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {/* View Full Profile Button */}
                                  <div className="mt-4 pt-3 border-t border-purple-200 dark:border-purple-800">
                                    <Button
                                      onClick={() => {
                                        if (!message.profileData) return;
                                        const url = message.profileData.type === 'student' ? '/students' : '/teachers';
                                        window.location.href = url;
                                      }}
                                      className="w-full bg-gradient-to-r from-red-500 to-purple-600 hover:from-red-600 hover:to-purple-700 text-white"
                                    >
                                      <ExternalLink className="w-4 h-4 mr-2" />
                                      View Full Profile
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          <div className={`text-xs mt-1 opacity-60 ${
                            message.role === 'user' ? 'text-right' : 'text-left'
                          }`}>
                            {formatTime(message.timestamp)}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area - Fixed at bottom for full page */}
          <div className={`${isFullPage ? 'fixed bottom-0 left-0 right-0 py-6 pb-12' : ''}`}>
          <div className={`${isFullPage ? 'max-w-3xl mx-auto px-6' : ''}`}>
          <div className={`flex space-x-3 ${isFullPage ? '' : 'mb-3'}`}>
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask Hi Chroney anything... (e.g., 'Generate timetable', 'Check attendance')"
                disabled={isLoading}
                className={`bg-white dark:bg-gray-900 text-foreground placeholder-muted-foreground rounded-lg pl-4 pr-12 py-3 w-full disabled:cursor-not-allowed disabled:opacity-60 transition-all duration-200 focus:outline-none ${
                  isFullPage 
                    ? 'border-2 border-purple-400 dark:border-purple-600 shadow-lg focus:border-purple-600 dark:focus:border-purple-500 focus:shadow-xl' 
                    : 'border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500/50'
                }`}
              />
              <Zap className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-purple-400" />
            </div>
            <Button
              onClick={() => handleSendMessage()}
              disabled={isLoading || !inputValue.trim()}
              className={`bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white border-0 rounded-lg px-6 transition-all duration-200 ${
                isFullPage ? 'shadow-lg hover:shadow-xl' : 'shadow-md hover:shadow-lg'
              }`}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Quick Action Suggestions and Quota Display - Hide suggestions on full page */}
          {!isFullPage && (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              {/* Suggestion Cards - Left */}
              <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => setInputValue("How many teachers are present today?")}
                disabled={isLoading}
                className="text-xs px-3 py-1.5 h-auto bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/40 dark:to-cyan-950/40 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:from-blue-100 hover:to-cyan-100 dark:hover:from-blue-900/50 dark:hover:to-cyan-900/50 rounded-md"
              >
                Check Attendance
              </Button>
              <Button
                variant="outline"
                onClick={() => setInputValue("Generate timetable")}
                disabled={isLoading}
                className="text-xs px-3 py-1.5 h-auto bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/40 dark:to-pink-950/40 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:from-purple-100 hover:to-pink-100 dark:hover:from-purple-900/50 dark:hover:to-pink-900/50 rounded-md"
              >
                Generate Timetable
              </Button>
              <Button
                variant="outline"
                onClick={() => setInputValue("Mark a teacher absent today")}
                disabled={isLoading}
                className="text-xs px-3 py-1.5 h-auto bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/40 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 hover:from-orange-100 hover:to-amber-100 dark:hover:from-orange-900/50 dark:hover:to-amber-900/50 rounded-md"
              >
                Mark Absent
              </Button>
              <Button
                variant="outline"
                onClick={() => setInputValue("Show me the timetable")}
                disabled={isLoading}
                className="text-xs px-3 py-1.5 h-auto bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/40 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 hover:from-green-100 hover:to-emerald-100 dark:hover:from-green-900/50 dark:hover:to-emerald-900/50 rounded-md"
              >
                View Timetable
              </Button>
              </div>

              {/* Quota Display - Right */}
              {quota.requestsTotal > 0 && (
                <div className="bg-card/80 dark:bg-slate-800/80 backdrop-blur-sm border border-border rounded-md px-3 py-1.5 text-[10px]">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <Activity className="h-3 w-3 text-blue-500" />
                      <span className="text-muted-foreground font-medium">Requests/day:</span>
                      <span className={`font-semibold ${quota.requestsUsed >= quota.requestsTotal ? 'text-red-600 dark:text-red-400' : 'text-foreground'}`}>
                        {quota.requestsUsed.toLocaleString()}/{quota.requestsTotal.toLocaleString()}
                      </span>
                    </div>
                    {quota.earliestResetTime && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground font-medium">Keys Reset:</span>
                        <span className="font-semibold text-orange-600 dark:text-orange-400">
                          {quota.earliestResetTime.toLocaleTimeString('en-IN', { 
                            hour: '2-digit', 
                            minute: '2-digit',
                            timeZone: 'Asia/Kolkata'
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
          </div>
        </div>
      </div>
      
      {/* Field Selection Dialog */}
      {fieldSelectionData && (
        <FieldSelectionDialog
          type={fieldSelectionData.type}
          count={fieldSelectionData.count}
          availableFields={fieldSelectionData.availableFields}
          onClose={() => setFieldSelectionData(null)}
        />
      )}
      
      {/* Error Dialog */}
      <AlertDialog open={errorDialog.open} onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{errorDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {errorDialog.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setErrorDialog({ open: false, title: '', message: '' })}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}