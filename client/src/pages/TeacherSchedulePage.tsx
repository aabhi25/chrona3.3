import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, BookOpen, MapPin, Users } from "lucide-react";
import { format } from "date-fns";

interface TimetableEntry {
  id: string;
  day: string;
  periodNumber: number;
  startTime: string;
  endTime: string;
  subjectName: string;
  subjectCode: string;
  className: string;
  classId: string;
  room?: string;
}

interface DetailedTimetableEntry {
  id: string;
  day: string;
  period: number;
  startTime: string;
  endTime: string;
  classId: string;
  room?: string;
  subject?: {
    name: string;
    code: string;
  };
  class?: {
    name: string;
    grade: number;
    section: string;
  };
}

const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function TeacherSchedulePage() {
  const { user } = useAuth();

  const { data: timetable = [], isLoading } = useQuery<TimetableEntry[]>({
    queryKey: ["teacher-timetable", (user as any)?.teacherId],
    queryFn: async () => {
      const teacherId = (user as any)?.teacherId;
      if (!teacherId) {
        return [];
      }

      const token = localStorage.getItem("authToken");
      if (!token) {
        throw new Error("No auth token");
      }

      const res = await fetch(`/api/timetable/detailed?teacherId=${teacherId}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        throw new Error("Failed to fetch timetable");
      }

      const detailedData: DetailedTimetableEntry[] = await res.json();
      
      // Transform the nested data structure to flat structure
      return detailedData.map((entry) => ({
        id: entry.id,
        day: entry.day,
        periodNumber: entry.period,
        startTime: entry.startTime,
        endTime: entry.endTime,
        subjectName: entry.subject?.name || 'Unknown Subject',
        subjectCode: entry.subject?.code || 'N/A',
        className: entry.class ? `${entry.class.grade}-${entry.class.section}` : 'Unknown Class',
        classId: entry.classId,
        room: entry.room,
      }));
    },
    enabled: !!user,
  });

  // Group timetable by day (case-insensitive comparison)
  const timetableByDay = DAYS_ORDER.reduce((acc, day) => {
    acc[day] = timetable
      .filter((entry) => entry.day.toLowerCase() === day.toLowerCase())
      .sort((a, b) => a.periodNumber - b.periodNumber);
    return acc;
  }, {} as Record<string, TimetableEntry[]>);

  // Calculate statistics
  const totalClasses = timetable.length;
  const uniqueSubjects = new Set(timetable.map((t) => t.subjectCode)).size;
  const uniqueClasses = new Set(timetable.map((t) => t.classId)).size;

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading your schedule...</p>
        </div>
      </div>
    );
  }

  // Define all periods (1-9) to show complete timetable
  const allPeriods = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  
  // Standard period timings (fallback if no classes scheduled)
  const standardPeriodTimings: Record<number, string> = {
    1: "07:30 - 08:15",
    2: "08:15 - 09:00",
    3: "09:00 - 09:45",
    4: "09:45 - 10:15",
    5: "10:15 - 11:00",
    6: "11:00 - 11:45",
    7: "11:45 - 12:30",
    8: "12:30 - 13:15",
    9: "13:15 - 14:00",
  };
  
  // Get period timings from timetable data, fallback to standard timings
  const periodTimings: Record<number, string> = { ...standardPeriodTimings };
  timetable.forEach(entry => {
    if (entry.periodNumber && entry.startTime && entry.endTime) {
      periodTimings[entry.periodNumber] = `${entry.startTime} - ${entry.endTime}`;
    }
  });

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">My Schedule</h1>
        <p className="text-muted-foreground mt-1">Your weekly teaching schedule</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Periods</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalClasses}</div>
            <p className="text-xs text-muted-foreground">per week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subjects</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueSubjects}</div>
            <p className="text-xs text-muted-foreground">different subjects</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Classes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueClasses}</div>
            <p className="text-xs text-muted-foreground">different classes</p>
          </CardContent>
        </Card>
      </div>

      {/* Timetable Grid */}
      {totalClasses === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Schedule Available</h3>
            <p className="text-muted-foreground">
              Your teaching schedule hasn't been created yet. Please contact your administrator.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-lg">
          <CardContent className="p-0">
            <div className="overflow-auto">
              <table className="w-full table-fixed border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800">
                    <th className="p-2 md:p-3 text-left font-semibold border-2 border-slate-300 dark:border-slate-600 w-[100px] md:w-[140px]">
                      <div className="text-xs md:text-sm">Period</div>
                    </th>
                    {DAYS_ORDER.map((day) => (
                      <th key={day} className="p-2 md:p-3 text-left font-semibold border-2 border-slate-300 dark:border-slate-600">
                        <div className="text-xs md:text-sm truncate">{day}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allPeriods.map((period) => (
                    <tr key={period} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-2 md:p-3 border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50">
                        <div className="text-xs md:text-sm font-semibold">P{period}</div>
                        <div className="text-[10px] md:text-xs text-muted-foreground mt-0.5">
                          {periodTimings[period] || '-'}
                        </div>
                      </td>
                      {DAYS_ORDER.map((day) => {
                        const entry = timetableByDay[day]?.find(e => e.periodNumber === period);
                        
                        return (
                          <td key={`${day}-${period}`} className="p-1.5 md:p-2 border-2 border-slate-300 dark:border-slate-600 align-top bg-white dark:bg-slate-950">
                            {entry ? (
                              <div className="space-y-1 p-1 rounded-md bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/50 shadow-sm">
                                <Badge variant="default" className="text-[10px] md:text-xs px-1.5 py-0.5">
                                  {entry.className}
                                </Badge>
                                <div className="text-xs md:text-sm font-medium line-clamp-2">
                                  {entry.subjectName}
                                </div>
                                {entry.room && (
                                  <div className="flex items-center gap-1 text-[10px] md:text-xs text-muted-foreground">
                                    <MapPin className="w-2.5 h-2.5 md:w-3 md:h-3 flex-shrink-0" />
                                    <span className="truncate">{entry.room}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-center text-xs text-muted-foreground py-2">-</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
