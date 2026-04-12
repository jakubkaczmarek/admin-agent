export const TICKET_CATEGORIES = [
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

export type TicketCategory = typeof TICKET_CATEGORIES[number];
