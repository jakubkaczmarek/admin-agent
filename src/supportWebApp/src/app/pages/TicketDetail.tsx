import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '../lib/auth';
import { format } from 'date-fns';
import { TicketsApiClient, type SupportThread, ThreadStatus } from '../../services/tickets-api.client';

const ticketsApi = TicketsApiClient.getInstance();

function mapThreadStatusToUi(status: ThreadStatus): 'active' | 'closed' {
  return status === ThreadStatus.Closed ? 'closed' : 'active';
}

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<SupportThread | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    const fetchTicket = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const threadId = parseInt(id, 10);
        const data = await ticketsApi.threads.getThread(threadId);
        setTicket(data);
      } catch (error) {
        console.error('Failed to fetch ticket:', error);
        setTicket(undefined);
      } finally {
        setLoading(false);
      }
    };

    fetchTicket();
  }, [id]);

  const handleSendMessage = async () => {
    if (replyText.trim() && ticket && currentUser) {
      setSubmitting(true);
      try {
        await ticketsApi.threads.addMessage(ticket.id, {
          creatorUserName: currentUser,
          message: replyText.trim()
        });
        setReplyText('');
        const refreshed = await ticketsApi.threads.getThread(ticket.id);
        setTicket(refreshed);
      } catch (error) {
        console.error('Failed to send message:', error);
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleCloseTicket = async () => {
    if (ticket && currentUser) {
      try {
        await ticketsApi.threads.closeThread(ticket.id);
        const refreshed = await ticketsApi.threads.getThread(ticket.id);
        setTicket(refreshed);
      } catch (error) {
        console.error('Failed to close ticket:', error);
      }
    }
  };

  if (!currentUser) return null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-600 mb-4">Loading ticket...</p>
          <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-600 mb-4">Ticket not found</p>
          <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b px-6 py-4">
        <Button variant="ghost" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Tickets
        </Button>
      </header>

      <main className="px-6 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg border p-6"
          >
            <div className="flex justify-between items-start mb-6">
              <h1 className="text-2xl font-bold flex-1">{ticket.subject}</h1>
              {mapThreadStatusToUi(ticket.status) === 'active' && (
                <Button variant="outline" onClick={handleCloseTicket}>
                  Close Thread
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-medium text-neutral-900 mb-1">Created by</div>
                <div className="text-neutral-600">{ticket.creatorUserName}</div>
              </div>
              <div>
                <div className="font-medium text-neutral-900 mb-1">Modified by</div>
                <div className="text-neutral-600">{ticket.modifierUserName}</div>
              </div>
              <div>
                <div className="font-medium text-neutral-900 mb-1">Created</div>
                <div className="text-neutral-600">
                  {format(new Date(ticket.createdOnDateTime), 'MMM d, yyyy h:mm a')}
                </div>
              </div>
              <div>
                <div className="font-medium text-neutral-900 mb-1">Modified</div>
                <div className="text-neutral-600">
                  {format(new Date(ticket.modifiedOnDateTime), 'MMM d, yyyy h:mm a')}
                </div>
              </div>
              <div>
                <div className="font-medium text-neutral-900 mb-1">Category</div>
                <div className="text-neutral-600">{ticket.category || '—'}</div>
              </div>
              <div>
                <div className="font-medium text-neutral-900 mb-1">Status</div>
                <Badge variant={mapThreadStatusToUi(ticket.status) === 'active' ? 'default' : 'secondary'}>
                  {mapThreadStatusToUi(ticket.status)}
                </Badge>
              </div>
            </div>
          </motion.div>

          <div className="bg-white rounded-lg border">
            <div className="px-6 py-4 border-b">
              <h2 className="font-semibold">Conversation</h2>
            </div>

            <div className="p-6 space-y-6">
              {ticket.messages.map((message, index) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={index === 0 ? 'pb-6 border-b' : ''}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-semibold">{message.creatorUserName}</div>
                    <div className="text-sm text-neutral-500">
                      {format(new Date(message.createdOnDateTime), 'MMM d, h:mm a')}
                    </div>
                  </div>
                  <p className="text-neutral-700 whitespace-pre-wrap">{message.message}</p>
                </motion.div>
              ))}
            </div>

            {mapThreadStatusToUi(ticket.status) === 'active' && (
              <div className="px-6 py-4 border-t bg-neutral-50">
                <Textarea
                  placeholder="Type your reply..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="mb-3 bg-white"
                  rows={4}
                />
                <Button onClick={handleSendMessage} disabled={!replyText.trim() || submitting}>
                  {submitting ? 'Sending...' : 'Send Message'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
