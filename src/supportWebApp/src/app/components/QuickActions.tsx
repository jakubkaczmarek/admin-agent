import { useState } from 'react';
import { Button } from './ui/button';
import { Wand2, Trash2, Loader2, Tags, Sparkles, Send } from 'lucide-react';
import { GenerateTicketsModal } from './GenerateTicketsModal';
import { CategorizeTicketsModal } from './CategorizeTicketsModal';
import { AgentApiClient } from '../../services/agent-api.client';
import { TicketsApiClient } from '../../services/tickets-api.client';
import { toast } from 'sonner';

const agentApi = AgentApiClient.getInstance();
const ticketsApi = TicketsApiClient.getInstance();

export function QuickActions({
  onTicketsChanged,
  onJobStarted,
}: {
  onTicketsChanged?: () => void;
  onJobStarted?: (jobId: string) => void;
}) {
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [categorizeModalOpen, setCategorizeModalOpen] = useState(false);
  const [autocompleting, setAutocompleting] = useState(false);
  const [autoreplying, setAutoreplying] = useState(false);
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

  const handleAutocompleteTickets = async () => {
    setAutocompleting(true);
    try {
      const { jobId } = await agentApi.supportTickets.autocompleteTickets();
      onJobStarted?.(jobId);
    } catch (error) {
      console.error('Failed to autocomplete tickets:', error);
      toast.error('Failed to autocomplete tickets');
    } finally {
      setAutocompleting(false);
    }
  };

  const handleAutoreplyTickets = async () => {
    setAutoreplying(true);
    try {
      const { jobId } = await agentApi.supportTickets.autoreplyTickets();
      onJobStarted?.(jobId);
    } catch (error) {
      console.error('Failed to autoreply tickets:', error);
      toast.error('Failed to autoreply tickets');
    } finally {
      setAutoreplying(false);
    }
  };

  return (
    <div>
      <h3 className="font-semibold mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Button
          variant="outline"
          onClick={() => setGenerateModalOpen(true)}
          className="justify-start"
        >
          <Wand2 className="w-4 h-4" />
          <span className="ml-2">Generate</span>
        </Button>
        <Button
          variant="outline"
          onClick={() => setCategorizeModalOpen(true)}
          className="justify-start"
        >
          <Tags className="w-4 h-4" />
          <span className="ml-2">Categorize</span>
        </Button>
        <Button
          variant="outline"
          onClick={handleAutocompleteTickets}
          disabled={autocompleting}
          className="justify-start"
        >
          {autocompleting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          <span className="ml-2">{autocompleting ? 'Completing...' : 'Complete'}</span>
        </Button>
        <Button
          variant="outline"
          onClick={handleAutoreplyTickets}
          disabled={autoreplying}
          className="justify-start"
        >
          {autoreplying ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          <span className="ml-2">{autoreplying ? 'Replying...' : 'Autoreply'}</span>
        </Button>
        <Button
          variant="destructive"
          onClick={handleDeleteAll}
          disabled={deleting}
          className="justify-start bg-red-600 hover:bg-red-700"
        >
          {deleting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
          <span className="ml-2">{deleting ? 'Deleting...' : 'Delete All'}</span>
        </Button>
      </div>
      <GenerateTicketsModal open={generateModalOpen} onOpenChange={setGenerateModalOpen} onJobStarted={onJobStarted} />
      <CategorizeTicketsModal open={categorizeModalOpen} onOpenChange={setCategorizeModalOpen} onJobStarted={onJobStarted} />
    </div>
  );
}
