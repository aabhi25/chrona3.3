import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Package, AlertTriangle, TrendingUp, TrendingDown, Activity, ArrowLeft, Info, Layers, Lightbulb } from "lucide-react";
import { useForm } from "react-hook-form";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

type InventoryCategory = {
  id: string;
  schoolId: string;
  name: string;
  description?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type InventoryItem = {
  id: string;
  schoolId: string;
  categoryId: string;
  itemName: string;
  description?: string | null;
  itemCode: string;
  unit: string;
  currentStock: number;
  minStockLevel: number;
  location?: string | null;
  supplier?: string | null;
  unitPrice?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type InventoryTransaction = {
  id: string;
  itemId: string;
  transactionType: 'purchase' | 'issue' | 'return' | 'damaged' | 'adjustment';
  quantity: number;
  transactionDate: Date;
  issuedTo?: string | null;
  remarks?: string | null;
  performedBy: string;
  createdAt: Date;
};

export default function InventoryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("items");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [lowStockFilter, setLowStockFilter] = useState(false);

  const { data: categories = [] } = useQuery<InventoryCategory[]>({
    queryKey: ["/api/inventory/categories"],
  });

  const { data: items = [] } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory/items", { categoryId: categoryFilter !== "all" ? categoryFilter : undefined, lowStock: lowStockFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (categoryFilter !== "all") params.append("categoryId", categoryFilter);
      if (lowStockFilter) params.append("lowStock", "true");
      const res = await apiRequest("GET", `/api/inventory/items?${params}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: lowStockItems = [] } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory/items/low-stock"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/inventory/items/low-stock");
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    },
  });

  const { data: transactions = [] } = useQuery<InventoryTransaction[]>({
    queryKey: ["/api/inventory/transactions"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/inventory/transactions");
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    },
  });

  const getCategoryName = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.name || "Unknown";
  };

  const getStockStatus = (item: InventoryItem) => {
    if (item.currentStock < item.minStockLevel) {
      return { text: "Low Stock", color: "destructive" as const };
    }
    return { text: "Sufficient", color: "default" as const };
  };

  const getTransactionBadge = (type: string) => {
    const badges = {
      purchase: { text: "Purchase", color: "default" as const },
      issue: { text: "Issue", color: "secondary" as const },
      return: { text: "Return", color: "outline" as const },
      damaged: { text: "Damaged", color: "destructive" as const },
      adjustment: { text: "Adjustment", color: "default" as const },
    };
    return badges[type as keyof typeof badges] || { text: type, color: "default" as const };
  };

  return (
    <div className="p-6 space-y-6">
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
              <Package className="h-6 w-6 text-purple-600" />
              Inventory Management
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Info className="h-5 w-5" />
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>How to Use Inventory Management</DialogTitle>
                  <DialogDescription>
                    Manage your school's inventory by organizing items into categories, tracking stock levels, and recording all inventory transactions.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-500 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <h4 className="font-semibold text-base text-blue-900 dark:text-blue-100">Getting Started</h4>
                    </div>
                    <ol className="space-y-2 text-sm text-muted-foreground ml-7">
                      <li className="flex gap-2">
                        <span className="font-medium text-blue-600">1.</span>
                        <span>First, create categories (e.g., "Science Lab Equipment", "Sports Items", "Stationery")</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-medium text-blue-600">2.</span>
                        <span>Add items to each category with details like item code, quantity, and minimum stock level</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-medium text-blue-600">3.</span>
                        <span>Set up suppliers and pricing information for better tracking</span>
                      </li>
                    </ol>
                  </div>
                  
                  <div className="bg-green-50 dark:bg-green-950/20 border-l-4 border-green-500 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Layers className="h-5 w-5 text-green-600 dark:text-green-400" />
                      <h4 className="font-semibold text-base text-green-900 dark:text-green-100">Managing Stock</h4>
                    </div>
                    <ul className="space-y-2 text-sm text-muted-foreground ml-7">
                      <li className="flex gap-2">
                        <span className="text-green-600">•</span>
                        <span>Use "Purchase" transaction to add new stock when items arrive</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-green-600">•</span>
                        <span>Use "Issue" when distributing items to teachers or students</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-green-600">•</span>
                        <span>Mark items as "Damaged" or "Return" as needed</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-green-600">•</span>
                        <span>System alerts you when stock falls below minimum level</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="bg-purple-50 dark:bg-purple-950/20 border-l-4 border-purple-500 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      <h4 className="font-semibold text-base text-purple-900 dark:text-purple-100">Example Scenario</h4>
                    </div>
                    <p className="text-sm text-muted-foreground ml-7">Your science teacher requests 20 test tubes. Go to Items tab → Find "Test Tubes" → Click "Issue" transaction → Enter quantity 20 → Add teacher's name in "Issued To" → Stock automatically updates!</p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </h1>
          <p className="text-sm text-muted-foreground">Manage your school's inventory items and stock levels</p>
        </div>
        </div>
      </div>

      {lowStockItems.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{lowStockItems.length}</strong> item(s) are below minimum stock level and need restocking
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Inventory Items</CardTitle>
                  <CardDescription>Manage your inventory items and stock levels</CardDescription>
                </div>
                <CreateItemDialog categories={categories} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-4">
                <div className="flex-1">
                  <Label>Filter by Category</Label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button
                    variant={lowStockFilter ? "default" : "outline"}
                    onClick={() => setLowStockFilter(!lowStockFilter)}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Low Stock Only
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Item</TableHead>
                      <TableHead className="w-[110px]">Category</TableHead>
                      <TableHead className="w-[70px] text-center">Stock</TableHead>
                      <TableHead className="w-[60px] text-center">Min</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="w-[120px]">Details</TableHead>
                      <TableHead className="w-[90px] text-right">Price</TableHead>
                      <TableHead className="w-[90px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map(item => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{item.itemName}</span>
                            <span className="font-mono text-xs text-muted-foreground">{item.itemCode}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{getCategoryName(item.categoryId)}</TableCell>
                        <TableCell className="text-center font-semibold">{item.currentStock}</TableCell>
                        <TableCell className="text-center text-muted-foreground text-sm">{item.minStockLevel}</TableCell>
                        <TableCell>
                          <Badge variant={getStockStatus(item).color} className="text-xs">
                            {getStockStatus(item).text}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs">{item.unit}</span>
                            {item.location && <span className="text-xs text-muted-foreground truncate max-w-[100px]" title={item.location}>{item.location}</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium text-sm">{item.unitPrice ? `₹${item.unitPrice}` : "-"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <EditItemDialog item={item} categories={categories} />
                            <DeleteItemButton itemId={item.id} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Inventory Categories</CardTitle>
                  <CardDescription>Organize your inventory into categories</CardDescription>
                </div>
                <CreateCategoryDialog />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Item Count</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map(category => (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell>{category.description || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {items.filter(i => i.categoryId === category.id).length} items
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <EditCategoryDialog category={category} />
                          <DeleteCategoryButton categoryId={category.id} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Stock Transactions</CardTitle>
                  <CardDescription>Track all inventory movements and adjustments</CardDescription>
                </div>
                <CreateTransactionDialog items={items} />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Issued To</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map(transaction => {
                    const item = items.find(i => i.id === transaction.itemId);
                    return (
                      <TableRow key={transaction.id}>
                        <TableCell>{new Date(transaction.transactionDate).toLocaleString()}</TableCell>
                        <TableCell>{item?.itemName || "Unknown"}</TableCell>
                        <TableCell>
                          <Badge variant={getTransactionBadge(transaction.transactionType).color}>
                            {getTransactionBadge(transaction.transactionType).text}
                          </Badge>
                        </TableCell>
                        <TableCell>{transaction.quantity}</TableCell>
                        <TableCell>{transaction.issuedTo || "-"}</TableCell>
                        <TableCell>{transaction.remarks || "-"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CreateCategoryDialog() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/inventory/categories", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/categories"] });
      toast({ title: "Category created successfully" });
      setOpen(false);
      reset();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create category", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" /> Add Category</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Category</DialogTitle>
          <DialogDescription>Add a new inventory category</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(data => createMutation.mutate(data))} className="space-y-4">
          <div>
            <Label>Category Name</Label>
            <Input {...register("name", { required: true })} placeholder="e.g., Electronics" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea {...register("description")} placeholder="Optional description" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditCategoryDialog({ category }: { category: InventoryCategory }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { register, handleSubmit } = useForm({
    defaultValues: category,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PUT", `/api/inventory/categories/${category.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/categories"] });
      toast({ title: "Category updated successfully" });
      setOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to update category", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Edit className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Category</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(data => updateMutation.mutate(data))} className="space-y-4">
          <div>
            <Label>Category Name</Label>
            <Input {...register("name", { required: true })} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea {...register("description")} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Updating..." : "Update Category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteCategoryButton({ categoryId }: { categoryId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/inventory/categories/${categoryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/categories"] });
      toast({ title: "Category deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete category", description: error.message, variant: "destructive" });
    },
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete this category.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => deleteMutation.mutate()}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CreateItemDialog({ categories }: { categories: InventoryCategory[] }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset } = useForm();

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/inventory/items", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/items"] });
      toast({ title: "Item created successfully" });
      setOpen(false);
      reset();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create item", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" /> Add Item</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Item</DialogTitle>
          <DialogDescription>Add a new inventory item</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(data => createMutation.mutate(data))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Item Name</Label>
              <Input {...register("itemName", { required: true })} placeholder="e.g., Projector" />
            </div>
            <div>
              <Label>Item Code</Label>
              <Input {...register("itemCode", { required: true })} placeholder="e.g., PROJ-001" />
            </div>
            <div>
              <Label>Category</Label>
              <select {...register("categoryId", { required: true })} className="w-full border rounded px-3 py-2">
                <option value="">Select Category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Unit</Label>
              <Input {...register("unit", { required: true })} placeholder="e.g., pieces, boxes" />
            </div>
            <div>
              <Label>Current Stock</Label>
              <Input type="number" {...register("currentStock", { valueAsNumber: true })} defaultValue={0} />
            </div>
            <div>
              <Label>Min Stock Level</Label>
              <Input type="number" {...register("minStockLevel", { valueAsNumber: true })} defaultValue={0} />
            </div>
            <div>
              <Label>Location</Label>
              <Input {...register("location")} placeholder="e.g., Store Room A" />
            </div>
            <div>
              <Label>Supplier</Label>
              <Input {...register("supplier")} placeholder="Supplier name" />
            </div>
            <div>
              <Label>Unit Price (₹)</Label>
              <Input type="number" step="0.01" {...register("unitPrice")} placeholder="0.00" />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea {...register("description")} placeholder="Optional description" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditItemDialog({ item, categories }: { item: InventoryItem; categories: InventoryCategory[] }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { register, handleSubmit } = useForm({
    defaultValues: item,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PUT", `/api/inventory/items/${item.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/items"] });
      toast({ title: "Item updated successfully" });
      setOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Failed to update item", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Edit className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(data => updateMutation.mutate(data))} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Item Name</Label>
              <Input {...register("itemName", { required: true })} />
            </div>
            <div>
              <Label>Item Code</Label>
              <Input {...register("itemCode", { required: true })} />
            </div>
            <div>
              <Label>Category</Label>
              <select {...register("categoryId", { required: true })} className="w-full border rounded px-3 py-2">
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Unit</Label>
              <Input {...register("unit", { required: true })} />
            </div>
            <div>
              <Label>Current Stock</Label>
              <Input type="number" {...register("currentStock", { valueAsNumber: true })} />
            </div>
            <div>
              <Label>Min Stock Level</Label>
              <Input type="number" {...register("minStockLevel", { valueAsNumber: true })} />
            </div>
            <div>
              <Label>Location</Label>
              <Input {...register("location")} />
            </div>
            <div>
              <Label>Supplier</Label>
              <Input {...register("supplier")} />
            </div>
            <div>
              <Label>Unit Price (₹)</Label>
              <Input type="number" step="0.01" {...register("unitPrice")} />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea {...register("description")} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Updating..." : "Update Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteItemButton({ itemId }: { itemId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/inventory/items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/items"] });
      toast({ title: "Item deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to delete item", description: error.message, variant: "destructive" });
    },
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete this item and all associated transaction history.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => deleteMutation.mutate()}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CreateTransactionDialog({ items }: { items: InventoryItem[] }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { register, handleSubmit, watch, reset } = useForm();

  const transactionType = watch("transactionType");

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/inventory/transactions", {
        ...data,
        quantity: parseInt(data.quantity),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/items"] });
      toast({ title: "Transaction created successfully" });
      setOpen(false);
      reset();
    },
    onError: (error: any) => {
      toast({ title: "Failed to create transaction", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" /> Add Transaction</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Transaction</DialogTitle>
          <DialogDescription>Record a stock transaction</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(data => createMutation.mutate(data))} className="space-y-4">
          <div>
            <Label>Item</Label>
            <select {...register("itemId", { required: true })} className="w-full border rounded px-3 py-2">
              <option value="">Select Item</option>
              {items.map(item => (
                <option key={item.id} value={item.id}>{item.itemName} ({item.itemCode})</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Transaction Type</Label>
            <select {...register("transactionType", { required: true })} className="w-full border rounded px-3 py-2">
              <option value="">Select Type</option>
              <option value="purchase">Purchase</option>
              <option value="issue">Issue</option>
              <option value="return">Return</option>
              <option value="damaged">Damaged</option>
              <option value="adjustment">Adjustment</option>
            </select>
          </div>
          <div>
            <Label>Quantity</Label>
            <Input type="number" {...register("quantity", { required: true })} placeholder="Enter quantity" />
          </div>
          {(transactionType === "issue" || transactionType === "return") && (
            <div>
              <Label>Issued To / Returned By</Label>
              <Input {...register("issuedTo")} placeholder="Department or person name" />
            </div>
          )}
          <div>
            <Label>Remarks</Label>
            <Textarea {...register("remarks")} placeholder="Optional remarks" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
