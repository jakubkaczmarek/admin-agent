import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { GeneratorApiClient } from '../../services/generator-api.client';
import { toast } from 'sonner';

const generatorApi = GeneratorApiClient.getInstance();

const CATEGORIES = [
  'Software',
  'Hardware',
  'Accounts & Access',
  'Email & Communication',
  'Cloud Services',
  'Security & Compliance',
  'Legal',
  'Licensing & Billing',
  'Human Resources (HR)',
  'Payroll & Compensation',
  'Procurement & Purchasing',
  'Facilities & Office Management',
  'Travel & Expenses',
  'Customer Support / Client Issues',
  'Training & Development',
  'Other / General Inquiry',
] as const;

interface GenerateTicketsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTicketsGenerated?: () => void;
}

export function GenerateTicketsModal({ open, onOpenChange, onTicketsGenerated }: GenerateTicketsModalProps) {
  const [ticketsCount, setTicketsCount] = useState(5);
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [useCustomCategory, setUseCustomCategory] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const theme = useCustomCategory ? customCategory.trim() : category;
    if (!theme) {
      toast.error('Please select or enter a category');
      return;
    }

    setSubmitting(true);
    try {
      await generatorApi.generate.generateTickets({
        ticketsCount,
        theme
      });
      setTicketsCount(5);
      setCategory('');
      setCustomCategory('');
      setUseCustomCategory(false);
      onOpenChange(false);
      onTicketsGenerated?.();
      toast.success(`${ticketsCount} ticket(s) generated successfully`);
    } catch (error) {
      console.error('Failed to generate tickets:', error);
      toast.error('Failed to generate tickets');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setTicketsCount(5);
    setCategory('');
    setCustomCategory('');
    setUseCustomCategory(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Tickets</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="ticketsCount">
                Tickets Count <span className="text-red-500">*</span>
              </Label>
              <Input
                id="ticketsCount"
                type="number"
                min={1}
                max={20}
                value={ticketsCount}
                onChange={(e) => setTicketsCount(Math.min(20, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                autoFocus
              />
              <div className="text-xs text-neutral-500 text-right">
                {ticketsCount}/20
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category / Theme <span className="text-red-500">*</span></Label>
              <div className="flex items-center gap-2 mb-2">
                <Checkbox
                  id="customCategory"
                  checked={useCustomCategory}
                  onCheckedChange={(checked) => setUseCustomCategory(!!checked)}
                />
                <Label htmlFor="customCategory" className="text-sm cursor-pointer">
                  Use custom category
                </Label>
              </div>
              {useCustomCategory ? (
                <Input
                  id="customCategoryInput"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Enter custom category"
                  maxLength={256}
                />
              ) : (
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={!category && !customCategory.trim() || submitting}>
              {submitting ? 'Generating...' : 'Generate Tickets'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
