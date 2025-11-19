import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Users, GraduationCap, Download, Upload, Plus, Trash2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function IDCardsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [uploadDialog, setUploadDialog] = useState(false);
  const [generateDialog, setGenerateDialog] = useState(false);
  const [previewDialog, setPreviewDialog] = useState(false);
  const [cardPreviewDialog, setCardPreviewDialog] = useState(false);
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState(false);
  const [selectedPreviewTemplate, setSelectedPreviewTemplate] = useState<any>(null);
  const [selectedPreviewCard, setSelectedPreviewCard] = useState<any>(null);
  const [cardToDelete, setCardToDelete] = useState<any>(null);
  const [selectedType, setSelectedType] = useState<'student' | 'teacher'>('student');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [selectedPersons, setSelectedPersons] = useState<string[]>([]);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    type: 'student' as 'student' | 'teacher',
    file: null as File | null
  });

  // Seed sample templates mutation
  const seedTemplatesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/seed-sample-templates', {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/id-card-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/certificate-templates"] });
      console.log("Sample templates seeded:", data);
    }
  });

  // Fetch templates
  const { data: templates = [] as any[] } = useQuery({
    queryKey: ["/api/id-card-templates"],
    enabled: !!user
  });

  // Fetch generated ID cards
  const { data: idCards = [] as any[] } = useQuery({
    queryKey: ["/api/id-cards"],
    enabled: !!user
  });

  // Fetch students for selection
  const { data: studentsData } = useQuery({
    queryKey: ["/api/students"],
    enabled: !!user && generateDialog && selectedType === 'student'
  });

  // Fetch teachers for selection
  const { data: teachersData } = useQuery({
    queryKey: ["/api/teachers"],
    enabled: !!user && generateDialog && selectedType === 'teacher'
  });

  const students = (studentsData as any)?.students || [];
  const teachers = (teachersData as any)?.teachers || [];

  // Upload template mutation
  const uploadTemplateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await fetch('/api/id-card-templates', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: data
      });
      if (!response.ok) throw new Error('Failed to upload template');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/id-card-templates"] });
      setUploadDialog(false);
      setTemplateForm({ name: '', description: '', type: 'student', file: null });
      toast({ title: "Template uploaded successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to upload template", variant: "destructive" });
    }
  });

  // Generate ID cards mutation
  const generateCardsMutation = useMutation({
    mutationFn: async (data: { templateId: string; personType: string; personIds: string[] }) => {
      const response = await apiRequest('POST', '/api/id-cards/generate', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/id-cards"] });
      setGenerateDialog(false);
      setSelectedPersons([]);
      toast({ title: "ID cards generated successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to generate ID cards", variant: "destructive" });
    }
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/id-card-templates/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/id-card-templates"] });
      toast({ title: "Template deleted successfully!" });
    }
  });

  // Delete ID card mutation
  const deleteCardMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/id-cards/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/id-cards"] });
      toast({ title: "ID card deleted successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to delete ID card", variant: "destructive" });
    }
  });

  const handleUploadTemplate = () => {
    if (!templateForm.name || !templateForm.file) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }

    const formData = new FormData();
    formData.append('name', templateForm.name);
    formData.append('description', templateForm.description);
    formData.append('type', templateForm.type);
    formData.append('template', templateForm.file);
    formData.append('isDefault', 'false');

    uploadTemplateMutation.mutate(formData);
  };

  const handleGenerateCards = () => {
    if (!selectedTemplate || selectedPersons.length === 0) {
      toast({ title: "Please select a template and persons", variant: "destructive" });
      return;
    }

    generateCardsMutation.mutate({
      templateId: selectedTemplate,
      personType: selectedType,
      personIds: selectedPersons
    });
  };

  const togglePersonSelection = (id: string) => {
    setSelectedPersons(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleDownloadCard = (card: any) => {
    if (card.cardImageUrl) {
      const link = document.createElement('a');
      link.href = card.cardImageUrl;
      link.download = `${card.personName.replace(/\s+/g, '_')}_ID_Card.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      toast({ title: "Card file not found", variant: "destructive" });
    }
  };

  const handleViewCard = (card: any) => {
    setSelectedPreviewCard(card);
    setCardPreviewDialog(true);
  };

  const handleDeleteCard = (card: any) => {
    setCardToDelete(card);
    setDeleteConfirmDialog(true);
  };

  const confirmDeleteCard = () => {
    if (cardToDelete) {
      deleteCardMutation.mutate(cardToDelete.id);
      setDeleteConfirmDialog(false);
      setCardToDelete(null);
    }
  };

  const studentTemplates = (templates as any[]).filter((t: any) => t.type === 'student');
  const teacherTemplates = (templates as any[]).filter((t: any) => t.type === 'teacher');
  const studentCards = (idCards as any[]).filter((c: any) => c.personType === 'student');
  const teacherCards = (idCards as any[]).filter((c: any) => c.personType === 'teacher');

  // Scroll to top when component mounts to prevent auto-scroll to tabs
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (!user) return null;

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
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
              <CreditCard className="h-6 w-6 text-purple-600" />
              ID Cards Generator
            </h1>
            <p className="text-sm text-muted-foreground">
              Generate professional ID cards for teachers and students
            </p>
          </div>
        </div>
        <Button onClick={() => setUploadDialog(true)} size="sm">
          <Upload className="h-4 w-4 mr-2" />
          Upload Template
        </Button>
      </div>

      {/* Tabs for Students and Teachers */}
      <Tabs defaultValue="students" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="students" className="gap-2">
            <GraduationCap className="h-4 w-4" />
            Students
          </TabsTrigger>
          <TabsTrigger value="teachers" className="gap-2">
            <Users className="h-4 w-4" />
            Teachers
          </TabsTrigger>
        </TabsList>

        {/* Students Tab */}
        <TabsContent value="students" className="space-y-6 mt-6">
          {/* Quick Action Card */}
          <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-blue-200 dark:border-blue-900">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                    <GraduationCap className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Student ID Cards</CardTitle>
                    <CardDescription className="text-xs">
                      {studentTemplates.length} template(s) • {studentCards.length} card(s) generated
                    </CardDescription>
                  </div>
                </div>
                <Button 
                  size="sm"
                  onClick={() => {
                    setSelectedType('student');
                    setGenerateDialog(true);
                  }}
                  disabled={studentTemplates.length === 0}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Generate Cards
                </Button>
              </div>
            </CardHeader>
          </Card>

          {/* Student Templates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Student Templates</CardTitle>
              <CardDescription>Manage student ID card templates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {studentTemplates.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center mx-auto mb-4">
                      <GraduationCap className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <p className="text-muted-foreground mb-2">No student templates yet</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Upload a student ID card template to get started
                    </p>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setTemplateForm({ ...templateForm, type: 'student' });
                        setUploadDialog(true);
                      }}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Student Template
                    </Button>
                  </div>
                ) : (
                  studentTemplates.map((template: any) => (
                    <div key={template.id} className="flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-16 h-20 bg-gray-100 dark:bg-gray-800 rounded border overflow-hidden cursor-pointer flex-shrink-0"
                          onClick={() => {
                            setSelectedPreviewTemplate(template);
                            setPreviewDialog(true);
                          }}
                        >
                          <img 
                            src={template.templateUrl} 
                            alt={template.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm truncate">
                            {template.name}
                            {template.isDefault && (
                              <span className="ml-2 text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                                Sample
                              </span>
                            )}
                          </h3>
                          <p className="text-xs text-muted-foreground truncate">{template.description || 'No description'}</p>
                        </div>
                      </div>
                      {!template.isDefault && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteTemplateMutation.mutate(template.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Generated Student ID Cards */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Generated Student ID Cards</CardTitle>
              <CardDescription>Recently generated student ID cards</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {studentCards.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No student ID cards generated yet.
                  </p>
                ) : (
                  studentCards.slice(0, 10).map((card: any) => (
                    <div key={card.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div 
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={() => handleViewCard(card)}
                      >
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-950 rounded flex items-center justify-center">
                          <GraduationCap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h3 className="font-medium text-sm">{card.personName}</h3>
                          <p className="text-xs text-muted-foreground">
                            Generated on {new Date(card.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleDownloadCard(card)}
                          title="Download ID Card"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleDeleteCard(card)}
                          title="Delete ID Card"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Teachers Tab */}
        <TabsContent value="teachers" className="space-y-6 mt-6">
          {/* Quick Action Card */}
          <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-emerald-200 dark:border-emerald-900">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Teacher ID Cards</CardTitle>
                    <CardDescription className="text-xs">
                      {teacherTemplates.length} template(s) • {teacherCards.length} card(s) generated
                    </CardDescription>
                  </div>
                </div>
                <Button 
                  size="sm"
                  onClick={() => {
                    setSelectedType('teacher');
                    setGenerateDialog(true);
                  }}
                  disabled={teacherTemplates.length === 0}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Generate Cards
                </Button>
              </div>
            </CardHeader>
          </Card>

          {/* Teacher Templates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Teacher Templates</CardTitle>
              <CardDescription>Manage teacher ID card templates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {teacherTemplates.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center mx-auto mb-4">
                      <Users className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <p className="text-muted-foreground mb-2">No teacher templates yet</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Upload a teacher ID card template to get started
                    </p>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setTemplateForm({ ...templateForm, type: 'teacher' });
                        setUploadDialog(true);
                      }}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Teacher Template
                    </Button>
                  </div>
                ) : (
                  teacherTemplates.map((template: any) => (
                    <div key={template.id} className="flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-16 h-20 bg-gray-100 dark:bg-gray-800 rounded border overflow-hidden cursor-pointer flex-shrink-0"
                          onClick={() => {
                            setSelectedPreviewTemplate(template);
                            setPreviewDialog(true);
                          }}
                        >
                          <img 
                            src={template.templateUrl} 
                            alt={template.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm truncate">
                            {template.name}
                            {template.isDefault && (
                              <span className="ml-2 text-xs px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 rounded">
                                Sample
                              </span>
                            )}
                          </h3>
                          <p className="text-xs text-muted-foreground truncate">{template.description || 'No description'}</p>
                        </div>
                      </div>
                      {!template.isDefault && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteTemplateMutation.mutate(template.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Generated Teacher ID Cards */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Generated Teacher ID Cards</CardTitle>
              <CardDescription>Recently generated teacher ID cards</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {teacherCards.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No teacher ID cards generated yet.
                  </p>
                ) : (
                  teacherCards.slice(0, 10).map((card: any) => (
                    <div key={card.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div 
                        className="flex items-center gap-3 flex-1 cursor-pointer"
                        onClick={() => handleViewCard(card)}
                      >
                        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-950 rounded flex items-center justify-center">
                          <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <h3 className="font-medium text-sm">{card.personName}</h3>
                          <p className="text-xs text-muted-foreground">
                            Generated on {new Date(card.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleDownloadCard(card)}
                          title="Download ID Card"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleDeleteCard(card)}
                          title="Delete ID Card"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Upload Template Dialog */}
      <Dialog open={uploadDialog} onOpenChange={setUploadDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload ID Card Template</DialogTitle>
            <DialogDescription>
              Upload a new template for generating ID cards
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Template Name *</Label>
              <Input
                placeholder="e.g., Default Student ID"
                value={templateForm.name}
                onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                placeholder="Optional description"
                value={templateForm.description}
                onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })}
              />
            </div>
            <div>
              <Label>Type *</Label>
              <Select
                value={templateForm.type}
                onValueChange={(value: 'student' | 'teacher') => setTemplateForm({ ...templateForm, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Template Image *</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setTemplateForm({ ...templateForm, file: e.target.files?.[0] || null })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUploadTemplate} disabled={uploadTemplateMutation.isPending}>
              {uploadTemplateMutation.isPending ? 'Uploading...' : 'Upload Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate ID Cards Dialog */}
      <Dialog open={generateDialog} onOpenChange={setGenerateDialog}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generate {selectedType === 'student' ? 'Student' : 'Teacher'} ID Cards</DialogTitle>
            <DialogDescription>
              Select template and {selectedType === 'student' ? 'students' : 'teachers'} to generate ID cards
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Template *</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent>
                  {(selectedType === 'student' ? studentTemplates : teacherTemplates).map((template: any) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Select {selectedType === 'student' ? 'Students' : 'Teachers'} *</Label>
              <div className="border rounded-lg p-4 max-h-64 overflow-y-auto space-y-2">
                {selectedType === 'student' ? (
                  students.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No students found</p>
                  ) : (
                    students.map((student: any) => (
                      <div key={student.id} className="flex items-center space-x-2">
                        <Checkbox
                          checked={selectedPersons.includes(student.id)}
                          onCheckedChange={() => togglePersonSelection(student.id)}
                        />
                        <label className="text-sm cursor-pointer flex-1">
                          {student.firstName} {student.lastName} - {student.admissionNumber}
                          {student.class && ` (${student.class.grade} ${student.class.section})`}
                        </label>
                      </div>
                    ))
                  )
                ) : (
                  teachers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No teachers found</p>
                  ) : (
                    teachers.map((teacher: any) => (
                      <div key={teacher.id} className="flex items-center space-x-2">
                        <Checkbox
                          checked={selectedPersons.includes(teacher.id)}
                          onCheckedChange={() => togglePersonSelection(teacher.id)}
                        />
                        <label className="text-sm cursor-pointer flex-1">
                          {teacher.name} - {teacher.employeeId}
                        </label>
                      </div>
                    ))
                  )
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Selected: {selectedPersons.length} {selectedType === 'student' ? 'students' : 'teachers'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleGenerateCards} disabled={generateCardsMutation.isPending}>
              {generateCardsMutation.isPending ? 'Generating...' : 'Generate ID Cards'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Preview Dialog */}
      <Dialog open={previewDialog} onOpenChange={setPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{selectedPreviewTemplate?.name || 'Template Preview'}</DialogTitle>
            <DialogDescription>
              {selectedPreviewTemplate?.description || 'ID card template preview'} • Type: {selectedPreviewTemplate?.type}
            </DialogDescription>
          </DialogHeader>
          <div className="w-full overflow-auto">
            {selectedPreviewTemplate && (
              <img 
                src={selectedPreviewTemplate.templateUrl} 
                alt={selectedPreviewTemplate.name}
                className="w-full h-auto rounded-lg border"
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generated Card Preview Dialog */}
      <Dialog open={cardPreviewDialog} onOpenChange={setCardPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{selectedPreviewCard?.personName}'s ID Card</DialogTitle>
            <DialogDescription>
              Generated on {selectedPreviewCard && new Date(selectedPreviewCard.createdAt).toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>
          <div className="w-full overflow-auto">
            {selectedPreviewCard && selectedPreviewCard.cardImageUrl && (
              <img 
                src={selectedPreviewCard.cardImageUrl} 
                alt={`${selectedPreviewCard.personName} ID Card`}
                className="w-full h-auto rounded-lg border"
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCardPreviewDialog(false)}>
              Close
            </Button>
            <Button onClick={() => selectedPreviewCard && handleDownloadCard(selectedPreviewCard)}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmDialog} onOpenChange={setDeleteConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete ID Card</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the ID card for {cardToDelete?.personName}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setDeleteConfirmDialog(false);
              setCardToDelete(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteCard}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
