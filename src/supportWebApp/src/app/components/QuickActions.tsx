import { useState } from 'react';
import { Button } from './ui/button';
import { Wand2, Trash2, Loader2 } from 'lucide-react';
import { GenerateTicketsModal } from './GenerateTicketsModal';
import { GeneratorApiClient } from '../../services/generator-api.client';
import { TicketsApiClient } from '../../services/tickets-api.client';
import { toast } from 'sonner';

const generatorApi = GeneratorApiClient.getInstance();
const ticketsApi = TicketsApiClient.getInstance();

export function QuickActions({ onTicketsChanged }: { onTicketsChanged?: () => void }) {
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAll = async () => {
    if (!confirm('Are you sure you want to delete all tickets? This cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      await ticketsApi.threads.deleteAllThreads();
      toast.success('All tickets deleted');
      onTicketsChanged?.();
    } catch (error) {
      console.error('Failed to delete tickets:', error);
      toast.error('Failed to delete tickets');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <h3 className="font-semibold mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Button
          variant="outline"
          onClick={() => setGenerateModalOpen(true)}
          className="justify-start"
        >
          <Wand2 className="w-4 h-4" />
          <span className="ml-2">Generate Tickets</span>
        </Button>
        <Button
          variant="outline"
          onClick={handleDeleteAll}
          disabled={deleting}
          className="justify-start"
        >
          {deleting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
          <span className="ml-2">{deleting ? 'Deleting...' : 'Delete All'}</span>
        </Button>
      </div>
      <GenerateTicketsModal open={generateModalOpen} onOpenChange={setGenerateModalOpen} onTicketsGenerated={onTicketsChanged} />
    </div>
  );
}
