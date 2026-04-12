import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Ticket } from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-4 flex justify-between items-center border-b">
        <div className="flex items-center gap-2">
          <Ticket className="w-6 h-6" />
          <span className="text-lg font-semibold">SupportDesk</span>
        </div>
        <Button variant="outline" onClick={() => navigate('/login')}>
          Sign In
        </Button>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl text-center"
        >
          <h1 className="text-5xl font-bold mb-6">
            Support Ticketing, Simplified
          </h1>
          <p className="text-xl text-neutral-600 mb-8">
            Streamline customer support with efficient ticket management and conversation tracking.
          </p>
          <Button size="lg" onClick={() => navigate('/login')}>
            Get Started
          </Button>
        </motion.div>
      </main>
    </div>
  );
}
