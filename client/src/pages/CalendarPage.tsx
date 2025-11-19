import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarIcon, Plus, Edit, Trash2, ChevronLeft, ChevronRight, Filter, ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, toDate } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { z } from "zod";

// IST Timezone constant
const IST_TIMEZONE = "Asia/Kolkata";

// Helper functions for IST timezone handling
const convertDatetimeLocalToIST = (datetimeLocal: string): string => {
  if (!datetimeLocal) return '';
  // Parse the datetime-local string (format: "2025-10-16T12:00")
  // Interpret this datetime as being in IST and convert to UTC ISO string
  
  // Parse the components
  const [datePart, timePart] = datetimeLocal.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = (timePart || '00:00').split(':').map(Number);
  
  // Create a plain date object with the values (in UTC context)
  const dateInISTContext = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
  
  // IST is UTC+5:30, so we subtract 5 hours 30 minutes to get the actual UTC time
  const offset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
  const utcDate = new Date(dateInISTContext.getTime() - offset);
  
  return utcDate.toISOString();
};

const convertISOToDatetimeLocalIST = (isoString: string): string => {
  if (!isoString) return '';
  // Convert UTC ISO string to IST datetime-local format
  const utcDate = new Date(isoString);
  const istDate = toZonedTime(utcDate, IST_TIMEZONE);
  
  // Format to datetime-local format (YYYY-MM-DDTHH:mm)
  const year = istDate.getFullYear();
  const month = String(istDate.getMonth() + 1).padStart(2, '0');
  const day = String(istDate.getDate()).padStart(2, '0');
  const hours = String(istDate.getHours()).padStart(2, '0');
  const minutes = String(istDate.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const formatDateInIST = (isoString: string, formatString: string): string => {
  const utcDate = new Date(isoString);
  const istDate = toZonedTime(utcDate, IST_TIMEZONE);
  return format(istDate, formatString);
};

interface CalendarEvent {
  id: string;
  schoolId: string;
  title: string;
  description?: string;
  eventType: "holiday" | "exam" | "event" | "meeting" | "other";
  startDate: string;
  endDate?: string;
  isRecurring: boolean;
  recurrencePattern?: string;
  color: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const eventFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title too long"),
  description: z.string().optional(),
  eventType: z.enum(["holiday", "exam", "event", "meeting", "other"]),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  isRecurring: z.boolean().default(false),
  recurrencePattern: z.string().optional(),
  color: z.string().min(1, "Color is required"),
});

type EventFormData = z.infer<typeof eventFormSchema>;

const EVENT_TYPE_COLORS = {
  holiday: "#EF4444",
  exam: "#3B82F6",
  meeting: "#10B981",
  event: "#8B5CF6",
  other: "#F59E0B",
};

const EVENT_TYPE_LABELS = {
  holiday: "Holiday",
  exam: "Exam",
  meeting: "Meeting",
  event: "Event",
  other: "Other",
};

export default function CalendarPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");

  const eventForm = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: "",
      description: "",
      eventType: "event",
      startDate: "",
      endDate: "",
      isRecurring: false,
      recurrencePattern: "",
      color: EVENT_TYPE_COLORS.event,
    },
  });

  // Scroll to top when component mounts to prevent auto-scroll behavior
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["/api/calendar/events", currentMonth.getMonth(), currentMonth.getFullYear(), eventTypeFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        month: currentMonth.getMonth().toString(),
        year: currentMonth.getFullYear().toString(),
      });
      if (eventTypeFilter !== "all") {
        params.append("eventType", eventTypeFilter);
      }
      const response = await apiRequest("GET", `/api/calendar/events?${params.toString()}`);
      return await response.json() as CalendarEvent[];
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      return apiRequest("POST", "/api/calendar/events", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
      toast({
        title: "Success",
        description: "Event created successfully",
      });
      setIsEventDialogOpen(false);
      eventForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create event",
        variant: "destructive",
      });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<EventFormData> }) => {
      return apiRequest("PUT", `/api/calendar/events/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
      toast({
        title: "Success",
        description: "Event updated successfully",
      });
      setIsEventDialogOpen(false);
      setEditingEvent(null);
      eventForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update event",
        variant: "destructive",
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/calendar/events/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar/events"] });
      toast({
        title: "Success",
        description: "Event deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete event",
        variant: "destructive",
      });
    },
  });

  const monthDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      // Convert event dates to IST timezone for comparison
      const eventStartIST = toZonedTime(new Date(event.startDate), IST_TIMEZONE);
      const eventEndIST = event.endDate ? toZonedTime(new Date(event.endDate), IST_TIMEZONE) : eventStartIST;
      
      // Get the date part in IST (ignoring time)
      const startDateOnly = new Date(eventStartIST.getFullYear(), eventStartIST.getMonth(), eventStartIST.getDate());
      const endDateOnly = new Date(eventEndIST.getFullYear(), eventEndIST.getMonth(), eventEndIST.getDate());
      const checkDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      
      return checkDateOnly >= startDateOnly && checkDateOnly <= endDateOnly;
    });
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleToday = () => {
    setCurrentMonth(new Date());
  };

  const handleAddEvent = () => {
    setEditingEvent(null);
    eventForm.reset({
      title: "",
      description: "",
      eventType: "event",
      startDate: selectedDate ? `${format(selectedDate, "yyyy-MM-dd")}T00:00` : "",
      endDate: "",
      isRecurring: false,
      recurrencePattern: "",
      color: EVENT_TYPE_COLORS.event,
    });
    setIsEventDialogOpen(true);
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    eventForm.reset({
      title: event.title,
      description: event.description || "",
      eventType: event.eventType,
      startDate: convertISOToDatetimeLocalIST(event.startDate),
      endDate: event.endDate ? convertISOToDatetimeLocalIST(event.endDate) : "",
      isRecurring: event.isRecurring,
      recurrencePattern: event.recurrencePattern || "",
      color: event.color,
    });
    setIsEventDialogOpen(true);
  };

  const handleDeleteEvent = (id: string) => {
    if (confirm("Are you sure you want to delete this event?")) {
      deleteEventMutation.mutate(id);
    }
  };

  const onSubmit = (data: EventFormData) => {
    // Convert datetime-local strings (interpreted as IST) to UTC ISO timestamps
    const payload = {
      ...data,
      startDate: convertDatetimeLocalToIST(data.startDate),
      endDate: data.endDate ? convertDatetimeLocalToIST(data.endDate) : undefined,
    };

    if (editingEvent) {
      updateEventMutation.mutate({ id: editingEvent.id, data: payload });
    } else {
      createEventMutation.mutate(payload);
    }
  };

  const handleEventTypeChange = (value: string) => {
    eventForm.setValue("eventType", value as any);
    eventForm.setValue("color", EVENT_TYPE_COLORS[value as keyof typeof EVENT_TYPE_COLORS]);
  };

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation("/more")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <CalendarIcon className="h-6 w-6 text-purple-600" />
              School Calendar
            </h1>
            <p className="text-sm text-muted-foreground">Manage school events, holidays, and important dates</p>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={handleAddEvent}>
            <Plus className="mr-2 h-4 w-4" />
            Add Event
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>{format(currentMonth, "MMMM yyyy")}</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  <SelectItem value="holiday">Holidays</SelectItem>
                  <SelectItem value="exam">Exams</SelectItem>
                  <SelectItem value="meeting">Meetings</SelectItem>
                  <SelectItem value="event">Events</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handlePreviousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={handleToday}>
                Today
              </Button>
              <Button variant="outline" onClick={handleNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-2 mb-2 text-center font-semibold">
                <div>Sun</div>
                <div>Mon</div>
                <div>Tue</div>
                <div>Wed</div>
                <div>Thu</div>
                <div>Fri</div>
                <div>Sat</div>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: monthDays[0].getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-24 border rounded-lg bg-muted/20" />
                ))}
                {monthDays.map((day) => {
                  const dayEvents = getEventsForDate(day);
                  const isToday = isSameDay(day, new Date());
                  return (
                    <div
                      key={day.toISOString()}
                      className={`h-24 border rounded-lg p-2 cursor-pointer hover:bg-muted/50 transition-colors ${
                        isToday ? "border-primary border-2" : ""
                      }`}
                      onClick={() => setSelectedDate(day)}
                    >
                      <div className={`text-sm font-semibold mb-1 ${isToday ? "text-primary" : ""}`}>
                        {format(day, "d")}
                      </div>
                      <div className="space-y-1 overflow-y-auto max-h-16">
                        {dayEvents.slice(0, 2).map((event) => (
                          <div
                            key={event.id}
                            className="text-xs px-1 py-0.5 rounded truncate"
                            style={{ backgroundColor: event.color + "20", color: event.color }}
                            title={event.title}
                          >
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-xs text-muted-foreground">+{dayEvents.length - 2} more</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {selectedDate ? `Events on ${format(selectedDate, "MMMM d, yyyy")}` : "All Events"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)
            ) : (
              (selectedDate ? getEventsForDate(selectedDate) : events).map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div
                      className="w-1 h-12 rounded-full"
                      style={{ backgroundColor: event.color }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{event.title}</h3>
                        <Badge style={{ backgroundColor: event.color + "20", color: event.color }}>
                          {EVENT_TYPE_LABELS[event.eventType]}
                        </Badge>
                      </div>
                      {event.description && (
                        <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatDateInIST(event.startDate, "MMM d, yyyy h:mm a")} IST
                        {event.endDate && ` - ${formatDateInIST(event.endDate, "MMM d, yyyy h:mm a")} IST`}
                      </div>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditEvent(event)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteEvent(event.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
            {!isLoading && (selectedDate ? getEventsForDate(selectedDate) : events).length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No events found
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEvent ? "Edit Event" : "Add Event"}</DialogTitle>
            <DialogDescription>
              {editingEvent ? "Update the event details" : "Create a new calendar event"}
            </DialogDescription>
          </DialogHeader>
          <Form {...eventForm}>
            <form onSubmit={eventForm.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={eventForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Title <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Event title" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={eventForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Event description (optional)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={eventForm.control}
                name="eventType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Event Type <span className="text-destructive">*</span>
                    </FormLabel>
                    <Select onValueChange={handleEventTypeChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select event type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="holiday">Holiday</SelectItem>
                        <SelectItem value="exam">Exam</SelectItem>
                        <SelectItem value="meeting">Meeting</SelectItem>
                        <SelectItem value="event">Event</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={eventForm.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Start Date <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          value={field.value?.split('T')[0] || ''} 
                          onChange={(e) => {
                            const currentTime = field.value?.split('T')[1] || '00:00';
                            field.onChange(e.target.value ? `${e.target.value}T${currentTime}` : '');
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={eventForm.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Start Time <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input 
                          type="time" 
                          value={field.value?.split('T')[1] || '00:00'} 
                          onChange={(e) => {
                            const currentDate = field.value?.split('T')[0] || '';
                            if (currentDate) {
                              field.onChange(`${currentDate}T${e.target.value}`);
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={eventForm.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Date (Optional)</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          value={field.value?.split('T')[0] || ''} 
                          onChange={(e) => {
                            const currentTime = field.value?.split('T')[1] || '23:00';
                            field.onChange(e.target.value ? `${e.target.value}T${currentTime}` : '');
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={eventForm.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time (Optional)</FormLabel>
                      <FormControl>
                        <Input 
                          type="time" 
                          value={field.value?.split('T')[1] || '23:00'} 
                          onChange={(e) => {
                            const currentDate = field.value?.split('T')[0] || '';
                            if (currentDate) {
                              field.onChange(`${currentDate}T${e.target.value}`);
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEventDialogOpen(false);
                    setEditingEvent(null);
                    eventForm.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createEventMutation.isPending || updateEventMutation.isPending}
                >
                  {editingEvent ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
