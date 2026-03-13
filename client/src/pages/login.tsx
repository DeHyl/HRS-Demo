import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Loader2, Eye, EyeOff } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

function GametimeLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sq = size === "lg" ? "w-4 h-4" : size === "sm" ? "w-2 h-2" : "w-3 h-3";
  const text = size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-lg";
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        <div className={`${sq} rounded-sm`} style={{ backgroundColor: "#EF4444" }} />
        <div className={`${sq} rounded-sm`} style={{ backgroundColor: "#EAB308" }} />
        <div className={`${sq} rounded-sm`} style={{ backgroundColor: "#3B82F6" }} />
      </div>
      <span className={`text-white font-bold ${text} tracking-tight`}>GameTime.ai</span>
    </div>
  );
}

function AnimatedBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-black" />
      {Array.from({ length: 50 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: `${Math.random() * 2 + 1}px`,
            height: `${Math.random() * 2 + 1}px`,
            backgroundColor: Math.random() > 0.6 ? "#4A6CF7" : "#ffffff",
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            opacity: Math.random() * 0.3 + 0.1,
            animation: `twinkle ${2 + Math.random() * 4}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 3}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      await login(data.email, data.password);
      toast({ title: "Welcome back!", description: "You have successfully logged in." });
      setLocation("/dashboard");
    } catch (error) {
      toast({
        title: "Login failed",
        description: error instanceof Error ? error.message : "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — Gametime brand */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <AnimatedBackground />

        <div className="absolute inset-0 flex flex-col z-10 p-10">
          <GametimeLogo size="md" />

          <div className="flex-1 flex flex-col items-start justify-center max-w-md">
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-8">
              <div className="flex gap-0.5">
                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: "#EF4444" }} />
                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: "#EAB308" }} />
                <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: "#3B82F6" }} />
              </div>
              <span className="text-white/60 text-xs">GameTime.ai</span>
            </div>

            <h1 className="text-5xl xl:text-6xl font-display font-black text-white mb-4 tracking-tighter leading-none">
              Lead<br />
              <span style={{ color: "#4A6CF7" }}>Intel</span>
            </h1>
            <p className="text-lg text-white/50 font-sans leading-relaxed mb-10">
              AI-powered pre-call intelligence that makes every rep unstoppable.
            </p>

            {/* Feature cards mini */}
            <div className="grid grid-cols-2 gap-3 w-full">
              {[
                { label: "Smart Call Queue", color: "#3B82F6" },
                { label: "AI Call Analysis", color: "#3B82F6" },
                { label: "SDR Leaderboard", color: "#EAB308" },
                { label: "Manager Dashboard", color: "#EF4444" },
              ].map((f) => (
                <div key={f.label} className="bg-white/5 border border-white/10 rounded-xl p-3">
                  <div className="w-6 h-0.5 mb-2 rounded-full" style={{ backgroundColor: f.color }} />
                  <p className="text-white/80 text-xs font-medium">{f.label}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-white/20 text-xs">© 2026 GroundGame. All rights reserved.</p>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-background relative">
        <div className="absolute inset-0 bg-dots opacity-[0.02]" />

        <div className="w-full max-w-md relative z-10">
          <div className="mb-10 text-center lg:text-left animate-fade-in-down">
            <div className="flex items-center gap-2 mb-2 justify-center lg:justify-start lg:hidden">
              <GametimeLogo size="sm" />
            </div>
            <h2 className="text-4xl font-display font-bold text-foreground mb-2 tracking-tight">Welcome back</h2>
            <p className="text-lg text-muted-foreground">Sign in to access your dashboard</p>
          </div>

          <Card className="border-0 lg:border lg:border-border/50 lg:shadow-xl lg:bg-card/95 lg:backdrop-blur-sm rounded-2xl animate-fade-in-up">
            <CardContent className="pt-6 lg:pt-8 px-0 lg:px-8">
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-base font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    autoComplete="email"
                    className="h-12 text-base"
                    {...form.register("email")}
                    data-testid="input-email"
                  />
                  {form.formState.errors.email && (
                    <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-base font-medium">Password</Label>
                    <Link
                      href="/forgot-password"
                      className="text-sm text-primary hover:text-primary/80 hover:underline transition-colors"
                      data-testid="link-forgot-password"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      className="h-12 pr-12 text-base"
                      {...form.register("password")}
                      data-testid="input-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      data-testid="button-toggle-password"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {form.formState.errors.password && (
                    <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="cta"
                  className="w-full h-12 text-base"
                  disabled={isLoading}
                  data-testid="button-submit"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 pt-6 px-0 lg:px-8 lg:pb-8">
              <div className="text-center text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link href="/signup" className="text-primary hover:text-primary/80 hover:underline font-semibold transition-colors" data-testid="link-signup">
                  Sign up
                </Link>
              </div>
              <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-back">
                ← Back to home
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
