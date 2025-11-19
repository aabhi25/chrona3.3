import { Request, Response } from "express";
import { storage } from "./storage";
import { z } from "zod";
import llamaService from "./llamaService";
import conversationMemory from "./conversationMemory";

// Chat request schema
const chatRequestSchema = z.object({
  message: z.string().min(1, "Message cannot be empty")
});

/**
 * Simplified processChatMessage - Now only used internally for AI analysis (school insights & teacher planner)
 * Frontend chat uses processChroneyToolChat instead
 */
export async function processChatMessage(req: Request, res: Response) {
  try {
    const { message } = chatRequestSchema.parse(req.body);
    
    // Get user info from authenticated request
    const user = (req as any).user;
    if (!user || !user.schoolId) {
      return res.status(401).json({ 
        response: "You must be logged in to a school." 
      });
    }
    
    const userId = user.id;
    const userRole = user.role;
    const schoolId = user.schoolId;
    
    // Check if LLAMA is connected
    if (!llamaService.getConnectionStatus()) {
      await llamaService.initialize();
    }
    
    //Get conversation context
    const conversationContext = conversationMemory.formatConversationContext(userId);
    
    // Generate conversational response using LLAMA
    try {
      const conversationalResponse = await llamaService.generateConversationalResponse(
        message, 
        userRole, 
        schoolId, 
        conversationContext
      );
      
      // Store conversation
      conversationMemory.storeConversation(userId, message, conversationalResponse);
      
      return res.json({
        response: conversationalResponse
      });
    } catch (error: any) {
      console.log('❌ LLAMA response failed:', error.message);
      const fallbackResponse = "I'm here to help analyze school data. Please try again.";
      
      conversationMemory.storeConversation(userId, message, fallbackResponse);
      
      return res.json({
        response: fallbackResponse
      });
    }
  } catch (error: any) {
    console.error("Error in processChatMessage:", error);
    return res.status(500).json({ message: error.message });
  }
}

/**
 * NEW: Tool-based Chroney Chat (Phase 1)
 * Uses function calling with tools for dynamic data access
 */
