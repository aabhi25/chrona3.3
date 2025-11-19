import { useState, useRef, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Calendar, Clock, MoreVertical, AlertTriangle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { InsertTimetableStructure } from "@shared/schema";

interface TimeSlot {
  period: number;
  startTime: string;
  endTime: string;
  isBreak?: boolean;
}

interface InteractiveTimetableGridProps {
  structure: InsertTimetableStructure;
  onStructureChange: (structure: InsertTimetableStructure) => void;
  editMode: boolean;
  onValidationChange?: (hasErrors: boolean) => void;
}

interface ValidationError {
  slotIndex: number;
  field: 'startTime' | 'endTime';
  message: string;
}

interface ValidationState {
  errors: ValidationError[];
  hasErrors: boolean;
}

const allDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export function InteractiveTimetableGrid({
  structure,
  onStructureChange,
  editMode,
  onValidationChange
}: InteractiveTimetableGridProps) {
  const { toast } = useToast();
  const [editingCell, setEditingCell] = useState<{type: 'time' | 'period', slotIndex: number, field?: 'startTime' | 'endTime'} | null>(null);
  const [tempValue, setTempValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when editing starts
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  // Format time to 12-hour format with AM/PM
  const formatTime12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':');
    const hour24 = parseInt(hours, 10);
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    return `${hour12}:${minutes} ${ampm}`;
  };

  // Helper function to calculate teaching period number (excluding breaks)
  const getTeachingPeriodNumber = (actualPeriod: number): number => {
    if (!structure?.timeSlots) return actualPeriod;
    
    let teachingPeriodCount = 0;
    for (const slot of structure.timeSlots) {
      if (slot.period <= actualPeriod && !slot.isBreak) {
        teachingPeriodCount++;
      }
    }
    return teachingPeriodCount;
  };

  // Sort working days in proper order
  const sortWorkingDays = (days: string[]): string[] => {
    return allDays.filter(day => days.includes(day));
  };

  // Normalize time to 24-hour format and handle edge cases
  const normalizeTime = (timeStr: string): string | null => {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(timeStr)) {
      return null;
    }
    const [hours, minutes] = timeStr.split(':').map(Number);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  // Add time safely with proper normalization and NaN protection
  const addMinutesToTime = (timeStr: string, minutesToAdd: number): string => {
    try {
      const [hours, minutes] = timeStr.split(':').map(Number);
      
      // Guard against NaN inputs
      if (isNaN(hours) || isNaN(minutes) || isNaN(minutesToAdd)) {
        console.warn('Invalid time input, using fallback');
        return "09:45"; // Safe fallback
      }
      
      const totalMinutes = hours * 60 + minutes + minutesToAdd;
      const normalizedMinutes = Math.max(0, Math.min(totalMinutes, 23 * 60 + 59)); // Clamp to valid day range
      const newHours = Math.floor(normalizedMinutes / 60);
      const newMinutes = normalizedMinutes % 60;
      return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`;
    } catch (error) {
      console.warn('Error in time calculation, using fallback:', error);
      return "09:45"; // Safe fallback
    }
  };

  // Comprehensive validation system with simplified overlap checking
  const validateAllTimeSlots = (timeSlots: TimeSlot[]): ValidationState => {
    const errors: ValidationError[] = [];
    
    timeSlots.forEach((slot, index) => {
      const hasValidStartTime = normalizeTime(slot.startTime);
      const hasValidEndTime = normalizeTime(slot.endTime);
      
      // Validate time format
      if (!hasValidStartTime) {
        errors.push({
          slotIndex: index,
          field: 'startTime',
          message: 'Invalid time format'
        });
      }
      if (!hasValidEndTime) {
        errors.push({
          slotIndex: index,
          field: 'endTime',
          message: 'Invalid time format'
        });
      }
      
      // Only check order and overlaps if both times are valid (avoid noisy errors)
      if (hasValidStartTime && hasValidEndTime) {
        // Validate start < end
        if (slot.startTime >= slot.endTime) {
          errors.push({
            slotIndex: index,
            field: 'endTime',
            message: 'End time must be after start time'
          });
        }
        
        // Check for overlap with previous slot only (avoids duplicate messages)
        if (index > 0) {
          const prevSlot = timeSlots[index - 1];
          if (normalizeTime(prevSlot.endTime) && slot.startTime < prevSlot.endTime) {
            errors.push({
              slotIndex: index,
              field: 'startTime',
              message: 'Overlaps with previous period'
            });
          }
        }
      }
    });
    
    return {
      errors,
      hasErrors: errors.length > 0
    };
  };

  // Get validation state for current structure
  const validationState = useMemo(() => {
    return validateAllTimeSlots(structure.timeSlots || []);
  }, [structure.timeSlots]);

  // Update parent validation state via useEffect (no state updates during render)
  useEffect(() => {
    onValidationChange?.(validationState.hasErrors);
  }, [validationState.hasErrors, onValidationChange]);

  // Check if a specific slot has errors
  const getSlotErrors = (slotIndex: number, field: 'startTime' | 'endTime') => {
    return validationState.errors.filter(error => 
      error.slotIndex === slotIndex && error.field === field
    );
  };

  // Add new time slot with smart time calculation and normalization
  const addTimeSlot = () => {
    const timeSlots = structure.timeSlots || [];
    
    // Block adding if current validation has errors
    if (validationState.hasErrors) {
      toast({
        title: "Cannot Add Period",
        description: "Please fix existing validation errors before adding new periods.",
        variant: "destructive",
      });
      return;
    }
    
    const newPeriod = timeSlots.length + 1;
    const lastSlot = timeSlots[timeSlots.length - 1];
    
    // Safe default start time with validation
    let newStartTime = "09:00";
    if (lastSlot?.endTime) {
      const normalizedEndTime = normalizeTime(lastSlot.endTime);
      if (normalizedEndTime) {
        newStartTime = normalizedEndTime;
      }
    }
    
    // Calculate smart end time (45 minutes after start time) with normalization
    const newEndTime = addMinutesToTime(newStartTime, 45);
    
    onStructureChange({
      ...structure,
      timeSlots: [
        ...timeSlots,
        { period: newPeriod, startTime: newStartTime, endTime: newEndTime }
      ],
      periodsPerDay: (structure.periodsPerDay || 0) + 1,
    });
  };

  // Remove time slot
  const removeTimeSlot = (index: number) => {
    const newTimeSlots = (structure.timeSlots || []).filter((_, i) => i !== index);
    // Renumber periods
    const renumberedSlots = newTimeSlots.map((slot, i) => ({
      ...slot,
      period: i + 1
    }));
    
    onStructureChange({
      ...structure,
      timeSlots: renumberedSlots,
      periodsPerDay: renumberedSlots.length,
    });
  };

  // Update time slot with normalization
  const updateTimeSlot = (index: number, field: keyof TimeSlot, value: string | boolean) => {
    const currentTimeSlots = structure.timeSlots || [];
    let processedValue = value;
    
    // Normalize time fields
    if (field === 'startTime' || field === 'endTime') {
      const normalized = normalizeTime(value as string);
      if (normalized) {
        processedValue = normalized;
      }
    }
    
    onStructureChange({
      ...structure,
      timeSlots: currentTimeSlots.map((slot, i) => 
        i === index ? { ...slot, [field]: processedValue } : slot
      ),
    });
  };

  // Toggle break status for a period
  const toggleBreakStatus = (index: number) => {
    if (!editMode) return;
    const slot = structure.timeSlots?.[index];
    if (slot) {
      updateTimeSlot(index, 'isBreak', !slot.isBreak);
    }
  };

  // Add working day
  const addWorkingDay = (day: string) => {
    const workingDays = structure.workingDays || [];
    if (!workingDays.includes(day)) {
      onStructureChange({
        ...structure,
        workingDays: [...workingDays, day],
      });
    }
  };

  // Remove working day
  const removeWorkingDay = (day: string) => {
    onStructureChange({
      ...structure,
      workingDays: (structure.workingDays || []).filter(d => d !== day),
    });
  };

  // Start editing a cell
  const startEditing = (type: 'time' | 'period', slotIndex: number, field?: 'startTime' | 'endTime') => {
    if (!editMode) return;
    
    const slot = structure.timeSlots?.[slotIndex];
    if (!slot) return;

    if (type === 'time' && field) {
      setTempValue(slot[field]);
      setEditingCell({ type, slotIndex, field });
    }
  };

  // Save edit
  const saveEdit = () => {
    if (!editingCell) return;

    if (editingCell.type === 'time' && editingCell.field) {
      updateTimeSlot(editingCell.slotIndex, editingCell.field, tempValue);
    }

    setEditingCell(null);
    setTempValue("");
  };

  // Cancel edit
  const cancelEdit = () => {
    setEditingCell(null);
    setTempValue("");
  };

  // Handle key press in edit mode
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  // Get non-working days for dropdown
  const nonWorkingDays = allDays.filter(day => !(structure.workingDays || []).includes(day));

  return (
    <div className="w-full space-y-4">
      {/* Grid Controls */}
      {editMode && (
        <div className="flex flex-wrap items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
          <Button
            size="sm"
            variant="outline"
            onClick={addTimeSlot}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Period
          </Button>
          
          {nonWorkingDays.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Add Day
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {nonWorkingDays.map((day) => (
                  <DropdownMenuItem key={day} onClick={() => addWorkingDay(day)}>
                    <span className="capitalize">{day}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          <div className="text-sm text-blue-700 dark:text-blue-300 font-medium">
            💡 Click on time cells to edit, click on period cells to toggle breaks, use dropdown menus for more options
          </div>
        </div>
      )}

      {/* Interactive Grid - Redesigned */}
      <Card className="shadow-lg border-blue-100 dark:border-blue-700">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-base">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg">
                <Clock className="h-4 w-4 text-white" />
              </div>
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent font-bold">
                Timetable Structure Grid
              </span>
            </span>
            {editMode && (
              <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-600 font-medium">
                <i className="fas fa-edit mr-1 text-xs"></i> Edit Mode
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border-b-2 border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider min-w-[70px]">
                    Period
                  </th>
                  <th className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border-b-2 border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider min-w-[160px]">
                    Time
                  </th>
                  {sortWorkingDays(structure.workingDays || []).map((day) => (
                    <th key={day} className="bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 border-b-2 border-blue-700 px-2 py-2 text-center text-xs font-bold text-white uppercase tracking-wide min-w-[100px] relative group">
                      <div className="flex items-center justify-center gap-1">
                        <span>{day.substring(0, 3)}</span>
                        {editMode && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-white hover:bg-white/20 transition-opacity"
                              >
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem 
                                onClick={() => removeWorkingDay(day)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-3 w-3 mr-2" />
                                Remove {day}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(structure.timeSlots || []).map((slot, index) => (
                  <tr key={index} className={`border-b border-slate-100 dark:border-slate-700 transition-colors ${slot.isBreak ? 'bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 hover:from-orange-100 hover:to-amber-100 dark:hover:from-orange-900/30 dark:hover:to-amber-900/30' : 'bg-white dark:bg-gray-900 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    {/* Period Column */}
                    <td className="px-3 py-2 relative group border-r border-slate-100 dark:border-slate-700">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => toggleBreakStatus(index)}
                          disabled={!editMode}
                          className={`text-xs font-bold text-left flex-1 ${
                            editMode ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded px-2 py-1 transition-colors' : ''
                          } ${slot.isBreak ? 'text-orange-600 dark:text-orange-400' : 'text-slate-700 dark:text-slate-300'}`}
                        >
                          {slot.isBreak ? 'Break' : `Period ${getTeachingPeriodNumber(slot.period)}`}
                        </button>
                        {editMode && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeTimeSlot(index)}
                            className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-red-600 hover:bg-red-50 transition-all"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </td>

                    {/* Time Column */}
                    <td className="px-3 py-2 border-r border-slate-100 dark:border-slate-700">
                      <div className="flex items-center gap-1.5 text-xs">
                        {/* Start Time */}
                        {editingCell?.type === 'time' && 
                         editingCell.slotIndex === index && 
                         editingCell.field === 'startTime' ? (
                          <div className="relative">
                            <Input
                              ref={inputRef}
                              type="time"
                              value={tempValue}
                              onChange={(e) => setTempValue(e.target.value)}
                              onBlur={saveEdit}
                              onKeyDown={handleKeyPress}
                              className={`text-xs h-6 w-20 ${
                                getSlotErrors(index, 'startTime').length > 0 
                                  ? 'border-red-500 bg-red-50' 
                                  : ''
                              }`}
                            />
                            {getSlotErrors(index, 'startTime').length > 0 && (
                              <div className="absolute top-7 left-0 z-10 bg-red-600 text-white text-xs rounded px-1 py-0.5 whitespace-nowrap">
                                {getSlotErrors(index, 'startTime')[0].message}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="relative">
                            <button
                              onClick={() => startEditing('time', index, 'startTime')}
                              disabled={!editMode}
                              className={`text-left ${
                                editMode ? 'cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded px-1' : ''
                              } ${
                                getSlotErrors(index, 'startTime').length > 0 
                                  ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded px-1' 
                                  : ''
                              }`}
                            >
                              {formatTime12Hour(slot.startTime)}
                              {getSlotErrors(index, 'startTime').length > 0 && (
                                <AlertTriangle className="inline h-3 w-3 ml-1" />
                              )}
                            </button>
                            {getSlotErrors(index, 'startTime').length > 0 && (
                              <div className="absolute top-6 left-0 z-10 bg-red-600 text-white text-xs rounded px-1 py-0.5 whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity">
                                {getSlotErrors(index, 'startTime')[0].message}
                              </div>
                            )}
                          </div>
                        )}
                        
                        <span>-</span>
                        
                        {/* End Time */}
                        {editingCell?.type === 'time' && 
                         editingCell.slotIndex === index && 
                         editingCell.field === 'endTime' ? (
                          <div className="relative">
                            <Input
                              ref={inputRef}
                              type="time"
                              value={tempValue}
                              onChange={(e) => setTempValue(e.target.value)}
                              onBlur={saveEdit}
                              onKeyDown={handleKeyPress}
                              className={`text-xs h-6 w-20 ${
                                getSlotErrors(index, 'endTime').length > 0 
                                  ? 'border-red-500 bg-red-50' 
                                  : ''
                              }`}
                            />
                            {getSlotErrors(index, 'endTime').length > 0 && (
                              <div className="absolute top-7 left-0 z-10 bg-red-600 text-white text-xs rounded px-1 py-0.5 whitespace-nowrap">
                                {getSlotErrors(index, 'endTime')[0].message}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="relative">
                            <button
                              onClick={() => startEditing('time', index, 'endTime')}
                              disabled={!editMode}
                              className={`text-left ${
                                editMode ? 'cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded px-1' : ''
                              } ${
                                getSlotErrors(index, 'endTime').length > 0 
                                  ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded px-1' 
                                  : ''
                              }`}
                            >
                              {formatTime12Hour(slot.endTime)}
                              {getSlotErrors(index, 'endTime').length > 0 && (
                                <AlertTriangle className="inline h-3 w-3 ml-1" />
                              )}
                            </button>
                            {getSlotErrors(index, 'endTime').length > 0 && (
                              <div className="absolute top-6 left-0 z-10 bg-red-600 text-white text-xs rounded px-1 py-0.5 whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity">
                                {getSlotErrors(index, 'endTime')[0].message}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Day Columns */}
                    {sortWorkingDays(structure.workingDays || []).map((day) => (
                      <td key={day} className="px-2 py-2 text-center border-r border-slate-100 dark:border-slate-700 last:border-r-0">
                        {slot.isBreak ? (
                          <div className="text-orange-700 dark:text-orange-300 font-bold text-[10px] bg-gradient-to-r from-orange-100 to-amber-100 dark:from-orange-900/40 dark:to-amber-900/40 rounded-md py-1 px-1.5 inline-block shadow-sm border border-orange-200 dark:border-orange-700">
                            BREAK
                          </div>
                        ) : (
                          <div className="h-7 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/40 dark:to-indigo-900/40 rounded-md flex items-center justify-center text-[10px] font-bold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 shadow-sm hover:shadow-md transition-shadow">
                            Period {getTeachingPeriodNumber(slot.period)}
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Grid Summary - Redesigned */}
          <div className="mt-0 p-3 bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-800 dark:to-blue-900/30 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-4 flex-wrap text-xs">
              <div className="flex items-center gap-1.5">
                <i className="fas fa-chalkboard-teacher text-blue-600 dark:text-blue-400"></i>
                <span className="text-slate-600 dark:text-slate-300 font-medium">Teaching Periods per Day:</span>
                <Badge variant="outline" className="font-bold text-[10px] h-5 bg-white dark:bg-gray-800">
                  {(structure.timeSlots || []).filter(slot => !slot.isBreak).length}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5">
                <i className="fas fa-calendar-week text-indigo-600 dark:text-indigo-400"></i>
                <span className="text-slate-600 dark:text-slate-300 font-medium">Working Days:</span>
                <Badge variant="outline" className="font-bold text-[10px] h-5 bg-white dark:bg-gray-800">
                  {(structure.workingDays || []).length}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5">
                <i className="fas fa-chart-line text-purple-600 dark:text-purple-400"></i>
                <span className="text-slate-600 dark:text-slate-300 font-medium">Teaching Periods per Week:</span>
                <Badge className="font-bold text-[10px] h-5 bg-gradient-to-r from-blue-600 to-indigo-600">
                  {((structure.timeSlots || []).filter(slot => !slot.isBreak).length * (structure.workingDays || []).length)}
                </Badge>
              </div>
            </div>
            
            {/* School Hours - Calculated from actual times */}
            {(structure.timeSlots || []).length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 dark:text-gray-400">School Starts:</span>
                    <span className="font-semibold text-green-700 dark:text-green-400">
                      {(() => {
                        const times = (structure.timeSlots || []).map(slot => slot.startTime);
                        const earliestTime = times.length > 0 ? Math.min(...times.map(t => {
                          const [h, m] = t.split(':').map(Number);
                          return h * 60 + m;
                        })) : 0;
                        const hours = Math.floor(earliestTime / 60);
                        const minutes = earliestTime % 60;
                        const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                        return formatTime12Hour(timeStr);
                      })()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 dark:text-gray-400">School Ends:</span>
                    <span className="font-semibold text-red-700 dark:text-red-400">
                      {(() => {
                        const times = (structure.timeSlots || []).map(slot => slot.endTime);
                        const latestTime = times.length > 0 ? Math.max(...times.map(t => {
                          const [h, m] = t.split(':').map(Number);
                          return h * 60 + m;
                        })) : 0;
                        const hours = Math.floor(latestTime / 60);
                        const minutes = latestTime % 60;
                        const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                        return formatTime12Hour(timeStr);
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}