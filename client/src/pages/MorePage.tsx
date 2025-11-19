import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Calculator, Sparkles, Users, Wallet, Package, UserPlus, Building, FileText, Receipt, Calendar, Search, CreditCard, Award, Truck, GraduationCap, Shield, IndianRupee } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function MorePage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const addOnFeatures = [
    {
      id: "permissions",
      path: "/permissions",
      icon: Shield,
      title: "Role Permissions",
      description: "Configure custom roles and module-based permissions for staff members",
      color: "from-blue-600 to-indigo-700",
      roles: ["admin"]
    },
    {
      id: "user-management",
      path: "/user-management",
      icon: Users,
      title: "User Management",
      description: "Manage login credentials for students, teachers, and parents",
      color: "from-indigo-500 to-blue-600",
      roles: ["admin"]
    },
    {
      id: "teacher-planner",
      path: "/teacher-planner",
      icon: Calculator,
      title: "AI Teacher Planner",
      description: "Intelligent staffing optimization tool with AI-powered insights for teacher requirements",
      color: "from-blue-500 to-purple-600",
      roles: ["admin"]
    },
    {
      id: "payroll",
      path: "/payroll",
      icon: Wallet,
      title: "Payroll Module",
      description: "Create and manage salary for teachers and staff with automated calculations",
      color: "from-emerald-500 to-teal-600",
      roles: ["admin"]
    },
    {
      id: "transport",
      path: "/transport",
      icon: Truck,
      title: "Transport",
      description: "Manage transport routes, vehicles, stops, and student assignments",
      color: "from-indigo-500 to-purple-600",
      roles: ["admin"]
    },
    {
      id: "admission",
      path: "/admission",
      icon: UserPlus,
      title: "Student Online Admission",
      description: "Streamline student admissions with online application and enrollment process",
      color: "from-cyan-500 to-blue-600",
      roles: ["admin"]
    },
    {
      id: "hostel",
      path: "/hostel",
      icon: Building,
      title: "Hostel Management",
      description: "Manage hostel rooms, allocations, and student residential facilities",
      color: "from-violet-500 to-purple-600",
      roles: ["admin"]
    },
    {
      id: "exam",
      path: "/exam",
      icon: FileText,
      title: "Exam Module",
      description: "Create exams, manage results, and generate report cards with detailed analytics",
      color: "from-pink-500 to-rose-600",
      roles: ["admin"]
    },
    {
      id: "expense",
      path: "/expense",
      icon: Receipt,
      title: "Expense Management",
      description: "Track and manage school expenses, budgets, and financial records",
      color: "from-amber-500 to-orange-600",
      roles: ["admin"]
    },
    {
      id: "calendar",
      path: "/calendar",
      icon: Calendar,
      title: "School Calendar",
      description: "Manage academic calendar with holidays, events, and important dates",
      color: "from-lime-500 to-green-600",
      roles: ["admin"]
    },
    {
      id: "id-cards",
      path: "/id-cards",
      icon: CreditCard,
      title: "ID Cards",
      description: "Generate ID cards for both teachers and students with customizable templates",
      color: "from-sky-500 to-blue-600",
      roles: ["admin"]
    },
    {
      id: "certification",
      path: "/certification",
      icon: Award,
      title: "Certification",
      description: "Generate certificates for different events and select design templates or upload one template yourself",
      color: "from-yellow-500 to-amber-600",
      roles: ["admin"]
    },
    {
      id: "inventory",
      path: "/inventory",
      icon: Package,
      title: "Inventory Management",
      description: "Track and manage school assets, supplies, and equipment inventory",
      color: "from-orange-500 to-red-600",
      roles: ["admin"]
    },
    {
      id: "e-learning",
      path: "/e-learning",
      icon: GraduationCap,
      title: "E-Learning",
      description: "Online learning platform for students with courses, assignments, and resources",
      color: "from-purple-500 to-indigo-600",
      roles: ["admin", "teacher", "student"]
    },
    {
      id: "my-salary",
      path: "/my-salary",
      icon: IndianRupee,
      title: "My Salary",
      description: "View your salary breakdown, payment history, and download salary receipts",
      color: "from-green-500 to-emerald-600",
      roles: ["teacher"]
    },
    {
      id: "class-user-management",
      path: "/class-user-management",
      icon: Users,
      title: "Student Credentials",
      description: "Generate and manage login credentials for your class students and parents",
      color: "from-blue-500 to-cyan-600",
      roles: ["teacher"]
    },
  ];

  const availableFeatures = addOnFeatures.filter(feature => 
    feature.roles.includes(user?.role || "")
  );

  // Filter features based on search query
  const filteredFeatures = availableFeatures.filter(feature => {
    const query = searchQuery.toLowerCase();
    return (
      feature.title.toLowerCase().includes(query) ||
      feature.description.toLowerCase().includes(query)
    );
  });

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-2">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-600" />
            More Features
          </h1>
          <p className="text-sm text-muted-foreground">
            Explore add-on features and advanced tools for your school
          </p>
        </div>
        
        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search features..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 border-2 border-gray-300 shadow-md focus:border-blue-500 focus:shadow-lg transition-all bg-white rounded-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        {filteredFeatures.map((feature) => {
          const Icon = feature.icon;
          return (
            <Link key={feature.id} href={feature.path}>
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group">
                <CardHeader className="pb-2 p-4">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-r ${feature.color} flex items-center justify-center mb-2 group-hover:scale-110 transition-transform`}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <CardTitle className="text-sm font-semibold">{feature.title}</CardTitle>
                  <CardDescription className="text-xs leading-snug">
                    {feature.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 p-4">
                  <div className="flex items-center text-xs text-primary font-medium group-hover:gap-2 transition-all">
                    <span>Learn more</span>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">→</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {availableFeatures.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                No additional features available for your role at this time.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
      
      {availableFeatures.length > 0 && filteredFeatures.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground font-medium mb-1">
                No features found
              </p>
              <p className="text-sm text-muted-foreground">
                Try searching with different keywords
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
