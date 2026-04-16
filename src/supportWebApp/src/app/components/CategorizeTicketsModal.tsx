import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { AgentApiClient } from '../../services/agent-api.client';
import { toast } from 'sonner';
import { TICKET_CATEGORIES } from '../constants/ticket-categories';

const agentApi = AgentApiClient.getInstance();

interface CategorizeTicketsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJobStarted?: (jobId: string) => void;
}

export const CategorizeTicketsModal = React.forwardRef<HTMLDivElement, CategorizeTicketsModalProps>(
  ({ open, onOpenChange, onJobStarted }, ref) => {
    const [limitCategories, setLimitCategories] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      try {
        const allowedCategories = limitCategories ? [...TICKET_CATEGORIES] : undefined;
        const { jobId } = await agentApi.supportTickets.categorizeTickets(allowedCategories);
        onOpenChange(false);
        onJobStarted?.(jobId);
      } catch (error) {
        console.error('Failed to categorize tickets:', error);
        toast.error('Failed to categorize tickets');
      } finally {
        setSubmitting(false);
      }
    };

    const handleCancel = () => {
      setLimitCategories(true);
      onOpenChange(false);
    };

    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Categorize Tickets</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="limitCategories"
                    checked={limitCategories}
                    onCheckedChange={(checked) => setLimitCategories(!!checked)}
                  />
                  <Label htmlFor="limitCategories" className="text-sm cursor-pointer">
                    Limit categories
                  </Label>
                </div>
                {limitCategories && (
                  <div className="mt-3 p-3 bg-neutral-50 rounded-md">
                    <p className="text-sm text-neutral-700 mb-2 font-medium">
                      Allowed categories:
                    </p>
                    <ul className="text-xs text-neutral-600 space-y-1">
                      {TICKET_CATEGORIES.map((cat) => (
                        <li key={cat}>• {cat}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Categorizing...' : 'Categorize Tickets'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }
);

CategorizeTicketsModal.displayName = 'CategorizeTicketsModal';
