import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LogIn, Mail } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/authStore";

const schema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type Form = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginError } = useAuth();
  const isAuthenticated = useAuthStore((s) => s.accessToken !== null);

  // Where the user was heading before the guard bounced them here.
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  if (isAuthenticated) return <Navigate to={from} replace />;

  return (
    <div className="mx-auto max-w-md space-y-6 py-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Sign in</h1>
        <p className="mt-1 text-sm text-zinc-500">Welcome back.</p>
      </div>

      <Card>
        <CardBody>
          <form
            onSubmit={handleSubmit((values) =>
              login.mutate(values, { onSuccess: () => navigate(from, { replace: true }) }),
            )}
            className="space-y-4"
          >
            {loginError && (
              <Alert tone="error" title="Could not sign in">
                {loginError.message}
                {/* The backend rate-limits by email after five failures. Surfacing the
                    wait avoids a user hammering a locked account. */}
                {loginError.code === "rate_limited" &&
                  typeof loginError.details?.retry_after_seconds === "number" && (
                    <p className="mt-1">
                      Try again in about{" "}
                      {Math.ceil((loginError.details.retry_after_seconds as number) / 60)}{" "}
                      minutes.
                    </p>
                  )}
              </Alert>
            )}

            <Input
              label="Email"
              type="email"
              autoComplete="email"
              required
              leftIcon={<Mail className="h-4 w-4" />}
              error={errors.email?.message}
              {...register("email")}
            />

            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              error={errors.password?.message}
              {...register("password")}
            />

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={login.isPending}
              leftIcon={<LogIn className="h-4 w-4" />}
            >
              Sign in
            </Button>
          </form>
        </CardBody>
      </Card>

      <p className="text-center text-sm text-zinc-500">
        No account?{" "}
        <Link to="/register" className="font-medium text-brand-600 hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
