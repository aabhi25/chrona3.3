import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Award, Upload, Download, Plus, Trash2, FileText, ArrowLeft } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function CertificationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [uploadDialog, setUploadDialog] = useState(false);
  const [createDialog, setCreateDialog] = useState(false);
  const [previewDialog, setPreviewDialog] = useState(false);
  const [selectedPreviewTemplate, setSelectedPreviewTemplate] = useState<any>(null);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    category: '',
    file: null as File | null
  });
  const [certificateForm, setCertificateForm] = useState({
    templateId: '',
    recipientName: '',
    recipientType: '' as 'student' | 'teacher' | 'other',
    eventName: '',
    eventDate: '',
    issueDate: new Date().toISOString().split('T')[0],
    additionalDetails: ''
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
  const { data: templates = [] } = useQuery({
    queryKey: ["/api/certificate-templates"],
    enabled: !!user,
    onSuccess: (data) => {
      // Auto-seed templates if none exist
      if (data.length === 0 && !seedTemplatesMutation.isPending) {
        seedTemplatesMutation.mutate();
      }
    }
  });

  // Fetch generated certificates
  const { data: certificates = [] } = useQuery({
    queryKey: ["/api/certificates"],
    enabled: !!user
  });

  // Upload template mutation
  const uploadTemplateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await fetch('/api/certificate-templates', {
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
      queryClient.invalidateQueries({ queryKey: ["/api/certificate-templates"] });
      setUploadDialog(false);
      setTemplateForm({ name: '', description: '', category: '', file: null });
      toast({ title: "Template uploaded successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to upload template", variant: "destructive" });
    }
  });

  // Create certificate mutation
  const createCertificateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('POST', '/api/certificates', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/certificates"] });
      setCreateDialog(false);
      setCertificateForm({
        templateId: '',
        recipientName: '',
        recipientType: '' as 'student' | 'teacher' | 'other',
        eventName: '',
        eventDate: '',
        issueDate: new Date().toISOString().split('T')[0],
        additionalDetails: ''
      });
      toast({ title: "Certificate created successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to create certificate", variant: "destructive" });
    }
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/certificate-templates/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/certificate-templates"] });
      toast({ title: "Template deleted successfully!" });
    }
  });

  // Delete certificate mutation
  const deleteCertificateMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/certificates/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/certificates"] });
      toast({ title: "Certificate deleted successfully!" });
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
    formData.append('category', templateForm.category);
    formData.append('template', templateForm.file);
    formData.append('isDefault', 'false');

    uploadTemplateMutation.mutate(formData);
  };

  const handleCreateCertificate = () => {
    if (!certificateForm.templateId || !certificateForm.recipientName || !certificateForm.eventName || !certificateForm.issueDate) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }

    const data = {
      ...certificateForm,
      additionalDetails: certificateForm.additionalDetails ? { note: certificateForm.additionalDetails } : null
    };

    createCertificateMutation.mutate(data);
  };

  // Scroll to top when component mounts to prevent auto-scroll behavior
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
              <Award className="h-6 w-6 text-purple-600" />
              Certificate Generator
            </h1>
            <p className="text-sm text-muted-foreground">
              Generate certificates for different events with customizable templates
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setUploadDialog(true)} size="sm" variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Upload Template
          </Button>
          <Button onClick={() => setCreateDialog(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Create Certificate
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <FileText className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{templates.length}</p>
                <p className="text-sm text-muted-foreground">Templates</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Award className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{certificates.length}</p>
                <p className="text-sm text-muted-foreground">Certificates</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <Download className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{certificates.length}</p>
                <p className="text-sm text-muted-foreground">Downloads</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Templates Gallery */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Certificate Templates</CardTitle>
          <CardDescription>
            Choose from existing templates or upload your own custom design
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Award className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">
                  No templates uploaded yet. Upload your first template to get started.
                </p>
              </div>
            ) : (
              templates.map((template: any) => (
                <div key={template.id} className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
                  <div className="aspect-[4/3] bg-gray-100 dark:bg-gray-800 rounded border overflow-hidden mb-3 cursor-pointer" onClick={() => {
                    setSelectedPreviewTemplate(template);
                    setPreviewDialog(true);
                  }}>
                    <img 
                      src={template.templateUrl} 
                      alt={template.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const parent = e.currentTarget.parentElement;
                        if (parent) {
                          parent.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200"><svg class="h-12 w-12 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg></div>';
                        }
                      }}
                    />
                  </div>
                  <h3 className="font-medium text-sm mb-1">{template.name}</h3>
                  <p className="text-xs text-muted-foreground mb-2">
                    {template.description || 'No description'}
                  </p>
                  {template.category && (
                    <p className="text-xs text-muted-foreground mb-3">
                      Category: {template.category}
                    </p>
                  )}
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteTemplateMutation.mutate(template.id)}
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

      {/* Recent Certificates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Certificates</CardTitle>
          <CardDescription>
            Recently generated certificates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {certificates.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No certificates generated yet.
              </p>
            ) : (
              certificates.slice(0, 10).map((cert: any) => (
                <div key={cert.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-yellow-100 rounded flex items-center justify-center">
                      <Award className="h-5 w-5 text-yellow-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-sm">{cert.eventName}</h3>
                      <p className="text-xs text-muted-foreground">
                        {cert.recipientName} • {new Date(cert.issueDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost">
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteCertificateMutation.mutate(cert.id)}
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

      {/* Upload Template Dialog */}
      <Dialog open={uploadDialog} onOpenChange={setUploadDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Certificate Template</DialogTitle>
            <DialogDescription>
              Upload a new template for generating certificates
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Template Name *</Label>
              <Input
                placeholder="e.g., Achievement Certificate"
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
              <Label>Category</Label>
              <Input
                placeholder="e.g., Achievement, Participation, Excellence"
                value={templateForm.category}
                onChange={(e) => setTemplateForm({ ...templateForm, category: e.target.value })}
              />
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

      {/* Create Certificate Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Certificate</DialogTitle>
            <DialogDescription>
              Fill in the details to generate a new certificate
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Select Template *</Label>
              <Select value={certificateForm.templateId} onValueChange={(value) => setCertificateForm({ ...certificateForm, templateId: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template: any) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} {template.category && `(${template.category})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Recipient Name *</Label>
              <Input
                placeholder="Full name of recipient"
                value={certificateForm.recipientName}
                onChange={(e) => setCertificateForm({ ...certificateForm, recipientName: e.target.value })}
              />
            </div>
            <div>
              <Label>Recipient Type</Label>
              <Select value={certificateForm.recipientType} onValueChange={(value: 'student' | 'teacher' | 'other') => setCertificateForm({ ...certificateForm, recipientType: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Event Name *</Label>
              <Input
                placeholder="e.g., Science Fair 2025"
                value={certificateForm.eventName}
                onChange={(e) => setCertificateForm({ ...certificateForm, eventName: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Event Date</Label>
                <Input
                  type="date"
                  value={certificateForm.eventDate}
                  onChange={(e) => setCertificateForm({ ...certificateForm, eventDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Issue Date *</Label>
                <Input
                  type="date"
                  value={certificateForm.issueDate}
                  onChange={(e) => setCertificateForm({ ...certificateForm, issueDate: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Additional Details</Label>
              <Textarea
                placeholder="Any additional information (optional)"
                value={certificateForm.additionalDetails}
                onChange={(e) => setCertificateForm({ ...certificateForm, additionalDetails: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCertificate} disabled={createCertificateMutation.isPending}>
              {createCertificateMutation.isPending ? 'Creating...' : 'Create Certificate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialog} onOpenChange={setPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{selectedPreviewTemplate?.name || 'Template Preview'}</DialogTitle>
            <DialogDescription>
              {selectedPreviewTemplate?.description || 'Certificate template preview'}
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
    </div>
  );
}
