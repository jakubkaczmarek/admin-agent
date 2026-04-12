export type TicketStatus = 'active' | 'closed';

export interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: Date;
}

export interface Ticket {
  id: string;
  subject: string;
  status: TicketStatus;
  category?: string;
  createdBy: string;
  createdAt: Date;
  modifiedBy: string;
  modifiedAt: Date;
  messages: Message[];
}

let ticketData: Ticket[] = [
  {
    id: '1',
    subject: 'Unable to reset password',
    status: 'active',
    category: 'Account',
    createdBy: 'sarah.chen',
    createdAt: new Date('2026-04-08T09:15:00'),
    modifiedBy: 'support.agent',
    modifiedAt: new Date('2026-04-08T14:30:00'),
    messages: [
      {
        id: 'm1',
        sender: 'sarah.chen',
        content: "I've been trying to reset my password for the past hour but the reset link never arrives in my email. I've checked spam and all folders.",
        timestamp: new Date('2026-04-08T09:15:00'),
      },
      {
        id: 'm2',
        sender: 'support.agent',
        content: "Hi Sarah, I've checked your account and resent the password reset link. It should arrive within a few minutes. Please let me know if you don't receive it.",
        timestamp: new Date('2026-04-08T14:30:00'),
      },
    ],
  },
  {
    id: '2',
    subject: 'Feature request: Dark mode',
    status: 'active',
    category: 'Feature Request',
    createdBy: 'mike.torres',
    createdAt: new Date('2026-04-07T16:45:00'),
    modifiedBy: 'mike.torres',
    modifiedAt: new Date('2026-04-07T16:45:00'),
    messages: [
      {
        id: 'm3',
        sender: 'mike.torres',
        content: 'Would love to see a dark mode option for the application. Working late nights and the bright interface is straining my eyes.',
        timestamp: new Date('2026-04-07T16:45:00'),
      },
    ],
  },
  {
    id: '3',
    subject: 'Billing discrepancy in March invoice',
    status: 'closed',
    category: 'Billing',
    createdBy: 'emma.watson',
    createdAt: new Date('2026-04-05T11:20:00'),
    modifiedBy: 'support.agent',
    modifiedAt: new Date('2026-04-06T10:15:00'),
    messages: [
      {
        id: 'm4',
        sender: 'emma.watson',
        content: 'I noticed my March invoice shows a charge for 15 users but we only have 12 active users on our account.',
        timestamp: new Date('2026-04-05T11:20:00'),
      },
      {
        id: 'm5',
        sender: 'support.agent',
        content: 'Thank you for bringing this to our attention. I\'ve reviewed your account and you\'re correct. I\'ve issued a credit for the overcharge and it will appear on your next invoice.',
        timestamp: new Date('2026-04-06T10:15:00'),
      },
      {
        id: 'm6',
        sender: 'emma.watson',
        content: 'Perfect, thank you for the quick resolution!',
        timestamp: new Date('2026-04-06T10:20:00'),
      },
    ],
  },
  {
    id: '4',
    subject: 'API rate limit clarification',
    status: 'active',
    category: 'Technical',
    createdBy: 'dev.alex',
    createdAt: new Date('2026-04-09T08:00:00'),
    modifiedBy: 'dev.alex',
    modifiedAt: new Date('2026-04-09T08:00:00'),
    messages: [
      {
        id: 'm7',
        sender: 'dev.alex',
        content: "What are the exact rate limits for the API? The documentation says 100 requests per minute but I'm getting throttled at around 80.",
        timestamp: new Date('2026-04-09T08:00:00'),
      },
    ],
  },
  {
    id: '5',
    subject: 'Cannot upload files larger than 5MB',
    status: 'closed',
    category: 'Technical',
    createdBy: 'jessica.park',
    createdAt: new Date('2026-04-03T13:30:00'),
    modifiedBy: 'support.agent',
    modifiedAt: new Date('2026-04-04T09:45:00'),
    messages: [
      {
        id: 'm8',
        sender: 'jessica.park',
        content: 'Every time I try to upload files larger than 5MB, I get an error. Is there a file size limit?',
        timestamp: new Date('2026-04-03T13:30:00'),
      },
      {
        id: 'm9',
        sender: 'support.agent',
        content: 'The file size limit is 10MB per file. The error you\'re seeing is likely a timeout issue. I\'ve increased your account timeout settings. Please try again.',
        timestamp: new Date('2026-04-04T09:45:00'),
      },
    ],
  },
];

export function getAllTickets(): Ticket[] {
  return ticketData;
}

export function getTicketsByStatus(status: TicketStatus | 'all'): Ticket[] {
  if (status === 'all') return ticketData;
  return ticketData.filter(ticket => ticket.status === status);
}

export function getTicketById(id: string): Ticket | undefined {
  return ticketData.find(ticket => ticket.id === id);
}

export function createTicket(
  subject: string,
  category: string | undefined,
  message: string,
  createdBy: string
): Ticket {
  const now = new Date();
  const newTicket: Ticket = {
    id: String(ticketData.length + 1),
    subject,
    status: 'active',
    category,
    createdBy,
    createdAt: now,
    modifiedBy: createdBy,
    modifiedAt: now,
    messages: [
      {
        id: `m${Date.now()}`,
        sender: createdBy,
        content: message,
        timestamp: now,
      },
    ],
  };
  ticketData = [newTicket, ...ticketData];
  return newTicket;
}

export function addMessage(ticketId: string, sender: string, content: string): void {
  const ticket = ticketData.find(t => t.id === ticketId);
  if (ticket) {
    const now = new Date();
    ticket.messages.push({
      id: `m${Date.now()}`,
      sender,
      content,
      timestamp: now,
    });
    ticket.modifiedBy = sender;
    ticket.modifiedAt = now;
  }
}

export function closeTicket(ticketId: string, username: string): void {
  const ticket = ticketData.find(t => t.id === ticketId);
  if (ticket) {
    ticket.status = 'closed';
    ticket.modifiedBy = username;
    ticket.modifiedAt = new Date();
  }
}
