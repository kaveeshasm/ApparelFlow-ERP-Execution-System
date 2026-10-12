"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import "./LogIn.css";

export default function LogIn() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

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

    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        checkExistingAuth();

        const savedEmail = localStorage.getItem("rememberedEmail");

        if (savedEmail) {
            setEmail(savedEmail);
            setRememberMe(true);
        }

        testBackendConnection();
    }, []);

    const checkExistingAuth = () => {
        const authData = localStorage.getItem("authData");

        if (!authData) return;

        try {
            const parsedAuthData = JSON.parse(authData);

            if (
                parsedAuthData.isAuthenticated &&
                parsedAuthData.email
            ) {
                const loginTime = new Date(
                    parsedAuthData.loginTime
                );

                const now = new Date();
                const loginTimeValue = loginTime.getTime();
                const nowValue = now.getTime();

                const hoursDiff =
                    (nowValue - loginTimeValue) /
                    (1000 * 60 * 60);

                if (hoursDiff < 24) {
                    router.replace("/user");
                } else {
                    clearAuthData();
                }
            }
        } catch (error) {
            console.error(
                "Error parsing stored auth data:",
                error
            );

            clearAuthData();
        }
    };

    const clearAuthData = () => {
        localStorage.removeItem("authData");
        localStorage.removeItem("userData");
        localStorage.removeItem("authToken");
        sessionStorage.clear();
    };

    const testBackendConnection = async () => {
        try {
            const response = await fetch(
                "http://localhost:9090/test"
            );

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}`
                );
            }

            console.log("✅ Backend connected");
        } catch (error) {
            console.error(
                "❌ Backend connection failed:",
                error
            );

            setError(
                "Cannot connect to backend. Please ensure the backend is running."
            );
        }
    };

    const validateForm = () => {
        if (!email || !password) {
            setError(
                "Please enter both email and password"
            );
            return false;
        }

        const emailRegex =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            setError(
                "Please enter a valid email address"
            );
            return false;
        }

        if (password.length < 6) {
            setError(
                "Password must be at least 6 characters long"
            );
            return false;
        }

        return true;
    };

    const handleSubmit = async (
        e: React.FormEvent<HTMLFormElement>
    ) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setLoading(true);
        setError("");

        const loginData = {
            email: email.trim().toLowerCase(),
            password: password,
        };

        try {
            const response = await fetch(
                "http://localhost:9090/login",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: "include",
                    body: JSON.stringify(loginData),
                }
            );

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}`
                );
            }

            const data = await response.json();

            if (!response.ok) {
                setError(data.message || `Login failed (HTTP ${response.status})`);
                return;
            }

            if (data.success) {
                const currentTime =
                    new Date().toISOString();

                const authData = {
                    email: loginData.email,
                    isAuthenticated: true,
                    loginTime: currentTime,
                };

                const userData = {
                    id: data.user.id,
                    email: data.user.email,
                    fullName: data.user.full_name,
                    role: data.user.role,
                    loginTime: currentTime,
                    authMethod: "local",
                };

                localStorage.setItem("authData", JSON.stringify(authData));
                localStorage.setItem("userData", JSON.stringify(userData));

                if (rememberMe) {
                    localStorage.setItem("rememberedEmail", loginData.email);
                } else {
                    localStorage.removeItem("rememberedEmail");
                }

                sessionStorage.setItem("userEmail", data.user.email);
                sessionStorage.setItem("username", data.user.full_name);
                sessionStorage.setItem("userRole", data.user.role);
                sessionStorage.setItem("isLoggedIn", "true");
                sessionStorage.setItem("loginTime", currentTime);

                router.replace("/user");
            } else {
                setError(
                    data.message ||
                        "Invalid email or password"
                );
            }
        } catch (error) {
            console.error(
                "❌ Login error:",
                error
            );

            const err =
                error instanceof Error
                    ? error
                    : new Error(String(error));

            let errorMessage =
                "Network error. Please try again.";

            if (
                err.message.includes("Failed to fetch")
            ) {
                errorMessage =
                    "Cannot connect to server. Please ensure the backend is running.";
            } else if (
                err.message.includes("HTTP 500")
            ) {
                errorMessage =
                    "Server error. Please try again later.";
            } else if (
                err.message.includes("HTTP 404")
            ) {
                errorMessage =
                    "Login endpoint not found.";
            }

            setError(errorMessage);
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
                    <div className="login_error">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>

                    <div className="form_group">
                        <label>Email</label>

                        <input
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
                        />
                    </div>

                    <div className="form_group">
                        <label>Password</label>

                        <input
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
                        />
                    </div>

                    <div className="login_options">
                        <label className="remember_me">
                            <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) =>
                                    setRememberMe(
                                        e.target.checked
                                    )
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
                        {loading
                            ? "Logging in..."
                            : "LOGIN"}
                    </button>

                </form>

                <div className="login_or">
                    <span>OR</span>
                </div>

                                <div className="signup_text">
                    Don't have an account?{" "}
                    <Link href="/signup">
                        Sign Up
                    </Link>
                </div>

                {/* Demo Credentials Panel */}
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