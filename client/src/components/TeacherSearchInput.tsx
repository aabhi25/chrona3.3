import { useState, useMemo, useRef, useEffect } from "react";
import { Search, User, AlertTriangle, X } from "lucide-react";
import { Input } from "./ui/input";

interface Teacher {
  id: string;
  name: string;
  email?: string | null;
  employeeId?: string;
  schoolIdNumber?: string | null;
  profilePictureUrl?: string | null;
}

interface TeacherAnalytics {
  teacherId: string;
  isOverloaded?: boolean;
}

interface TeacherSearchInputProps {
  teachers: Teacher[];
  analytics?: { teachers?: TeacherAnalytics[] };
  selectedTeacherId?: string;
  onTeacherSelect: (teacherId: string | null) => void;
  placeholder?: string;
  className?: string;
}

export default function TeacherSearchInput({ 
  teachers, 
  analytics, 
  selectedTeacherId, 
  onTeacherSelect, 
  placeholder = "Search for a teacher...", 
  className = "" 
}: TeacherSearchInputProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Get the selected teacher's name for display
  const selectedTeacher = teachers.find(t => t.id === selectedTeacherId);
  
  // Filter teachers based on search query (show suggestions after 2 characters)
  const filteredTeachers = useMemo(() => {
    if (searchQuery.length < 2) return [];
    
    const query = searchQuery.toLowerCase().trim();
    return teachers.filter(teacher => 
      teacher.name.toLowerCase().includes(query) || 
      (teacher.email && teacher.email.toLowerCase().includes(query)) ||
      (teacher.employeeId && teacher.employeeId.toLowerCase().includes(query)) ||
      (teacher.schoolIdNumber && teacher.schoolIdNumber.toLowerCase().includes(query))
    ).slice(0, 8); // Limit to 8 results
  }, [searchQuery, teachers]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle teacher selection
  const handleTeacherSelect = (teacher: Teacher) => {
    onTeacherSelect(teacher.id);
    setSearchQuery("");
    setShowDropdown(false);
  };

  // Handle search input change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setShowDropdown(value.length >= 2);
  };

  // Handle input focus
  const handleFocus = () => {
    if (searchQuery.length >= 2) {
      setShowDropdown(true);
    }
  };

  // Clear selection
  const handleClear = () => {
    onTeacherSelect(null);
    setSearchQuery("");
    setShowDropdown(false);
  };

  return (
    <div className={`relative ${className}`} ref={searchRef}>
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder={selectedTeacher ? "" : placeholder}
        value={searchQuery}
        onChange={(e) => handleSearchChange(e.target.value)}
        onFocus={handleFocus}
        className="pl-10"
      />
      
      {/* Selected Teacher Indicator */}
      {selectedTeacher && !searchQuery && (
        <div className="absolute inset-0 pl-10 pr-10 flex items-center pointer-events-none">
          <span className="text-gray-900 font-medium truncate">{selectedTeacher.name}</span>
        </div>
      )}
      
      {/* Clear Selection Button */}
      {selectedTeacher && !searchQuery && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors"
          type="button"
        >
          <X className="h-4 w-4 text-gray-500 hover:text-gray-700" />
        </button>
      )}
      
      {/* Search Results Dropdown */}
      {showDropdown && filteredTeachers.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          {filteredTeachers.map((teacher) => {
            const teacherAnalytics = analytics?.teachers?.find((t: any) => t.teacherId === teacher.id);
            return (
              <div
                key={teacher.id}
                className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                onClick={() => handleTeacherSelect(teacher)}
              >
                {/* Profile Picture */}
                <div className="mr-3 flex-shrink-0">
                  {teacher.profilePictureUrl ? (
                    <img
                      src={teacher.profilePictureUrl}
                      alt={teacher.name}
                      className="h-10 w-10 rounded-full object-cover border-2 border-gray-200"
                      onError={(e) => {
                        // Fallback to default avatar if image fails to load
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center ${teacher.profilePictureUrl ? 'hidden' : ''}`}>
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
                
                {/* Teacher Information */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-900 flex items-center gap-2">
                    {teacher.name}
                    {teacherAnalytics?.isOverloaded && (
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                    )}
                  </div>
                  
                  {/* School/Employee ID */}
                  <div className="text-xs text-gray-600 truncate">
                    {teacher.schoolIdNumber ? `School/Emp ID: ${teacher.schoolIdNumber}` : (teacher.employeeId ? `Emp: ${teacher.employeeId}` : 'No ID')}
                  </div>
                  
                  {/* Email */}
                  {teacher.email && (
                    <div className="text-xs text-gray-500 truncate">
                      {teacher.email}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* No results state */}
      {showDropdown && searchQuery.length >= 2 && filteredTeachers.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-4 text-center text-gray-500 text-sm">
          No teachers found for "{searchQuery}"
        </div>
      )}
    </div>
  );
}