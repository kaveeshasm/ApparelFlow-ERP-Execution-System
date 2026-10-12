
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import "./LogIn.css";

type UserRole =
  | "cutting_supervisor"
  | "cutting_verifier"
  | "sewing_supervisor";

type LoginResponse = {
  success: boolean;
  message?: string;
  user?: {
    id: number;
    email: string;
    full_name: string;
    role: UserRole;
  };
};

const roleRoutes: Record<UserRole, string> = {
  cutting_supervisor: "/supervisor",
  cutting_verifier: "/verifier",
  sewing_supervisor: "/sewing",
};

const demoCredentials = [
  {
    role: "Cutting Supervisor",
    email: "supervisor@apparelflow.com",
    password: "ChangeMe123!",
  },
  {
    role: "Cutting Verifier",
    email: "verifier@apparelflow.com",
    password: "ChangeMe123!",
  },
  {
    role: "Sewing Supervisor",
    email: "sewing@apparelflow.com",
    password: "ChangeMe123!",
  },
];

export default function LogIn() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem("rememberedEmail");

    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }

    testBackendConnection();
  }, []);

  const testBackendConnection = async () => {
    try {
      const response = await fetch("/api/test");

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      console.log("Backend connected");
    } catch (error) {
      console.error("Backend connection failed:", error);
      setError(
        "Cannot connect to backend. Please ensure the backend is running."
      );
    }
  };

  const validateForm = () => {
    if (!email.trim() || !password) {
      setError("Please enter both email and password");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email.trim())) {
      setError("Please enter a valid email address");
      return false;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long");
      return false;
    }

    return true;
  };

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setError("");

    const loginData = {
      email: email.trim().toLowerCase(),
      password,
    };

    try {
      const response = await fetch(
        "/api/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(loginData),
        }
      );

      const data: LoginResponse = await response.json();

      if (!response.ok || !data.success || !data.user) {
        setError(
          data.message ||
            `Login failed (HTTP ${response.status})`
        );
        return;
      }

      const user = data.user;
      const destination = roleRoutes[user.role];

      if (!destination) {
        setError("Your account does not have a valid role.");
        return;
      }

      const currentTime = new Date().toISOString();

      const authData = {
        email: user.email,
        isAuthenticated: true,
        loginTime: currentTime,
      };

      const userData = {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        loginTime: currentTime,
        authMethod: "local",
      };

      localStorage.setItem(
        "authData",
        JSON.stringify(authData)
      );

      localStorage.setItem(
        "userData",
        JSON.stringify(userData)
      );

      if (rememberMe) {
        localStorage.setItem(
          "rememberedEmail",
          loginData.email
        );
      } else {
        localStorage.removeItem("rememberedEmail");
      }

      sessionStorage.setItem("userEmail", user.email);
      sessionStorage.setItem("username", user.full_name);
      sessionStorage.setItem("userRole", user.role);
      sessionStorage.setItem("isLoggedIn", "true");
      sessionStorage.setItem("loginTime", currentTime);

      router.replace(destination);
    } catch (error) {
      console.error("Login error:", error);

      setError(
        error instanceof Error &&
          error.message.includes("Failed to fetch")
          ? "Cannot connect to server. Please ensure the backend is running."
          : "A network error occurred. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login_page">
      <div className="login_container">
        <div className="login_container_topic">
          <h1>Login</h1>
          <p>Welcome back! Please login to your account.</p>
        </div>

        {error && (
          <div className="login_error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form_group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className="login_input"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
              disabled={loading}
              autoComplete="email"
              required
            />
          </div>

          <div className="form_group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="login_input"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
              disabled={loading}
              autoComplete="current-password"
              required
            />
          </div>

          <div className="login_options">
            <label className="remember_me">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) =>
                  setRememberMe(e.target.checked)
                }
                disabled={loading}
              />
              <span>Remember Me</span>
            </label>

            <Link
              href="/forgot-password"
              className="forgot_password"
            >
              Forgot Password?
            </Link>
          </div>

          <button
            type="submit"
            className="login_button"
            disabled={loading}
          >
            {loading ? "Logging in..." : "LOGIN"}
          </button>
        </form>

        <div className="login_or">
          <span>OR</span>
        </div>

        <div className="signup_text">
          Don't have an account?{" "}
          <Link href="/signup">Sign Up</Link>
        </div>

        <div className="demo-credentials">
          <h3>Demo Credentials</h3>
          <p>Select a role to fill in the login details.</p>

          {demoCredentials.map((demo) => (
            <button
              key={demo.role}
              type="button"
              className="demo-credential-card"
              onClick={() => {
                setEmail(demo.email);
                setPassword(demo.password);
                setError("");
              }}
              disabled={loading}
            >
              <strong>{demo.role}</strong>
              <span>{demo.email}</span>
              <small>Click to use this account</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
