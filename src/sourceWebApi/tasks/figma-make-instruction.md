# Figma Make Instruction: Support Ticketing System Web App

## Overview
Create a minimalistic, modern web application design for a support ticketing system. The app should be clean, functional, and intuitive, with a focus on readability and efficient ticket management.

## Design Principles
- **Minimalistic**: Remove unnecessary decorative elements, focus on content
- **Functional**: Prioritize usability and task completion
- **Consistent**: Use uniform patterns across all screens
- **Modern**: Clean lines, ample whitespace, contemporary UI patterns
- **Professional**: Suitable for enterprise/business use

---

## Core Pages & Features

### 1. Landing Page
Public-facing homepage introducing the support ticketing system:
- Hero section with app name and brief value proposition
- Short description of what the system does
- Prominent "Get Started" or "Sign In" call-to-action button
- Clean, welcoming design
- Minimal navigation (logo, Sign In button)
- Optional: brief feature highlights or usage instructions

### 2. Login Page
Simple authentication screen:
- App logo/name at top
- Single input field: "Enter your username"
- "Sign In" button (primary action)
- No password required - just username entry
- Clean, centered form on minimal background
- Clear, frictionless design

### 3. Tickets List View (Main Dashboard)
Primary screen after login - shows all support tickets:
- **Header bar**:
  - App name/logo (left)
  - Logged-in username (right)
  - Sign out link (right)
- **Page header**:
  - Title: "Support Tickets"
  - "Create New Ticket" button (prominent, primary)
- **Filter controls**:
  - Status filter dropdown or tabs (All, Active, Closed)
  - Clean, minimal design
- **Ticket list**:
  - Display as cards or table rows
  - Each ticket shows:
    - Subject (primary, bold)
    - Status badge (Active/Closed)
    - Creator name
    - Category (if present)
    - Creation and modification timestamps
    - Last modifier name
  - Clickable tickets → navigate to detail view
  - Hover effects for interactivity
- **Pagination**:
  - Page navigation controls at bottom
  - Shows current page and total count
- **Sidebar or secondary navigation** (optional):
  - Quick links: All Tickets, Active, Closed
  - Quick Actions section

### 4. Ticket Detail View
Full conversation thread for a single ticket:
- **Navigation**:
  - Back button/link to return to ticket list
  - Breadcrumb optional
- **Ticket header card**:
  - Subject (large title)
  - Metadata grid (2-column layout):
    - Created by / Modified by
    - Created date / Modified date
    - Category / Status badge
  - "Close Thread" action button (top-right)
    - Disabled/hidden if already closed
