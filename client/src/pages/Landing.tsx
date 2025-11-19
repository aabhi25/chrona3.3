import { Button } from "@/components/ui/button";
import { Sparkles, Bot, Newspaper, Check, Play, LogIn } from "lucide-react";
import logoImage from "@assets/chrona-logo.png";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10">
      <div className="container mx-auto px-6 py-16">
        {/* Header */}
        <header className="text-center mb-16">
          <div className="flex items-center justify-center gap-0 mb-6">
            <img 
              src={logoImage} 
              alt="Chrona Logo" 
              className="h-16 w-auto -mr-3"
            />
            <div>
              <h1 className="text-lg md:text-xl font-semibold">AI Chrona</h1>
              <p className="text-muted-foreground">AI Powered School Management Solution</p>
            </div>
          </div>
          
          <h2 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-700 bg-clip-text text-transparent">
            Transform Education with AI Intelligence
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Experience the future of school management with AI-powered automation, intelligent chat assistance, 
            real-time newsfeeds, and comprehensive educational tools - all unified in one advanced platform.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-8 py-3" asChild>
              <a href="/api/login" data-testid="button-login">
                <LogIn className="mr-2 h-5 w-5" />
                Sign In with Replit
              </a>
            </Button>
            <Button variant="outline" size="lg" className="text-lg px-8 py-3" asChild>
              <a href="/dashboard" data-testid="button-demo">
                <Play className="mr-2 h-5 w-5" />
                View Demo
              </a>
            </Button>
          </div>
        </header>

        {/* Features */}
        <section className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-card p-8 rounded-xl border border-border text-center hover:shadow-lg transition-shadow">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-3">AI-Powered Scheduling</h3>
            <p className="text-muted-foreground">
              Generate optimal timetables automatically using advanced AI algorithms and constraint optimization
            </p>
          </div>
          
          <div className="bg-card p-8 rounded-xl border border-border text-center hover:shadow-lg transition-shadow">
            <div className="w-16 h-16 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bot className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-3">AI Chroney Chat</h3>
            <p className="text-muted-foreground">
              Get instant help with intelligent chat assistance for school operations, scheduling, and management
            </p>
          </div>
          
          <div className="bg-card p-8 rounded-xl border border-border text-center hover:shadow-lg transition-shadow">
            <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Newspaper className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold mb-3">School & Class Newsfeed</h3>
            <p className="text-muted-foreground">
              Stay connected with real-time updates, announcements, and communications across your institution
            </p>
          </div>
        </section>

        {/* Benefits */}
        <section className="grid md:grid-cols-2 gap-12 items-center mb-16">
          <div>
            <h3 className="text-3xl font-bold mb-6">Why Choose Chrona?</h3>
            <div className="space-y-2">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
                <div>
                  <h4 className="font-semibold">Constraint-Based Optimization</h4>
                  <p className="text-muted-foreground">Ensures no teacher conflicts and balanced workload distribution</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
                <div>
                  <h4 className="font-semibold">Multi-Role Access</h4>
                  <p className="text-muted-foreground">Designed for administrators, teachers, students, and parents</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
                <div>
                  <h4 className="font-semibold">Real-time Updates</h4>
                  <p className="text-muted-foreground">Instant notifications for schedule changes</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-card p-8 rounded-xl border border-border">
            <div className="grid grid-cols-2 gap-6 text-center">
              <div>
                <div className="text-3xl font-bold text-primary mb-2">100%</div>
                <div className="text-muted-foreground">Conflict-Free</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-green-600 mb-2">50%</div>
                <div className="text-muted-foreground">Time Saved</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-blue-600 mb-2">24/7</div>
                <div className="text-muted-foreground">Availability</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-purple-600 mb-2">∞</div>
                <div className="text-muted-foreground">Flexibility</div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="text-center">
          <div className="bg-card p-12 rounded-xl border border-border">
            <h3 className="text-3xl font-bold mb-4">Ready to Transform Your School Scheduling?</h3>
            <p className="text-muted-foreground text-lg mb-8">
              Join thousands of schools already using Chrona for smarter timetable management
            </p>
            <Button size="lg" className="text-lg px-12 py-4" asChild>
              <a href="/api/login" data-testid="button-get-started">
                Get Started Now
              </a>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}