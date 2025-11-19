import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Settings, Shield, Save, RefreshCw, Info, Check, X, Plus, ChevronDown, ChevronUp, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface SystemModule {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  icon: string;
  isActive: boolean;
  sortOrder: number;
}

interface ModulePermission {
  read: boolean;
  write: boolean;
  delete: boolean;
  export: boolean;
}

interface RolePermission {
  id: string;
  schoolId: string;
  role: string;
  customRoleId?: string;
  moduleId: string;
  permissions: ModulePermission;
  isActive: boolean;
}

interface CustomRole {
  id: string;
  schoolId: string;
  name: string;
  description: string;
  color: string;
  basedOnRole: string;
  isActive: boolean;
}

const SYSTEM_ROLES = [
  { value: 'admin', label: 'School Admin', description: 'Full access to school management', isCustom: false },
  { value: 'teacher', label: 'Teacher', description: 'Access to teaching and class management', isCustom: false },
  { value: 'student', label: 'Student', description: 'Access to learning and personal info', isCustom: false },
  { value: 'parent', label: 'Parent', description: 'Access to child information and communication', isCustom: false }
];

const PERMISSION_TYPES = [
  { key: 'read' as const, label: 'Read', description: 'View information' },
  { key: 'write' as const, label: 'Write', description: 'Create and edit' },
  { key: 'delete' as const, label: 'Delete', description: 'Remove data' },
  { key: 'export' as const, label: 'Export', description: 'Download data' }
];

