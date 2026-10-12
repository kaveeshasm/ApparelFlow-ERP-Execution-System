
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser } from "../../lib/auth";
import "./supervisor.css";

const API_URL = "/api";

type Recipe = {
  id: number;
  recipe_code: string;
  name: string;
  category: string;
  std_fabric_yards: number;
  wastage_cap: number;
};

type CuttingOrder = {
  id: number;
  order_no: string;
  recipe_name: string;
  target_qty: number;
  fabric_roll_id: string;
  actual_fabric_yds: number;
  status: string;
};

export default function SupervisorPage() {
  const router = useRouter();

  const [userName, setUserName] = useState("");
  const [checking, setChecking] = useState(true);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [orders, setOrders] = useState<CuttingOrder[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [recipeId, setRecipeId] = useState("");
  const [targetQty, setTargetQty] = useState("");
  const [fabricRollId, setFabricRollId] = useState("");
  const [actualFabricYds, setActualFabricYds] = useState("");

  useEffect(() => {
    const user = getStoredUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    if (user.role !== "cutting_supervisor") {
      router.replace(
        user.role === "cutting_verifier" ? "/verifier" : "/sewing"
      );
      return;
    }

    setUserName(user.fullName);
    setChecking(false);
    loadRecipes();
  }, [router]);

  async function loadRecipes() {
    setLoadingRecipes(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/recipes`, {
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load recipes.");
      }

      const recipeList = Array.isArray(data)
        ? data
        : data.recipes ?? data.data ?? [];

      setRecipes(recipeList);

      if (recipeList.length > 0) {
        setRecipeId(String(recipeList[0].id));
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load recipes. Check your backend."
      );
    } finally {
      setLoadingRecipes(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const quantity = Number(targetQty);
    const fabricYards = Number(actualFabricYds);
    const selectedRecipe = recipes.find(
      (recipe) => recipe.id === Number(recipeId)
    );

    if (!selectedRecipe) {
      setError("Please select a valid recipe.");
      return;
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      setError("Target quantity must be a positive whole number.");
      return;
    }

    if (!fabricRollId.trim()) {
      setError("Please enter a fabric roll ID.");
      return;
    }

    if (!Number.isFinite(fabricYards) || fabricYards <= 0) {
      setError("Actual fabric yards must be a positive number.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/cutting-orders`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipe_id: Number(recipeId),
          target_qty: quantity,
          fabric_roll_id: fabricRollId.trim(),
          actual_fabric_yds: fabricYards,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to create cutting order.");
      }

      const createdOrder = data.order ?? data.cuttingOrder ?? data.data;
      const orderNo =
        createdOrder?.order_no ??
        createdOrder?.order?.order_no ??
        `Created successfully`;

      setOrders((previous) => [
        {
          id: createdOrder?.id ?? Date.now(),
          order_no: orderNo,
          recipe_name: selectedRecipe.name,
          target_qty: quantity,
          fabric_roll_id: fabricRollId.trim(),
          actual_fabric_yds: fabricYards,
          status: createdOrder?.status ?? "PENDING_VERIFICATION",
        },
        ...previous,
      ]);

      setSuccess(
        `Cutting order created successfully. Order: ${orderNo}`
      );

      setTargetQty("");
      setFabricRollId("");
      setActualFabricYds("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create cutting order."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return <div className="supervisor-loading">Checking access...</div>;
  }

  const pendingCount = orders.filter(
    (order) => order.status === "PENDING_VERIFICATION"
  ).length;

  const verifiedCount = orders.filter(
    (order) => order.status === "VERIFIED"
  ).length;

  const rejectedCount = orders.filter(
    (order) => order.status === "REJECTED"
  ).length;

  return (
    <div className="erp-layout">
      <aside className="erp-sidebar">
        <div className="erp-brand">
          <div className="erp-brand-icon">A</div>
          <div>
            <h2>ApparelFlow</h2>
            <span>ERP SYSTEM</span>
          </div>
        </div>

        <div className="sidebar-label">WORKSPACE</div>

        <nav className="erp-nav">
          <a className="nav-item active" href="#overview">
            <span>▦</span> Dashboard
          </a>
          <a className="nav-item" href="#create-order">
            <span>＋</span> Create Cutting Order
          </a>
          <a className="nav-item" href="#order-history">
            <span>☷</span> Order History
          </a>
        </nav>

        <div className="sidebar-bottom">
          <div className="user-avatar">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="sidebar-user">
            <strong>{userName}</strong>
            <span>Cutting Supervisor</span>
          </div>
          <button
            className="logout-button"
            title="Log out"
            onClick={() => {
              localStorage.removeItem("authData");
              localStorage.removeItem("userData");
              sessionStorage.clear();
              router.replace("/login");
            }}
          >
            ↪
          </button>
        </div>
      </aside>

      <main className="erp-main">
        <header className="erp-topbar">
          <div>
            <div className="breadcrumb">Workspace / Dashboard</div>
            <h1>Cutting Supervisor Dashboard</h1>
          </div>
          <div className="topbar-role">
            <span className="online-dot" />
            Cutting Department
          </div>
        </header>

        <section id="overview" className="erp-content">
          <div className="welcome-section">
            <div>
              <h2>Welcome back, {userName} 👋</h2>
              <p>Manage cutting orders and track production progress.</p>
            </div>
            <button
              className="primary-button"
              onClick={() =>
                document
                  .getElementById("create-order")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              + New Cutting Order
            </button>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-top">
                <span>Total Created</span>
                <span className="stat-icon purple">▦</span>
              </div>
              <strong>{orders.length}</strong>
              <small>Created this session</small>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <span>Pending Verification</span>
                <span className="stat-icon orange">◷</span>
              </div>
              <strong>{pendingCount}</strong>
              <small>Awaiting physical count</small>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <span>Verified</span>
                <span className="stat-icon green">✓</span>
              </div>
              <strong>{verifiedCount}</strong>
              <small>Approved for sewing</small>
            </div>

            <div className="stat-card">
              <div className="stat-top">
                <span>Rejected</span>
                <span className="stat-icon red">!</span>
              </div>
              <strong>{rejectedCount}</strong>
              <small>Require attention</small>
            </div>
          </div>

          <section id="create-order" className="panel">
            <div className="panel-heading">
              <div>
                <h2>Create Cutting Order</h2>
                <p>Enter production details to submit a new batch.</p>
              </div>
              <span className="required-note">* Required fields</span>
            </div>

            {error && (
              <div className="notice error-notice" role="alert">
                {error}
              </div>
            )}

            {success && (
              <div className="notice success-notice" role="status">
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="erp-field">
                  <label htmlFor="recipe">Production Recipe *</label>
                  <select
                    id="recipe"
                    value={recipeId}
                    onChange={(e) => setRecipeId(e.target.value)}
                    disabled={loadingRecipes || recipes.length === 0}
                    required
                  >
                    {loadingRecipes && <option>Loading recipes...</option>}
                    {!loadingRecipes && recipes.length === 0 && (
                      <option value="">No recipes available</option>
                    )}
                    {recipes.map((recipe) => (
                      <option key={recipe.id} value={recipe.id}>
                        {recipe.recipe_code} — {recipe.name}
                      </option>
                    ))}
                  </select>
                  {recipeId && (
                    <small>
                      Standard fabric:{" "}
                      {recipes.find((r) => r.id === Number(recipeId))
                        ?.std_fabric_yards ?? "—"}{" "}
                      yards per garment
                    </small>
                  )}
                </div>

                <div className="erp-field">
                  <label htmlFor="targetQty">Target Quantity *</label>
                  <input
                    id="targetQty"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="e.g. 100"
                    value={targetQty}
                    onChange={(e) => setTargetQty(e.target.value)}
                    required
                  />
                  <small>Enter the number of garments to cut.</small>
                </div>

                <div className="erp-field">
                  <label htmlFor="fabricRollId">Fabric Roll ID *</label>
                  <input
                    id="fabricRollId"
                    type="text"
                    placeholder="e.g. ROLL-001"
                    value={fabricRollId}
                    onChange={(e) => setFabricRollId(e.target.value)}
                    required
                  />
                  <small>Use the identifier printed on the fabric roll.</small>
                </div>

                <div className="erp-field">
                  <label htmlFor="actualFabricYds">
                    Actual Fabric Used (yards) *
                  </label>
                  <input
                    id="actualFabricYds"
                    type="number"
                    min="0.01"
                    step="any"
                    placeholder="e.g. 185"
                    value={actualFabricYds}
                    onChange={(e) => setActualFabricYds(e.target.value)}
                    required
                  />
                  <small>Enter the actual fabric consumed.</small>
                </div>
              </div>

              {recipeId && targetQty && Number(targetQty) > 0 && (
                <div className="fabric-estimate">
                  <span>Expected fabric requirement</span>
                  <strong>
                    {(
                      (recipes.find((r) => r.id === Number(recipeId))
                        ?.std_fabric_yards ?? 0) * Number(targetQty)
                    ).toFixed(2)}{" "}
                    yards
                  </strong>
                </div>
              )}

              <div className="form-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    setTargetQty("");
                    setFabricRollId("");
                    setActualFabricYds("");
                    setError("");
                    setSuccess("");
                  }}
                >
                  Clear Form
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={
                    submitting ||
                    loadingRecipes ||
                    recipes.length === 0
                  }
                >
                  {submitting ? "Submitting..." : "Submit Cutting Order →"}
                </button>
              </div>
            </form>
          </section>

          <section id="order-history" className="panel history-panel">
            <div className="panel-heading">
              <div>
                <h2>Recently Created Orders</h2>
                <p>Orders submitted during this page session.</p>
              </div>
              <span className="count-pill">{orders.length} orders</span>
            </div>

            {orders.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">☷</div>
                <h3>No orders created in this session</h3>
                <p>Create a cutting order to see it listed here.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="orders-table">
                  <thead>
                    <tr>
                      <th>Order Number</th>
                      <th>Recipe</th>
                      <th>Quantity</th>
                      <th>Fabric Roll</th>
                      <th>Fabric Used</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td className="order-number">{order.order_no}</td>
                        <td>{order.recipe_name}</td>
                        <td>{order.target_qty}</td>
                        <td>{order.fabric_roll_id}</td>
                        <td>{order.actual_fabric_yds} yd</td>
                        <td>
                          <span
                            className={`status-badge ${order.status.toLowerCase()}`}
                          >
                            {order.status.replaceAll("_", " ")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}
