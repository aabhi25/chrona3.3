import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Plus } from "lucide-react";

interface FilterCondition {
  field: string;
  operator: string;
  value: any;
}

interface Field {
  name: string;
  label: string;
  type: string;
  filterable: boolean;
}

interface FilterBuilderProps {
  availableFields: Field[];
  filters: FilterCondition[];
  onChange: (filters: FilterCondition[]) => void;
}

const OPERATORS = {
  string: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'starts_with', label: 'Starts With' },
    { value: 'ends_with', label: 'Ends With' },
    { value: 'is_null', label: 'Is Empty' },
    { value: 'is_not_null', label: 'Is Not Empty' },
  ],
  number: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not Equals' },
    { value: 'greater_than', label: 'Greater Than' },
    { value: 'less_than', label: 'Less Than' },
    { value: 'greater_than_or_equal', label: 'Greater Than or Equal' },
    { value: 'less_than_or_equal', label: 'Less Than or Equal' },
    { value: 'between', label: 'Between' },
  ],
  date: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not Equals' },
    { value: 'greater_than', label: 'After' },
    { value: 'less_than', label: 'Before' },
    { value: 'between', label: 'Between' },
  ],
  timestamp: [
    { value: 'equals', label: 'Equals' },
    { value: 'greater_than', label: 'After' },
    { value: 'less_than', label: 'Before' },
    { value: 'between', label: 'Between' },
  ],
};

export function FilterBuilder({ availableFields, filters, onChange }: FilterBuilderProps) {
  const filterableFields = availableFields.filter(f => f.filterable);

  const addFilter = () => {
    const newFilter: FilterCondition = {
      field: filterableFields[0]?.name || '',
      operator: 'equals',
      value: '',
    };
    onChange([...filters, newFilter]);
  };

  const removeFilter = (index: number) => {
    const updated = filters.filter((_, i) => i !== index);
    onChange(updated);
  };

  const updateFilter = (index: number, updates: Partial<FilterCondition>) => {
    const updated = filters.map((filter, i) => 
      i === index ? { ...filter, ...updates } : filter
    );
    onChange(updated);
  };

  const getFieldType = (fieldName: string): string => {
    const field = availableFields.find(f => f.name === fieldName);
    return field?.type || 'string';
  };

  const getOperatorsForField = (fieldName: string) => {
    const fieldType = getFieldType(fieldName);
    return OPERATORS[fieldType as keyof typeof OPERATORS] || OPERATORS.string;
  };

  const renderValueInput = (filter: FilterCondition, index: number) => {
    const fieldType = getFieldType(filter.field);
    const needsValue = !['is_null', 'is_not_null'].includes(filter.operator);

    if (!needsValue) {
      return null;
    }

    if (filter.operator === 'between') {
      return (
        <div className="flex gap-2 items-center">
          <Input
            type={fieldType === 'number' ? 'number' : fieldType === 'date' ? 'date' : 'text'}
            value={Array.isArray(filter.value) ? filter.value[0] || '' : ''}
            onChange={(e) => {
              const currentValue = Array.isArray(filter.value) ? filter.value : ['', ''];
              updateFilter(index, { value: [e.target.value, currentValue[1] || ''] });
            }}
            placeholder="From"
            className="flex-1"
          />
          <span className="text-sm text-muted-foreground">and</span>
          <Input
            type={fieldType === 'number' ? 'number' : fieldType === 'date' ? 'date' : 'text'}
            value={Array.isArray(filter.value) ? filter.value[1] || '' : ''}
            onChange={(e) => {
              const currentValue = Array.isArray(filter.value) ? filter.value : ['', ''];
              updateFilter(index, { value: [currentValue[0] || '', e.target.value] });
            }}
            placeholder="To"
            className="flex-1"
          />
        </div>
      );
    }

    return (
      <Input
        type={fieldType === 'number' ? 'number' : fieldType === 'date' ? 'date' : 'text'}
        value={filter.value || ''}
        onChange={(e) => updateFilter(index, { value: e.target.value })}
        placeholder="Value"
      />
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Filters</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addFilter}
          disabled={filterableFields.length === 0}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Filter
        </Button>
      </div>

      {filters.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No filters added. Click "Add Filter" to create one.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filters.map((filter, index) => (
            <Card key={index}>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                  <div className="md:col-span-4">
                    <Label className="text-xs mb-1.5 block">Field</Label>
                    <Select
                      value={filter.field}
                      onValueChange={(value) => {
                        updateFilter(index, { field: value, operator: 'equals', value: '' });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {filterableFields.map((field) => (
                          <SelectItem key={field.name} value={field.name}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-3">
                    <Label className="text-xs mb-1.5 block">Operator</Label>
                    <Select
                      value={filter.operator}
                      onValueChange={(value) => {
                        const needsArray = value === 'between';
                        updateFilter(index, { 
                          operator: value,
                          value: needsArray ? ['', ''] : ''
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getOperatorsForField(filter.field).map((op) => (
                          <SelectItem key={op.value} value={op.value}>
                            {op.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-4">
                    <Label className="text-xs mb-1.5 block">Value</Label>
                    {renderValueInput(filter, index)}
                  </div>

                  <div className="md:col-span-1 flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFilter(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
