import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, 
  TrendingDown, 
  UserX, 
  ChevronRight, 
  Lightbulb,
  Sparkles,
  RefreshCw
} from "lucide-react";
import { useLocation } from "wouter";

interface Insight {
  id: string;
  category: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  details: any;
  action: { type: string; classId?: string; teacherId?: string };
  className?: string;
  teacherName?: string;
}

export function SchoolInsights() {
  const [, setLocation] = useLocation();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['/api/school-insights'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/school-insights');
      return await res.json() as { insights: Insight[] };
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const insights = data?.insights || [];

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'critical':
        return {
          badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
          border: 'border-red-200 dark:border-red-800',
          bg: 'bg-red-50/50 dark:bg-red-950/20',
          icon: <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
        };
      case 'warning':
        return {
          badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
          border: 'border-yellow-200 dark:border-yellow-800',
          bg: 'bg-yellow-50/50 dark:bg-yellow-950/20',
          icon: <TrendingDown className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
        };
      default:
        return {
          badge: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
          border: 'border-blue-200 dark:border-blue-800',
          bg: 'bg-blue-50/50 dark:bg-blue-950/20',
          icon: <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        };
    }
  };

  const getCategoryIcon = (category: string) => {
    if (category === 'ai-insights') return <Sparkles className="h-5 w-5" />;
    if (category === 'staffing') return <UserX className="h-5 w-5" />;
    if (category === 'attendance') return <TrendingDown className="h-5 w-5" />;
    return <AlertTriangle className="h-5 w-5" />;
  };

  const handleInsightAction = (insight: Insight) => {
    switch (insight.action.type) {
      case 'view_class':
        setLocation(`/classes/${insight.action.classId}`);
        break;
      case 'view_attendance':
        setLocation(`/attendance?classId=${insight.action.classId}`);
        break;
      case 'view_teacher':
        setLocation(`/teachers/${insight.action.teacherId}`);
        break;
      default:
        break;
    }
  };

  if (isLoading) {
    return (
      <Card className="border-purple-200/50 dark:border-purple-800/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-lg font-semibold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            School Insights
          </CardTitle>
          <Sparkles className="h-5 w-5 text-purple-500" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-purple-500" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (insights.length === 0) {
    return (
      <Card className="border-purple-200/50 dark:border-purple-800/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-lg font-semibold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            School Insights
          </CardTitle>
          <Sparkles className="h-5 w-5 text-purple-500" />
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex items-center gap-2 py-2">
            <Lightbulb className="h-5 w-5 text-green-500 flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              Great! No critical issues detected. Everything looks good!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // AI insights are shown first if available
  const aiInsight = insights.find(i => i.category === 'ai-insights');
  const otherInsights = insights.filter(i => i.category !== 'ai-insights');

  return (
    <Card className="border-purple-200/50 dark:border-purple-800/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-lg font-semibold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          School Insights
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Sparkles className="h-5 w-5 text-purple-500" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {aiInsight && (
          <div className="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border border-purple-200 dark:border-purple-800">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-sm text-purple-900 dark:text-purple-100 mb-1">
                  {aiInsight.title}
                </h4>
                <p className="text-sm text-purple-700 dark:text-purple-300 whitespace-pre-wrap">
                  {aiInsight.message}
                </p>
              </div>
            </div>
          </div>
        )}

        {otherInsights.slice(0, 5).map((insight) => {
          const styles = getSeverityStyles(insight.severity);
          
          return (
            <div
              key={insight.id}
              className={`p-3 rounded-lg border ${styles.border} ${styles.bg} transition-all hover:shadow-md`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  {styles.icon}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm">{insight.title}</h4>
                      <Badge variant="outline" className={`text-xs ${styles.badge}`}>
                        {insight.severity.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {insight.message}
                    </p>
                    {insight.details && Object.keys(insight.details).length > 0 && (
                      <div className="text-xs text-muted-foreground space-y-1">
                        {insight.details.shortage > 0 && (
                          <p>• Shortage: {insight.details.shortage} periods</p>
                        )}
                        {insight.details.timetableGap > 0 && (
                          <p>• Timetable Gap: {insight.details.timetableGap} periods</p>
                        )}
                        {insight.details.percentage !== undefined && (
                          <p>• Attendance: {insight.details.percentage}%</p>
                        )}
                        {insight.details.absentDays > 0 && (
                          <p>• Absent Days: {insight.details.absentDays}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {insight.action.type !== 'none' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleInsightAction(insight)}
                    className="h-8 px-2"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}

        {otherInsights.length > 5 && (
          <p className="text-xs text-center text-muted-foreground pt-2">
            Showing top 5 insights. {otherInsights.length - 5} more available.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
