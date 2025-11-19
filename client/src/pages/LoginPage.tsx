import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Calendar, Users, Bot, Newspaper, Sparkles, MessageCircle } from "lucide-react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import logoImage from "@assets/chrona-logo.png";

const ChatShowcase = () => {
  const [step, setStep] = useState(0);
  
  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 1000),
      setTimeout(() => setStep(2), 3000),
      setTimeout(() => setStep(0), 6000),
    ];
    
    return () => timers.forEach(clearTimeout);
  }, [step]);

  return (
    <div className="relative w-full max-w-4xl mx-auto mt-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-12 border border-gray-200 dark:border-gray-700"
      >
        <div className="mb-8">
          <h3 className="font-semibold text-2xl">Chroney AI Assistant</h3>
          <p className="text-base text-muted-foreground">Always here to help</p>
        </div>
        
        <div className="space-y-6 min-h-[280px]">
          <AnimatePresence mode="wait">
            {step >= 1 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex justify-end"
              >
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-3xl rounded-tr-md px-6 py-4 max-w-[85%] shadow-md">
                  <p className="text-base leading-relaxed">How many teachers are free during Period 3 on Monday?</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          <AnimatePresence mode="wait">
            {step >= 2 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex justify-start"
              >
                <div className="bg-gray-100 dark:bg-gray-700/50 rounded-3xl rounded-tl-md px-6 py-5 max-w-[85%] shadow-md">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="bg-gradient-to-r from-pink-500 to-purple-600 rounded-full p-2 flex-shrink-0">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    <p className="font-semibold text-base">Chroney AI</p>
                  </div>
                  <p className="text-base text-gray-800 dark:text-gray-200 leading-relaxed">
                    During Period 3 on Monday, there are <span className="font-semibold">2 teachers</span> free: Ms. Sharma (Math) and Mr. Patel (English).
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

const FloatingOrb = ({ delay = 0, duration = 20, className = "" }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ 
      opacity: [0.3, 0.6, 0.3],
      scale: [1, 1.2, 1],
      x: [0, 100, 0],
      y: [0, -100, 0],
    }}
    transition={{
      duration,
      delay,
      repeat: Infinity,
      ease: "easeInOut"
    }}
    className={`absolute rounded-full blur-3xl ${className}`}
  />
);

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { loginMutation, user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    if (isAuthenticated && user) {
      setLocation("/");
    }
  }, [isAuthenticated, user, setLocation]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-slate-950 dark:via-indigo-950 dark:to-purple-950"
      >
        <FloatingOrb 
          delay={0} 
          duration={25}
          className="top-20 left-20 w-96 h-96 bg-gradient-to-r from-blue-400 to-cyan-400" 
        />
        <FloatingOrb 
          delay={5} 
          duration={30}
          className="bottom-20 right-20 w-80 h-80 bg-gradient-to-r from-purple-400 to-pink-400" 
        />
        <FloatingOrb 
          delay={10} 
          duration={35}
          className="top-1/2 left-1/2 w-72 h-72 bg-gradient-to-r from-indigo-400 to-violet-400" 
        />
      </motion.div>

      <div className="relative z-10 flex flex-col lg:flex-row w-full">
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex-1 flex items-center justify-center p-8"
        >
          <Card className="w-full max-w-md backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 shadow-2xl border-white/20">
            <CardHeader className="text-center space-y-4">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                className="flex items-center justify-center"
              >
                <img 
                  src={logoImage} 
                  alt="Chrona Logo" 
                  className="h-20 w-auto -mr-3"
                />
                <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  AI Chrona
                </span>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <CardTitle className="text-2xl">Welcome Back</CardTitle>
                <CardDescription className="text-base">
                  Sign in to your AI-powered school management platform
                </CardDescription>
              </motion.div>
            </CardHeader>
            <CardContent>
              <motion.form 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                onSubmit={handleSubmit} 
                className="space-y-4" 
                data-testid="form-login"
              >
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email / User ID</Label>
                  <Input
                    id="email"
                    type="text"
                    placeholder="Enter your email or user ID"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                    required
                    data-testid="input-email"
                    className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-gray-200/50 focus:border-purple-500 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    data-testid="input-password"
                    className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-gray-200/50 focus:border-purple-500 transition-all"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl" 
                  disabled={loginMutation.isPending}
                  data-testid="button-login"
                >
                  {loginMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <Sparkles className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </motion.form>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex-1 flex items-center justify-center p-8"
        >
          <div className="max-w-2xl w-full">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-center mb-8"
            >
              <div className="flex items-center justify-center mb-6">
                <motion.div
                  animate={{ 
                    rotate: 360,
                    scale: [1, 1.1, 1]
                  }}
                  transition={{ 
                    rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                    scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                  }}
                  className="bg-gradient-to-r from-pink-500 to-purple-600 rounded-full p-4"
                >
                  <Sparkles className="h-8 w-8 text-white" />
                </motion.div>
              </div>
              
              <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-4">
                Smarter School Management, Powered by AI
              </h1>
              <p className="text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
                Automate operations, connect teams, and manage everything with intelligent simplicity.
              </p>
            </motion.div>

            <ChatShowcase />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
