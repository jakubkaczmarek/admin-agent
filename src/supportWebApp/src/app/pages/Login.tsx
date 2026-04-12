import { useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Ticket } from 'lucide-react';
import { setCurrentUser } from '../lib/auth';

export default function Login() {
  const [username, setUsername] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      setCurrentUser(username.trim());
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-neutral-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Ticket className="w-8 h-8" />
            <span className="text-2xl font-semibold">SupportDesk</span>
          </div>
        </div>

        <div className="bg-white p-8 rounded-lg border">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={!username.trim()}>
              Sign In
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
