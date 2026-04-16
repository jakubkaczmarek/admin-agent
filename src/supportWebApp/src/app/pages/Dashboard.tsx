import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Ticket, Plus, LogOut, Zap } from 'lucide-react';
import type { TicketStatus } from '../lib/mockData';
import { getCurrentUser, clearCurrentUser } from '../lib/auth';
import { CreateTicketModal } from '../components/CreateTicketModal';
import { QuickActions } from '../components/QuickActions';
import { formatDistanceToNow } from 'date-fns';
import { TicketsApiClient, type SupportThreadSummary, ThreadStatus } from '../../services/tickets-api.client';
import { AgentApiClient } from '../../services/agent-api.client';
import { AppConsts } from '../../AppConsts';
import { toast } from 'sonner';

const ticketsApi = TicketsApiClient.getInstance();
const agentApi = AgentApiClient.getInstance();

function mapThreadStatusToUi(status: ThreadStatus): TicketStatus {
  return status === ThreadStatus.Closed ? 'closed' : 'active';
}

function mapThreadStatusFromUi(status: TicketStatus | 'all'): ThreadStatus | undefined {
  if (status === 'all') return undefined;
  return status === 'closed' ? ThreadStatus.Closed : ThreadStatus.Open;
}

export default function Dashboard() {
  const [filter, setFilter] = useState<TicketStatus | 'all'>('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<SupportThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    const fetchTickets = async () => {
      setLoading(true);
      try {
        const apiStatus = mapThreadStatusFromUi(filter);
        const result = await ticketsApi.threads.getThreads({ status: apiStatus });
        setTickets(result.data);
      } catch (error) {
        console.error('Failed to fetch tickets:', error);
        setTickets([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  }, [filter]);

  const handleSignOut = () => {
    clearCurrentUser();
    navigate('/');
  };

  const handleTicketCreated = () => {
    const fetchTickets = async () => {
      try {
        const apiStatus = mapThreadStatusFromUi(filter);
        const result = await ticketsApi.threads.getThreads({ status: apiStatus });
        setTickets(result.data);
      } catch (error) {
        console.error('Failed to fetch tickets:', error);
      }
    };
    fetchTickets();
  };

  const handleJobStarted = (jobId: string) => {
    setActiveJobId(jobId);
    setShowQuickActions(false);
  };

  useEffect(() => {
    if (!activeJobId) return;
    const interval = setInterval(async () => {
      try {
        const job = await agentApi.jobs.getJob(activeJobId);
        if (job.status === 'completed') {
          setActiveJobId(null);
          handleTicketCreated();
          toast.success('Quick action completed successfully');
        } else if (job.status === 'error') {
          setActiveJobId(null);
          toast.error(`Quick action failed: ${job.error ?? 'Unknown error'}`);
        }
      } catch {
        setActiveJobId(null);
        toast.error('Failed to poll job status');
      }
    }, AppConsts.jobPollingIntervalMs);
    return () => clearInterval(interval);
  }, [activeJobId]);

  if (!currentUser) return null;

  return (
    <div className="min-h-screen flex flex-col bg-neutral-50">
      <header className="bg-white border-b px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Ticket className="w-6 h-6" />
            <span className="text-lg font-semibold">SupportDesk</span>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowQuickActions(!showQuickActions)}
              disabled={!!activeJobId}
            >
              <Zap className="w-4 h-4 mr-2" />
              {activeJobId ? 'Processing quick action...' : 'Quick Actions'}
            </Button>
            <span className="text-sm text-neutral-600">{currentUser}</span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {showQuickActions && (
        <div className="bg-white border-b px-6 py-4">
          <QuickActions onTicketsChanged={handleTicketCreated} onJobStarted={handleJobStarted} />
        </div>
      )}

      <main className="flex-1 px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Support Tickets</h1>
            <Button onClick={() => setCreateModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create New Ticket
            </Button>
          </div>

          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="mb-6">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="closed">Closed</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-3">
            {loading ? (
              <div className="bg-white rounded-lg border p-12 text-center">
                <p className="text-neutral-500">Loading tickets...</p>
              </div>
            ) : tickets.length === 0 ? (
              <div className="bg-white rounded-lg border p-12 text-center">
                <p className="text-neutral-500">No tickets found</p>
              </div>
            ) : (
              tickets.map((ticket, index) => (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => navigate(`/ticket/${ticket.id}`)}
                  className="bg-white rounded-lg border p-6 hover:border-neutral-400 transition-colors cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-semibold flex-1">{ticket.subject}</h3>
                    <Badge variant={mapThreadStatusToUi(ticket.status) === 'active' ? 'default' : 'secondary'}>
                      {mapThreadStatusToUi(ticket.status)}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-neutral-600">
                    <div>
                      <div className="font-medium text-neutral-900">Created by</div>
                      {ticket.creatorUserName}
                    </div>
                    <div>
                      <div className="font-medium text-neutral-900">Category</div>
                      {ticket.category || '—'}
                    </div>
                    <div>
                      <div className="font-medium text-neutral-900">Created</div>
                      {formatDistanceToNow(new Date(ticket.createdOnDateTime), { addSuffix: true })}
                    </div>
                    <div>
                      <div className="font-medium text-neutral-900">Last modified</div>
                      {formatDistanceToNow(new Date(ticket.modifiedOnDateTime), { addSuffix: true })}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </main>

      <CreateTicketModal open={createModalOpen} onOpenChange={setCreateModalOpen} onTicketCreated={handleTicketCreated} />
    </div>
  );
}