export async function processChroneyToolChat(req: Request, res: Response) {
  try {
    const { message } = chatRequestSchema.parse(req.body);
    
    // Debug: Log user message to track CONFIRM_ATTENDANCE flow
    console.log('[CHAT] User message:', message);
    
    // Get user info from authenticated request
    const user = (req as any).user;
    if (!user || !user.schoolId) {
      return res.status(401).json({ 
        reply: "You must be logged in to a school to use Chroney assistant." 
      });
    }
    
    const userId = user.id;
    const userRole = user.role;
    const schoolId = user.schoolId;
    
    // Only allow admin users for now (Phase 1)
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      return res.json({
        reply: "Tool-based Chroney is currently available for administrators only."
      });
    }
    
    // Note: We no longer check global connection status here
    // The school-specific API key will be used when calling OpenAI methods
    
    // Get school context and tools
    const { SchoolContextService } = await import("./services/schoolContextService");
    const { formatToolsForLLAMA, selectRelevantTools } = await import("./chroneyTools");
    const { ToolExecutionService } = await import("./services/toolExecutionService");
    const { ConversationContextService } = await import("./services/conversationContextService");
    const { schoolContextCache } = await import("./services/schoolContextCache");
    
    // OPTIMIZATION 1: Detect topic switches early (no await needed)
    const topicSwitched = ConversationContextService.detectTopicSwitch(userId, message);
    if (topicSwitched) {
      ConversationContextService.resetEntitiesForTopicSwitch(userId);
    }
    
    // OPTIMIZATION 2: Parallel context loading with caching (was sequential)
    const [schoolContext, conversationContextSummary] = await Promise.all([
      // Cached school context (5min TTL) - saves ~0.5s on cache hits
      schoolContextCache.getOrFetch(schoolId, () => SchoolContextService.getContextSummary(schoolId)),
      // Conversation context (fast in-memory operation)
      Promise.resolve(ConversationContextService.getContextSummary(userId))
    ]);
    
    const enhancedSchoolContext = `${schoolContext} | ${conversationContextSummary}`;
    
    // OPTIMIZATION 3: Smart tool selection - send only relevant tools instead of all 19
    // Include recent conversation context for better tool selection
    const recentConversations = conversationMemory.getConversationHistory(userId).slice(-2);
    const conversationContextForTools = recentConversations.map(c => c.userMessage + ' ' + c.aiResponse).join(' ');
    const relevantTools = selectRelevantTools(message + ' ' + conversationContextForTools);
    const tools = formatToolsForLLAMA(relevantTools);
    
    // TOKEN METRICS: Calculate approximate token savings
    const allToolsFormatted = formatToolsForLLAMA();
    const baselineTokens = JSON.stringify(allToolsFormatted).length / 4; // ~4 chars per token
    const optimizedTokens = JSON.stringify(tools).length / 4;
    const toolSavings = Math.round((1 - optimizedTokens/baselineTokens) * 100);
    console.log(`[TOKEN OPTIMIZATION] Tools: ${baselineTokens.toFixed(0)} → ${optimizedTokens.toFixed(0)} tokens (${toolSavings}% saved)`);
    
    // Memory: Include conversations from last 10 minutes for better context
    const tenMinutesAgo = new Date(Date.now() - (10 * 60 * 1000)); // 10 minutes ago
    const conversationHistory = conversationMemory.getConversationHistory(userId)
      .filter(conv => conv.timestamp >= tenMinutesAgo) // Last 10 minutes
      .flatMap(conv => [
        {
          role: 'user' as const,
          content: conv.userMessage
        },
        {
          role: 'assistant' as const,
          content: conv.aiResponse
        }
      ]);
    
    // PHASE 2: Multi-step tool chaining
    const MAX_TOOL_CHAIN_ITERATIONS = 2; // Reduced from 3 to 2 for faster responses
    let currentMessage = message;
    let chainedHistory = [...conversationHistory];
    let allToolResults: any[] = [];
    let finalReply: string = "Query processed"; // Default fallback
    let action: string | undefined;
    let actionData: any | undefined;
    
    for (let iteration = 0; iteration < MAX_TOOL_CHAIN_ITERATIONS; iteration++) {
      console.log(`[CHRONEY] Tool chain iteration ${iteration + 1}/${MAX_TOOL_CHAIN_ITERATIONS}`);
      
      // Add topic switch notification to the message if needed (only on first iteration)
      const messageWithContext = (iteration === 0 && topicSwitched) 
        ? `[NEW TOPIC] Starting fresh conversation about this topic. Previous entity context has been cleared.\n\nUser message: ${currentMessage}`
        : currentMessage;
      
      // Generate tool-aware response with conversation history for memory
      const llmResponse = await llamaService.generateToolAwareResponse(
        messageWithContext,
        userRole,
        schoolId,
        tools,
        chainedHistory
      );
      
      if (llmResponse.type === 'tool_calls' && llmResponse.toolCalls) {
        console.log(`[CHRONEY] Executing ${llmResponse.toolCalls.length} tool(s)`);
        
        // Execute all tool calls in parallel
        const toolResults = await Promise.all(
          llmResponse.toolCalls.map(async (toolCall) => {
            // OpenAI returns tool_calls with structure: { id, type: 'function', function: { name, arguments } }
            const toolName = toolCall.function?.name || toolCall.name;
            const toolParams = toolCall.function?.arguments 
              ? JSON.parse(toolCall.function.arguments) 
              : toolCall.parameters;
            
            console.log(`[CHRONEY] Calling tool: ${toolName}`);
            const result = await ToolExecutionService.executeTool(
              toolName,
              toolParams,
              { schoolId, userId, userRole }
            );
            return { toolName, parameters: toolParams, result };
          })
        );
        
        allToolResults.push(...toolResults);
        
        // PHASE 2: Track tool calls in conversation context
        toolResults.forEach(tr => {
          if (tr.result.success) {
            ConversationContextService.addToolCall(
              userId,
              tr.toolName,
              tr.parameters,
              tr.result
            );
          }
        });
        
        // Check if we should continue chaining
        const successfulResults = toolResults.filter(tr => tr.result.success);
        const failedResults = toolResults.filter(tr => !tr.result.success);
        
        if (failedResults.length > 0) {
          // If any tool failed, stop chaining
          finalReply = failedResults[0].result.error || "I couldn't complete that action.";
          break;
        }
        
        // Check if any tool result has an action in its data
        const toolWithAction = successfulResults.find(tr => tr.result.data?.action);
        if (toolWithAction) {
          action = toolWithAction.result.data?.action;
          actionData = toolWithAction.result.data?.actionData || toolWithAction.result.data;
          
          // For Excel export, bypass LLM entirely and return directly
          if (action === 'download_excel') {
            console.log('[CHRONEY] Detected Excel export action - bypassing LLM');
            finalReply = toolWithAction.result.message || 'Your Excel file is ready to download.';
            break; // Exit tool chain immediately - no need for LLM
          }
          
          // For attendance report, bypass LLM and show report with export button
          if (action === 'show_attendance_report') {
            console.log('[CHRONEY] Detected attendance report action - bypassing LLM');
            finalReply = toolWithAction.result.message || 'Here is the attendance report.';
            break; // Exit tool chain immediately
          }
          
          // For timetable actions, let LLM analyze the data to provide specific answer
          if (action === 'show_timetable' && toolWithAction.result.message) {
            console.log('[CHRONEY] Detected timetable action - triggering analysis');
            // Make a follow-up LLM call to analyze the timetable data
            const analysisPrompt = `Based on the timetable data below, answer the user's question specifically and concisely.

User Question: ${message}

Timetable Data:
${toolWithAction.result.message}

Current Date/Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}

Instructions:
- Answer the specific question asked (e.g., "After lunch, she teaches Mathematics to Class 1B at 11:00 AM")
- Use current time context if question involves "now", "today", "this period", etc.
- Be conversational and friendly
- Keep response under 2 sentences`;

            try {
              console.log('[CHRONEY] Calling analysis LLM...');
              const analysisResponse = await llamaService.generateSimpleResponse(analysisPrompt, schoolId);
              console.log('[CHRONEY] Analysis response received, length:', analysisResponse?.length || 0);
              console.log('[CHRONEY] Analysis content:', analysisResponse?.substring(0, 150) || '(empty)');
              
              // Use analysis if we got a meaningful response (more than just whitespace)
              if (analysisResponse && analysisResponse.trim().length > 0) {
                finalReply = analysisResponse.trim();
                console.log('[CHRONEY] Using analysis response');
              } else {
                console.log('[CHRONEY] Analysis returned empty, using default message');
                finalReply = "I processed your request successfully.";
              }
            } catch (error) {
              console.error('[CHRONEY] Failed to analyze timetable:', error);
              finalReply = "I processed your request successfully.";
            }
          } else {
            finalReply = toolWithAction.result.message || "I processed your request.";
          }
          
          break; // Stop chaining and use this action
        }
        
        // Check if we got a definitive answer from query_school_data (stop immediately, don't wait for last iteration)
        if (successfulResults[0]?.toolName === 'query_school_data') {
          const message = successfulResults[0].result.message || '';
          if (message && !message.includes('Attendance data from')) {
            // We got a specific answer - stop immediately and use it
            finalReply = message;
            
            // Check for absent list to display
            if (successfulResults[0].result.data?.absentStudents?.length > 0) {
              action = 'show_absent_list';
              actionData = {
                type: 'students',
                list: successfulResults[0].result.data.absentStudents,
              };
            } else if (successfulResults[0].result.data?.absentTeachers?.length > 0) {
              action = 'show_absent_list';
              actionData = {
                type: 'teachers',
                list: successfulResults[0].result.data.absentTeachers,
              };
            }
            break; // Stop chaining immediately
          }
        }
        
        // Build OpenAI-compliant tool message format for iteration 2
        // Format: [{role:'assistant', tool_calls:[...]}, {role:'tool', tool_call_id, content:...}]
        const assistantToolCallMessage = {
          role: 'assistant' as const,
          content: null as any, // OpenAI allows null for tool_calls messages
          tool_calls: llmResponse.toolCalls?.map((tc, idx) => ({
            id: tc.id || `call_${idx}`,
            type: 'function' as const,
            function: {
              name: tc.function?.name || tc.name,
              arguments: tc.function?.arguments || JSON.stringify(tc.parameters || {})
            }
          })) || []
        } as any; // OpenAI message format needs flexibility
        
        const toolResponseMessages = toolResults.map((tr, idx) => ({
          role: 'tool' as const,
          tool_call_id: llmResponse.toolCalls?.[idx]?.id || `call_${idx}`,
          content: JSON.stringify({
            success: tr.result.success,
            message: tr.result.message,
            data: tr.result.data
          })
        })) as any[]; // OpenAI expects tool role, TypeScript needs any for flexibility
        
        chainedHistory.push(assistantToolCallMessage);
        chainedHistory.push(...toolResponseMessages);
        
        // Continue conversation with tool results using OpenAI's continueToolConversation
        // Build the full conversation history with system prompt, user message, and tool messages
        const systemPrompt = {
          role: 'system' as const,
          content: `You are Chroney, school management AI assistant.

RULES:
1. For "show timetable for class X" → call fetch_timetable with classId
2. For "list students/teachers" → call list_entities
3. For "who's absent today" → call query_school_data (PREFERRED for current attendance)
4. For profile requests (e.g., "show profile of [name]", "show me [name]", or just a student ID like "STU0115" or teacher ID like "T001"):
   - If input is just an ID (e.g., "STU0115", "ADM123", "T001") → call fetch_student_profile or fetch_teacher_profile immediately
   - If input is a name → call the appropriate profile tool (it will show options if multiple matches)
5. For greetings → respond warmly and ask how you can help
6. For attendance marking (covers ALL: present, absent, late for BOTH students and teachers):
   - Step 1: If user doesn't specify student/teacher, ASK: "Is [Name] a student or teacher?"
   - Step 2: Call mark_attendance with confirmed=false → Tool shows person details and asks "Are you sure?"
   - Step 3: User confirms "yes" → Call mark_attendance AGAIN with confirmed=true → Attendance marked
   - ALWAYS require confirmation before marking - NEVER mark directly without "Are you sure?" step
   - Example flow: "mark aarav absent" → "Is Aarav a student or teacher?" → "student" → Show details "Are you sure?" → "yes" → Mark absent

CRITICAL:
- ALWAYS synthesize a helpful response from tool results
- NEVER say "I'm not sure how to help"
- Provide clear, concise answers based on the data you receive
- When showing profiles, ONLY say "Here's [Name]'s profile:" and NOTHING MORE - DO NOT offer follow-up actions or ask questions
- NEVER offer features like "pull up attendance", "guardians/parents", or other details unless the user specifically asks
- Keep responses minimal and let the UI do the talking
- When marking attendance, use the EXACT message from the tool result (it includes role, class, ID) - DO NOT modify or simplify it
- When showing free teachers (find_free_teachers), use the EXACT message from the tool - it has the formatted list with teacher names - DO NOT summarize or ask follow-up questions

User context:
- Role: ${userRole}
- School: ${enhancedSchoolContext || schoolId}`
        };
        
        const conversationMessages = [
          systemPrompt,
          { role: 'user' as const, content: message },
          ...chainedHistory
        ];
        
        const continuationResponse = await llamaService.continueToolConversation(
          conversationMessages,
          tools,
          schoolId
        );
        
        // Check if AI wants to call more tools or provide final answer
        if (continuationResponse.type === 'tool_calls' && continuationResponse.toolCalls) {
          // AI wants to call more tools - update llmResponse and continue loop
          llmResponse.toolCalls = continuationResponse.toolCalls;
          llmResponse.type = 'tool_calls';
          continue; // Continue to next iteration
        } else {
          // AI provided a final answer
          finalReply = continuationResponse.content || "I processed your request successfully.";
          
          // SPECIAL HANDLING: For find_free_teachers, use the tool's formatted message directly and set table action
          if (successfulResults[0]?.toolName === 'find_free_teachers') {
            const result = successfulResults[0].result;
            // Set action to display teachers in a table
            if (result.data?.freeTeachers && result.data.freeTeachers.length > 0) {
              // Create a short header message without the list (table will show the data)
              const dayDisplay = result.data.day ? result.data.day.charAt(0).toUpperCase() + result.data.day.slice(1) : '';
              const timeDisplay = result.data.timeSlot ? `${result.data.timeSlot.startTime} - ${result.data.timeSlot.endTime}` : '';
              finalReply = `📋 **Free Teachers for Period ${result.data.period}** (${dayDisplay}, ${timeDisplay})\n\n📊 **Summary:** ${result.data.freeTeachers.length} free out of ${result.data.totalTeachers} total teachers`;
              
              action = 'show_entity_table';
              actionData = {
                type: 'free_teachers',
                data: result.data.freeTeachers,
                totalCount: result.data.freeTeachers.length,
                period: result.data.period,
                day: result.data.day,
                timeSlot: result.data.timeSlot,
              };
            } else if (result.message) {
              // If no free teachers or it's a break period, use the original message
              finalReply = result.message;
            }
          }
          
          // Set action data for display based on tool results
          if (successfulResults[0]?.toolName === 'fetch_timetable' && successfulResults[0]?.result.data?.timetableDisplay) {
            action = 'show_timetable';
            actionData = successfulResults[0].result.data.timetableDisplay;
          } else if (successfulResults[0]?.toolName === 'query_school_data') {
            // Check for absent lists
            if (successfulResults[0].result.data?.absentStudents?.length > 0) {
              action = 'show_absent_list';
              actionData = {
                type: 'students',
                list: successfulResults[0].result.data.absentStudents,
              };
            } else if (successfulResults[0].result.data?.absentTeachers?.length > 0) {
              action = 'show_absent_list';
              actionData = {
                type: 'teachers',
                list: successfulResults[0].result.data.absentTeachers,
              };
            }
          } else if (successfulResults[0]?.toolName === 'list_entities') {
            const result = successfulResults[0].result as any;
            if (result.data && result.metadata?.totalCount) {
              const entityType = result.metadata.redirectUrl?.includes('/students') ? 'students' : 'teachers';
              action = 'show_entity_table';
              
              // Transform teacher data to include schoolId field (prefer schoolIdNumber, fallback to employeeId)
              const transformedData = entityType === 'teachers' 
                ? result.data.map((t: any) => ({
                    ...t,
                    schoolId: t.schoolIdNumber || t.employeeId || '-'
                  }))
                : result.data;
              
              actionData = {
                type: entityType,
                data: transformedData,
                totalCount: result.metadata.totalCount,
                redirectUrl: result.metadata.redirectUrl,
                redirectLabel: result.metadata.redirectLabel || 'View All'
              };
            }
          } else if (successfulResults[0]?.toolName === 'fetch_student_profile' || successfulResults[0]?.toolName === 'fetch_teacher_profile') {
            const result = successfulResults[0].result as any;
            if (result.metadata?.requiresConfirmation) {
              // Multiple matches found, need confirmation
              action = 'show_confirmation_list';
              actionData = {
                confirmationType: result.metadata.confirmationType,
                options: result.metadata.options,
              };
            } else if (result.metadata?.showProfileDialog) {
              action = 'show_profile_dialog';
              actionData = {
                profileType: result.metadata.profileType,
                profileData: result.metadata.profileData
              };
            }
          }
          
          break; // End the chain
        }
        
      } else {
        // Text response - end of chain
        console.log(`[CHRONEY] Got text response, ending chain`);
        finalReply = llmResponse.content || "I'm not sure how to help with that.";
        
        // If we have tool results, set action data (use FIRST timetable, not last)
        if (allToolResults.length > 0) {
          const successfulResults = allToolResults.filter(tr => tr.result.success);
          const firstSuccessful = successfulResults[0];
          if (firstSuccessful?.toolName === 'fetch_timetable' && firstSuccessful?.result.data?.timetableDisplay) {
            action = 'show_timetable';
            actionData = firstSuccessful.result.data.timetableDisplay;
          } else if (firstSuccessful && firstSuccessful.toolName.includes('fetch')) {
            action = 'display_data';
            actionData = firstSuccessful.result.data;
          }
        }
        break;
      }
    }
    
    console.log(`[CHRONEY] Tool chain completed with ${allToolResults.length} total tool call(s)`);
    
    // FALLBACK: If we haven't set action/actionData yet (e.g., hit max iterations),
    // check the tool results to see if we should show tables or other UI
    if (!action && allToolResults.length > 0) {
      const successfulResults = allToolResults.filter(tr => tr.result.success);
      const firstSuccessful = successfulResults[0];
      
      if (firstSuccessful?.toolName === 'list_entities') {
        const result = firstSuccessful.result as any;
        if (result.data && result.metadata?.totalCount) {
          const entityType = result.metadata.redirectUrl?.includes('/students') ? 'students' : 'teachers';
          action = 'show_entity_table';
          actionData = {
            type: entityType,
            data: result.data,
            totalCount: result.metadata.totalCount,
            redirectUrl: result.metadata.redirectUrl,
            redirectLabel: result.metadata.redirectLabel || 'View All'
          };
          // Update reply to be more helpful
          if (finalReply === "Query processed") {
            finalReply = `Here are the first ${result.data.length} ${entityType} from your school:`;
          }
        }
      } else if (firstSuccessful?.toolName === 'fetch_student_profile' || firstSuccessful?.toolName === 'fetch_teacher_profile') {
        const result = firstSuccessful.result as any;
        if (result.metadata?.showProfileDialog) {
          action = 'show_profile_dialog';
          actionData = {
            profileType: result.metadata.profileType,
            profileData: result.metadata.profileData
          };
        } else if (result.metadata?.confirmationList) {
          // Handle multi-match confirmation list
          action = 'show_confirmation_list';
          actionData = result.metadata.confirmationList;
        }
      } else if (firstSuccessful?.toolName === 'mark_attendance') {
        const result = firstSuccessful.result as any;
        if (result.data?.needsConfirmation) {
          // Handle attendance confirmation request (show beautiful card)
          const details = result.data.teacherDetails || result.data.studentDetails;
          const personType = result.data.teacherDetails ? 'teacher' : 'student';
          
          action = 'show_attendance_confirmation';
          actionData = {
            personType,
            name: details.name,
            id: details.id,
            schoolId: details.schoolId,
            admissionNumber: details.admissionNumber,
            class: details.class,
            classes: details.classes,
          };
          
          // Extract status from the tool call parameters  
          const statusFromTool = allToolResults.find(r => r.toolName === 'mark_attendance')?.parameters?.status || 'absent';
          
          // Store confirmation details in actionData for AI to reference
          actionData.pendingConfirmation = {
            id: details.id,
            type: personType,
            status: statusFromTool
          };
          
          // Replace the detailed message with a simple prompt
          finalReply = `Please confirm:`;
        } else if (result.metadata?.confirmationList) {
          // Handle attendance teacher selection confirmation list
          action = 'show_confirmation_list';
          actionData = result.metadata.confirmationList;
        } else if (result.success && result.data && (result.data.teacherName || result.data.studentName)) {
          // Handle successful attendance marking - show success card (only if we have a name)
          action = 'show_attendance_success';
          actionData = {
            personType: result.data.studentName ? 'student' : 'teacher',
            name: result.data.teacherName || result.data.studentName || 'Unknown',
            schoolId: result.data.schoolId || '',
            admissionNumber: result.data.admissionNumber || '',
            class: result.data.class || '',
            classes: result.data.classes || '',
            status: result.data.status || 'present',
            date: result.data.date || new Date().toISOString().split('T')[0],
          };
          // Clear the text message since the card shows all the info
          finalReply = '';
        }
      }
    }
    
    // PHASE 2: Update conversation topic based on tool calls
    if (allToolResults.length > 0) {
      ConversationContextService.updateConversationTopic(userId);
    }
    
    // Store conversation
    conversationMemory.storeConversation(
      userId,
      message,
      finalReply
    );
    
    return res.json({
      reply: finalReply,
      action,
      actionData
    });
    
  } catch (error: any) {
    console.error('Chroney tool chat error:', error);
    
    const errorReply = error instanceof z.ZodError 
      ? "I need a valid message to process. Please try again."
      : "⚠️ Something went wrong. Please try again.";
    
    const user = (req as any).user;
    if (user?.id) {
      const { message } = req.body;
      conversationMemory.storeConversation(user.id, message || "Invalid request", errorReply);
    }
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ reply: errorReply });
    }
    
    res.status(500).json({ reply: errorReply });
  }
}

/**
 * Reset chat memory and context for a user (called on new chat session)
 */
export async function resetChatMemory(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user || !user.id) {
      return res.status(401).json({ 
        success: false,
        message: "Unauthorized" 
      });
    }
    
    const userId = user.id;
    
    // Clear conversation memory
    conversationMemory.clearUserConversations(userId);
    
    // Clear conversation context (entities, tool history, topic)
    const { ConversationContextService } = await import("./services/conversationContextService");
    ConversationContextService.clearContext(userId);
    
    console.log(`[CHAT] Memory and context reset for user ${userId}`);
    
    return res.json({
      success: true,
      message: "Chat memory cleared"
    });
    
  } catch (error: any) {
    console.error('Error resetting chat memory:', error);
    return res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
}