export default function RolePermissionsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedCustomRoleId, setSelectedCustomRoleId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [localPermissions, setLocalPermissions] = useState<Record<string, ModulePermission>>({});
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const moduleRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Fetch system modules
  const { data: modules = [], isLoading: modulesLoading } = useQuery<SystemModule[]>({
    queryKey: ['modules'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/modules');
      return res.json();
    }
  });

  // Fetch custom roles
  const { data: customRoles = [], refetch: refetchCustomRoles } = useQuery<CustomRole[]>({
    queryKey: ['customRoles'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/custom-roles');
      return res.json();
    }
  });

  // Fetch role permissions (NO CACHING - always fetch fresh data)
  const { data: rolePermissions = [], isLoading: permissionsLoading, refetch } = useQuery<RolePermission[]>({
    queryKey: ['permissions', user?.schoolId, selectedRole, selectedCustomRoleId],
    queryFn: async () => {
      const url = selectedCustomRoleId 
        ? `/api/permissions/${user?.schoolId}?customRoleId=${selectedCustomRoleId}`
        : `/api/permissions/${user?.schoolId}?role=${selectedRole}`;
      const res = await apiRequest('GET', url);
      const data = await res.json();
      
      // Initialize local permissions
      const permMap: Record<string, ModulePermission> = {};
      data.forEach((p: RolePermission) => {
        permMap[p.moduleId] = p.permissions;
      });
      setLocalPermissions(permMap);
      setHasChanges(false);
      
      return data;
    },
    enabled: !!user?.schoolId && (!!selectedRole || !!selectedCustomRoleId),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false
  });

  // Save permission mutation
  const savePermissionMutation = useMutation({
    mutationFn: async ({ moduleId, permissions }: { moduleId: string; permissions: ModulePermission }) => {
      const payload: any = {
        schoolId: user?.schoolId,
        moduleId,
        permissions
      };
      
      if (selectedCustomRoleId) {
        payload.customRoleId = selectedCustomRoleId;
      } else {
        payload.role = selectedRole;
      }
      
      const res = await apiRequest('POST', '/api/permissions', payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
    }
  });

  // Create custom role mutation
  const createCustomRoleMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      const res = await apiRequest('POST', '/api/custom-roles', data);
      return res.json();
    },
    onSuccess: (newRole: CustomRole) => {
      queryClient.invalidateQueries({ queryKey: ['customRoles'] });
      refetchCustomRoles();
      setCreateDialogOpen(false);
      setNewRoleName('');
      setNewRoleDescription('');
      
      // Select the newly created role
      setSelectedCustomRoleId(newRole.id);
      setSelectedRole('');
      
      // Clear local permissions for the new role (starts with no permissions)
      setLocalPermissions({});
      setHasChanges(false);
      
      toast({
        title: "Custom role created",
        description: `${newRole.name} has been created successfully. You can now configure its permissions.`,
      });
    }
  });

  // Save all changes
  const handleSaveAll = async () => {
    try {
      const promises = Object.entries(localPermissions).map(([moduleId, permissions]) => {
        return savePermissionMutation.mutateAsync({ moduleId, permissions });
      });

      await Promise.all(promises);

      const roleName = selectedCustomRoleId 
        ? customRoles.find(r => r.id === selectedCustomRoleId)?.name 
        : selectedRole;
      
      toast({
        title: "Permissions saved",
        description: `Successfully updated permissions for ${roleName}.`,
      });

      setHasChanges(false);
      refetch();
    } catch (error) {
      toast({
        title: "Error saving permissions",
        description: "Failed to save some permissions. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Toggle permission
  const togglePermission = (moduleId: string, permissionType: keyof ModulePermission) => {
    setLocalPermissions(prev => ({
      ...prev,
      [moduleId]: {
        ...prev[moduleId] || { read: false, write: false, delete: false, export: false },
        [permissionType]: !prev[moduleId]?.[permissionType]
      }
    }));
    setHasChanges(true);
  };

  // Get permission value
  const getPermissionValue = (moduleId: string, permissionType: keyof ModulePermission): boolean => {
    return localPermissions[moduleId]?.[permissionType] || false;
  };

  // Copy permissions from another role
  const copyFromRole = async (sourceRole: string) => {
    try {
      const res = await apiRequest('GET', `/api/permissions/${user?.schoolId}?role=${sourceRole}`);
      const sourcePermissions: RolePermission[] = await res.json();
      
      const permMap: Record<string, ModulePermission> = {};
      sourcePermissions.forEach((p: RolePermission) => {
        permMap[p.moduleId] = { ...p.permissions };
      });
      
      setLocalPermissions(permMap);
      setHasChanges(true);

      toast({
        title: "Permissions copied",
        description: `Copied permissions from ${sourceRole} role. Don't forget to save!`,
      });
    } catch (error) {
      toast({
        title: "Error copying permissions",
        description: "Failed to copy permissions. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Auto-select first custom role on load
  useEffect(() => {
    if (!isInitialized && customRoles.length > 0 && !selectedCustomRoleId) {
      setSelectedCustomRoleId(customRoles[0].id);
      setIsInitialized(true);
    }
  }, [customRoles, selectedCustomRoleId, isInitialized]);

  // Group modules by category
  const modulesByCategory = modules.reduce((acc, module) => {
    if (!acc[module.category]) {
      acc[module.category] = [];
    }
    acc[module.category].push(module);
    return acc;
  }, {} as Record<string, SystemModule[]>);

  const categories = Object.keys(modulesByCategory);

  // Category color mapping for gradients
  const categoryColors: Record<string, { bg: string; border: string; icon: string }> = {
    'Academic': { bg: 'from-blue-50 to-white', border: 'border-blue-200', icon: 'from-blue-500 to-blue-600' },
    'Attendance': { bg: 'from-green-50 to-white', border: 'border-green-200', icon: 'from-green-500 to-green-600' },
    'Finance': { bg: 'from-orange-50 to-white', border: 'border-orange-200', icon: 'from-orange-500 to-orange-600' },
    'Communication': { bg: 'from-purple-50 to-white', border: 'border-purple-200', icon: 'from-purple-500 to-purple-600' },
    'HR & Management': { bg: 'from-indigo-50 to-white', border: 'border-indigo-200', icon: 'from-indigo-500 to-indigo-600' },
    'AI & Analytics': { bg: 'from-cyan-50 to-white', border: 'border-cyan-200', icon: 'from-cyan-500 to-cyan-600' },
    'Administration': { bg: 'from-red-50 to-white', border: 'border-red-200', icon: 'from-red-500 to-red-600' },
    'Settings': { bg: 'from-slate-50 to-white', border: 'border-slate-200', icon: 'from-slate-500 to-slate-600' },
  };

  // Get colors for a category, with fallback
  const getCategoryColors = (category: string) => {
    return categoryColors[category] || { bg: 'from-gray-50 to-white', border: 'border-gray-200', icon: 'from-gray-500 to-gray-600' };
  };

  // Check if category has any assigned permissions
  const categoryHasPermissions = (categoryModules: SystemModule[]) => {
    return categoryModules.some(module => {
      const perms = localPermissions[module.id];
      return perms && (perms.read || perms.write || perms.delete || perms.export);
    });
  };

  // Get background color based on permissions
  const getCategoryBackground = (categoryModules: SystemModule[]) => {
    if (categoryHasPermissions(categoryModules)) {
      return 'from-green-50 to-white'; // Light green if has permissions
    }
    return 'from-white to-white'; // White if no permissions
  };

  // Toggle category open/closed
  const toggleCategory = (category: string) => {
    setOpenCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  // Search filtered modules
  const filteredModules = modules.filter(module => 
    module.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    module.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    module.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Navigate to module
  const navigateToModule = (module: SystemModule) => {
    // Open the category
    setOpenCategories(prev => {
      const newSet = new Set(prev);
      newSet.add(module.category);
      return newSet;
    });

    // Scroll to module after a brief delay to allow category to expand
    setTimeout(() => {
      const moduleElement = moduleRefs.current[module.id];
      if (moduleElement) {
        moduleElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Highlight the module briefly
        moduleElement.style.backgroundColor = '#fef08a';
        setTimeout(() => {
          moduleElement.style.backgroundColor = '';
        }, 2000);
      }
    }, 100);

    // Clear search
    setSearchQuery('');
    setSearchFocused(false);
  };

  const isLoading = modulesLoading || permissionsLoading;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="flex items-center justify-between p-6">
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Role & Module Permissions</h1>
              <p className="text-sm text-muted-foreground">
                Configure which modules each role can access
              </p>
            </div>
          </div>
          <Button
            onClick={handleSaveAll}
            disabled={!hasChanges || savePermissionMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {savePermissionMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        {/* Role Selector */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Select Role</CardTitle>
            <CardDescription>
              Choose a role to configure its module access permissions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Select value={selectedCustomRoleId || ''} onValueChange={(value) => {
                if (hasChanges && !confirm('You have unsaved changes. Switching roles will discard them. Continue?')) return;
                
                // Clear all cache and state
                queryClient.removeQueries({ queryKey: ['permissions'] });
                setLocalPermissions({});
                setSelectedCustomRoleId(value);
                setSelectedRole('');
                setHasChanges(false);
              }} disabled={customRoles.length === 0}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder={customRoles.length === 0 ? "No custom roles yet" : "Select a custom role"}>
                    {selectedCustomRoleId && customRoles.find(r => r.id === selectedCustomRoleId) ? (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: customRoles.find(r => r.id === selectedCustomRoleId)?.color }}></div>
                        {customRoles.find(r => r.id === selectedCustomRoleId)?.name}
                      </div>
                    ) : null}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {customRoles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: role.color }}></div>
                        {role.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex-1">
                <p className="text-sm text-muted-foreground">
                  {selectedCustomRoleId && customRoles.find(r => r.id === selectedCustomRoleId)
                    ? customRoles.find(r => r.id === selectedCustomRoleId)?.description
                    : customRoles.length === 0 
                      ? 'Create a custom role to configure module permissions for specific staff members'
                      : 'Select a custom role to configure its permissions'}
                </p>
              </div>

              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Role
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create Custom Role</DialogTitle>
                    <DialogDescription>
                      Create a new role for specific responsibilities (e.g., "Fee Manager", "Transport Coordinator")
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="roleName" className="text-sm">Role Name *</Label>
                      <Input 
                        id="roleName" 
                        placeholder="e.g., Fee Manager" 
                        value={newRoleName} 
                        onChange={(e) => setNewRoleName(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="roleDescription" className="text-sm">Description</Label>
                      <Textarea 
                        id="roleDescription" 
                        placeholder="Brief description of this role's responsibilities" 
                        value={newRoleDescription} 
                        onChange={(e) => setNewRoleDescription(e.target.value)} 
                        rows={2}
                        className="text-sm resize-none"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={() => {
                      if (!newRoleName.trim()) {
                        toast({ title: "Name required", description: "Please enter a role name", variant: "destructive" });
                        return;
                      }
                      createCustomRoleMutation.mutate({ name: newRoleName, description: newRoleDescription });
                    }} disabled={createCustomRoleMutation.isPending}>
                      {createCustomRoleMutation.isPending ? 'Creating...' : 'Create Role'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {hasChanges && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  You have unsaved changes. Don't forget to click "Save Changes" to apply them.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Permission Matrix */}
        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Loading permissions...</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Module Search */}
            <div className="flex justify-end mb-4">
              <div className="relative w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search modules..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                  className="pl-10 h-9 border-2 border-slate-300 shadow-md bg-white focus:border-primary focus:shadow-lg transition-all"
                />
                
                {/* Search Results Dropdown */}
                {searchFocused && searchQuery && filteredModules.length > 0 && (
                  <Card className="absolute top-full mt-1 w-full z-50 max-h-80 overflow-y-auto shadow-lg">
                    <CardContent className="p-2">
                      {filteredModules.slice(0, 10).map((module) => (
                        <div
                          key={module.id}
                          onClick={() => navigateToModule(module)}
                          className="p-3 hover:bg-accent rounded-md cursor-pointer transition-colors"
                        >
                          <div className="font-medium text-sm">{module.displayName}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {module.category} • {module.description}
                          </div>
                        </div>
                      ))}
                      {filteredModules.length > 10 && (
                        <div className="text-xs text-center text-muted-foreground py-2 border-t mt-2">
                          +{filteredModules.length - 10} more results
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
                
                {/* No Results */}
                {searchFocused && searchQuery && filteredModules.length === 0 && (
                  <Card className="absolute top-full mt-1 w-full z-50 shadow-lg">
                    <CardContent className="p-4 text-center text-sm text-muted-foreground">
                      No modules found for "{searchQuery}"
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {Object.entries(modulesByCategory)
                .sort(([categoryA, modulesA], [categoryB, modulesB]) => {
                  // Sort categories with permissions to the top
                  const aHasPerms = categoryHasPermissions(modulesA);
                  const bHasPerms = categoryHasPermissions(modulesB);
                  
                  if (aHasPerms && !bHasPerms) return -1;
                  if (!aHasPerms && bHasPerms) return 1;
                  
                  // If both have or don't have permissions, sort alphabetically
                  return categoryA.localeCompare(categoryB);
                })
                .map(([category, categoryModules]) => {
                const colors = getCategoryColors(category);
                const bgColor = getCategoryBackground(categoryModules);
                return (
                  <Card key={category} className={`border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br ${bgColor}`}>
                    <Collapsible
                      open={openCategories.has(category)}
                      onOpenChange={() => toggleCategory(category)}
                    >
                      <CollapsibleTrigger className="w-full">
                        <CardHeader className="hover:bg-white/50 transition-colors cursor-pointer">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg flex items-center gap-2">
                              {category}
                              <Badge variant="secondary" className="ml-2">
                                {categoryModules.length} {categoryModules.length === 1 ? 'module' : 'modules'}
                              </Badge>
                            </CardTitle>
                            {openCategories.has(category) ? (
                              <ChevronUp className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                        </CardHeader>
                      </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <CardContent>
                        <div className="space-y-2">
                          {/* Header Row */}
                          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 pb-2 border-b font-semibold text-sm">
                            <div>Module</div>
                            {PERMISSION_TYPES.map(perm => (
                              <div key={perm.key} className="text-center">{perm.label}</div>
                            ))}
                          </div>

                          {/* Module Rows */}
                          {categoryModules.map((module) => (
                            <div
                              key={module.id}
                              ref={(el) => { moduleRefs.current[module.id] = el; }}
                              className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 py-3 border-b last:border-0 hover:bg-muted/50 transition-colors"
                            >
                              <div>
                                <div className="font-medium">{module.displayName}</div>
                                <div className="text-sm text-muted-foreground">
                                  {module.description}
                                </div>
                              </div>

                              {PERMISSION_TYPES.map(perm => (
                                <div key={perm.key} className="flex items-center justify-center">
                                  <Checkbox
                                    checked={getPermissionValue(module.id, perm.key)}
                                    onCheckedChange={() => togglePermission(module.id, perm.key)}
                                  />
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })}
            </div>
          </>
        )}

        {/* Legend */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-sm">Permission Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-sm">
              {PERMISSION_TYPES.map(perm => (
                <div key={perm.key}>
                  <div className="font-medium">{perm.label}</div>
                  <div className="text-muted-foreground">{perm.description}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
