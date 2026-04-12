import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { getCurrentUser } from '../lib/auth';
import { TicketsApiClient } from '../../services/tickets-api.client';

const ticketsApi = TicketsApiClient.getInstance();

interface CreateTicketModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTicketCreated?: () => void;
}

export const CreateTicketModal = React.forwardRef<HTMLDivElement, CreateTicketModalProps>(
  ({ open, onOpenChange, onTicketCreated }, ref) => {
    const [subject, setSubject] = useState('');
    const [category, setCategory] = useState('');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const navigate = useNavigate();
    const currentUser = getCurrentUser();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subject.trim() && message.trim() && currentUser) {
      setSubmitting(true);
      try {
        const newTicket = await ticketsApi.threads.createThread({
          creatorUserName: currentUser,
          subject: subject.trim(),
          category: category.trim() || undefined,
          message: message.trim()
        });
        setSubject('');
        setCategory('');
        setMessage('');
        onOpenChange(false);
        onTicketCreated?.();
        navigate(`/ticket/${newTicket.id}`);
      } catch (error) {
        console.error('Failed to create ticket:', error);
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleCancel = () => {
    setSubject('');
    setCategory('');
    setMessage('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Ticket</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="subject">
                Subject <span className="text-red-500">*</span>
              </Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief description of the issue"
                maxLength={256}
                autoFocus
              />
              <div className="text-xs text-neutral-500 text-right">
                {subject.length}/256
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., Technical, Billing, Feature Request"
                maxLength={256}
              />
              <div className="text-xs text-neutral-500 text-right">
                {category.length}/256
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">
                Message <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Detailed description of your issue or request"
                rows={6}
                maxLength={4000}
              />
              <div className="text-xs text-neutral-500 text-right">
                {message.length}/4000
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={!subject.trim() || !message.trim() || submitting}>
              {submitting ? 'Creating...' : 'Create Ticket'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
  }
);

CreateTicketModal.displayName = 'CreateTicketModal';
