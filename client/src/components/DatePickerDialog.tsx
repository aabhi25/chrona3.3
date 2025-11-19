import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";

interface DatePickerDialogProps {
  value: Date | undefined;
  onChange: (date: Date) => void;
  className?: string;
  buttonClassName?: string;
}

export function DatePickerDialog({ value, onChange, className, buttonClassName }: DatePickerDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className={buttonClassName || "w-[400px] justify-start text-left font-normal"}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, "PPP") : "Select a date"}
        </Button>
      </DialogTrigger>
      <DialogContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            if (date) {
              onChange(date);
              setOpen(false);
            }
          }}
          initialFocus
        />
      </DialogContent>
    </Dialog>
  );
}
