import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, UserPlus } from "lucide-react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/authStore";

/**
 * Mirrors the backend's `RegisterRequest` validators, so a user is told about a weak
 * password before a round trip rather than after a 422.
 *
 * Note there is no `role` field here — and there is none on the backend either. Signup
 * always creates a customer, so there is no request a client could craft to make
 * themselves an admin.
 */
const schema = z
  .object({
    full_name: z.string().trim().min(1, "Name is required").max(200),
    email: z.string().min(1, "Email is required").email("Enter a valid email"),
    password: z
      .string()
      .min(8, "Use at least 8 characters")
      // bcrypt silently truncates past 72 bytes, so the backend rejects longer
      // passwords rather than making two different ones interchangeable.
      .max(72, "Use at most 72 characters")
      .refine(
        (value) => !/^\d+$/.test(value) && !/^[A-Za-z]+$/.test(value),
        "Mix letters with digits or symbols",
      ),
    confirm: z.string().min(1, "Confirm your password"),
  })
  .refine((values) => values.password === values.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

type Form = z.infer<typeof schema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const { register: registerUser, login, registerError } = useAuth();
  const isAuthenticated = useAuthStore((s) => s.accessToken !== null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  if (isAuthenticated) return <Navigate to="/" replace />;

  async function onSubmit(values: Form) {
    setSubmitting(true);
    try {
      await registerUser.mutateAsync({
        email: values.email,
        password: values.password,
        full_name: values.full_name,
      });
      // Sign in straight away — making someone type the same credentials again
      // immediately after creating them is pointless friction.
      await login.mutateAsync({ email: values.email, password: values.password });
      navigate("/", { replace: true });
    } catch {
      // Surfaced through registerError / loginError below.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Create an account</h1>
        <p className="mt-1 text-sm text-zinc-500">It takes a moment.</p>
      </div>

      <Card>
        <CardBody>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {registerError && (
              <Alert tone="error" title="Could not create the account">
                {registerError.code === "conflict"
                  ? "An account with that email already exists."
                  : registerError.message}
              </Alert>
            )}

            <Input
              label="Full name"
              autoComplete="name"
              required
              error={errors.full_name?.message}
              {...register("full_name")}
            />

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
              autoComplete="new-password"
              required
              hint="At least 8 characters, mixing letters with digits or symbols."
              error={errors.password?.message}
              {...register("password")}
            />

            <Input
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              required
              error={errors.confirm?.message}
              {...register("confirm")}
            />

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={submitting}
              leftIcon={<UserPlus className="h-4 w-4" />}
            >
              Create account
            </Button>
          </form>
        </CardBody>
      </Card>

      <p className="text-center text-sm text-zinc-500">
        Already registered?{" "}
        <Link to="/login" className="font-medium text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