- **Messages section**:
  - Title: "Conversation" or "Messages"
  - Chronological message list (oldest first)
  - Each message displays:
    - Sender name (bold)
    - Timestamp (smaller, secondary color)
    - Message content
  - First message visually distinguished (it's the original ticket description)
  - Clean, readable spacing between messages
- **Reply composition area** (bottom):
  - Textarea for message input
  - Placeholder: "Type your reply..."
  - "Send Message" button
  - Clean, chat-like interface feel

### 5. Create Ticket Modal/Form
Dialog or page for creating new tickets:
- **Form fields**:
  - Subject (required, max 256 chars)
  - Category (optional, max 256 chars)
  - Message (required, max 4000 chars, textarea)
  - Creator name auto-filled from logged-in user
- **Validation**:
  - Required field indicators
  - Error messages for invalid input
  - Character counters
- **Actions**:
  - Submit/Create button (primary)
  - Cancel button (secondary)
- Modal overlay if popup style
- Clear, focused form design

### 6. Quick Actions Panel
Section for launching external processes:
- Can be in sidebar, separate page, or dashboard section
- **Design**:
  - Section title: "Quick Actions" or "Tools"
  - Grid or list of action buttons
  - Each button has icon + label
- **Button states**:
  - Default: Ready to click
  - Loading: Process running (spinner/progress)
  - Success: Completed successfully
  - Error: Failed with message
- **Feedback**:
  - Toast notifications for results
  - Auto-dismiss after few seconds
- Examples: Sync Data, Generate Report, Clear Cache, Export Tickets

---

## Layout Structure

### Desktop Layout
- **Header**: App name/branding at top
- **Navigation**: Sidebar with links to different views (All Tickets, Active, Closed, Quick Actions)
- **Main Content**: Central area for primary content
- Generous spacing and readable text sizes

### Responsive Considerations
- Design should adapt to tablet and mobile screens
- Navigation collapses to hamburger menu or bottom bar on smaller screens
- Forms and cards stack vertically on mobile
- Touch-friendly button sizes for mobile

---

## UI Components Needed

### Interactive Elements
- **Primary buttons**: For main actions (Create, Send, Submit)
- **Secondary buttons**: For alternative actions (Cancel, Close, Back)
- **Status buttons**: Visual indicators that can be clicked (status badges)
- **Input fields**: Text inputs, textareas, dropdowns
- **Navigation links**: Clickable text for navigation

### Display Components
- **Cards**: Container elements for tickets and messages
- **Badges**: Small status indicators (Active, Closed)
- **Metadata text**: Secondary information (timestamps, usernames)
- **Empty states**: Visual feedback when no data exists

### Feedback Components
- **Loading indicators**: Spinners or progress indicators
- **Toast notifications**: Brief success/error messages
- **Validation messages**: Field-level error indicators

---

## User Flows to Prototype

1. **First Visit**:
   - Land on homepage → Read intro → Click "Sign In" → Enter username → Access ticket dashboard

2. **Browse Tickets**:
   - View list → Filter by status → Click ticket → View conversation thread

3. **Create Ticket**:
   - Click "New Ticket" → Fill form → Submit → See ticket appear in list

4. **Reply to Ticket**:
   - Open ticket → Read conversation → Type reply → Send → See message appear in thread

5. **Close Ticket**:
   - Open ticket → Click "Close Thread" → Status updates to Closed → Button becomes disabled

6. **Run External Process**:
   - Navigate to Quick Actions → Click action button → See loading state → See success/error notification

7. **Sign Out**:
   - Click sign out link → Return to landing page or login screen

---

## Style Guidelines (Flexible)

### Visual Hierarchy
- Use size, weight, and color to establish importance
- Primary content should be most prominent
- Secondary information should be subtle but accessible

### Spacing & Layout
- Consistent spacing system throughout
- Adequate whitespace for readability
- Logical grouping of related elements

### Color Usage
- Use color purposefully (actions, status, alerts)
- Maintain sufficient contrast for accessibility
- Keep palette cohesive and professional

### Typography
- Clear, readable font choices
- Limited typeface variety (1-2 fonts max)
- Hierarchy through size and weight variations

---

## Accessibility
- Ensure good contrast ratios
- Clear focus states on interactive elements
- Readable text sizes
- Logical tab order for keyboard navigation

---

## Deliverables

1. **Main Screens**:
   - Landing Page (public homepage)
   - Login Page (simple username entry)
   - Tickets List Dashboard (post-login main view)
   - Ticket Detail Page (conversation thread)
   - Create Ticket Modal/Form
   - Quick Actions section/component

2. **Component Set**:
   - Buttons (primary, secondary, states)
   - Input fields (text, textarea, dropdown)
   - Cards (ticket cards, message cards)
   - Status badges (Active, Closed)
   - Navigation elements (header, sidebar, links)
   - Toast notifications

3. **Interactive Prototype** (optional):
   - Complete flow: Landing → Login → Dashboard → Ticket Detail
   - Create ticket interaction
   - Reply to ticket interaction
   - Close thread interaction
   - Quick Actions button states

---

## Keywords for AI Generation

```
minimalistic support ticketing system, clean modern UI, enterprise dashboard, 
card-based layout, conversation thread, professional web application, 
efficient task management, simple intuitive design
```

---

## Notes

- Focus on functionality over decoration
- Design should feel lightweight and fast
- Keep patterns consistent with modern SaaS applications
- Quick Actions should be visually distinct but integrated naturally
- Consider how the design scales from empty state to data-heavy views
- Consider dark mode variant for future implementation
