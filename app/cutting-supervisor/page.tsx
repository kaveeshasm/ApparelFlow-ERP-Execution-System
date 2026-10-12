"use client";

import { FormEvent, useEffect, useState } from "react";

interface Recipe {
  id: number;
  recipe_code: string;
  name: string;
  category?: string;
  std_fabric_yards: number | string;
  wastage_cap?: number | string;
}

interface CuttingOrder {
  id: number;
  order_no: string;
  recipe_id: number;
  recipe_code?: string;
  recipe_name?: string;
  target_qty: number;
  fabric_roll_id: string;
  actual_fabric_yds: number | string;
  status: string;
  created_at?: string;
}

const API_URL = "/api";

export default function CuttingSupervisorPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [orders, setOrders] = useState<CuttingOrder[]>([]);

  const [recipeId, setRecipeId] = useState("");
  const [targetQty, setTargetQty] = useState("");
  const [fabricRollId, setFabricRollId] = useState("");
  const [actualFabricYds, setActualFabricYds] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadRecipes() {
    const response = await fetch(`${API_URL}/recipes`, {
      credentials: "include",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to load recipes");
    }

    const recipeList: Recipe[] = Array.isArray(data)
      ? data
      : data.recipes || data.data || [];

    setRecipes(recipeList);
  }

  async function loadOrders() {
    const response = await fetch(`${API_URL}/cutting-orders`, {
      credentials: "include",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to load cutting orders");
    }

    setOrders(data.orders || []);
  }

  useEffect(() => {
    async function initialize() {
      try {
        setError("");
        await Promise.all([loadRecipes(), loadOrders()]);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load dashboard data"
        );
      } finally {
        setLoading(false);
      }
    }

    initialize();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const parsedRecipeId = Number(recipeId);
    const parsedTargetQty = Number(targetQty);
    const parsedFabricYds = Number(actualFabricYds);

    if (!Number.isInteger(parsedRecipeId) || parsedRecipeId <= 0) {
      setError("Please select a valid recipe.");
      return;
    }

    if (!Number.isInteger(parsedTargetQty) || parsedTargetQty <= 0) {
      setError("Target quantity must be a positive whole number.");
      return;
    }

    if (!fabricRollId.trim()) {
      setError("Please enter a fabric roll ID.");
      return;
    }

    if (!Number.isFinite(parsedFabricYds) || parsedFabricYds <= 0) {
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
          recipe_id: parsedRecipeId,
          target_qty: parsedTargetQty,
          fabric_roll_id: fabricRollId.trim(),
          actual_fabric_yds: parsedFabricYds,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create cutting order");
      }

      setSuccess(
        `Cutting order ${data.order?.order_no || ""} created successfully.`
      );

      setRecipeId("");
      setTargetQty("");
      setFabricRollId("");
      setActualFabricYds("");

      await loadOrders();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred"
      );
    } finally {
      setSubmitting(false);
    }
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
    <main className="mx-auto min-h-screen max-w-7xl bg-gray-50 p-6 text-gray-900 md:p-10">
      <header className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-teal-700">
          ApparelFlow ERP
        </p>
        <h1 className="mt-2 text-3xl font-bold">
          Cutting Supervisor Dashboard
        </h1>
        <p className="mt-2 text-gray-600">
          Create cutting orders and monitor their verification status.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="mb-5 rounded-lg border border-green-300 bg-green-50 p-4 text-green-800"
        >
          {success}
        </div>
      )}

      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Orders", value: orders.length },
          { label: "Pending Verification", value: pendingCount },
          { label: "Verified", value: verifiedCount },
          { label: "Rejected", value: rejectedCount },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-medium text-gray-600">
              {item.label}
            </p>
            <p className="mt-2 text-3xl font-bold">{item.value}</p>
          </div>
        ))}
      </section>

      <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-xl font-bold">Create Cutting Order</h2>
        <p className="mb-6 text-sm text-gray-600">
          Enter the recipe, production quantity, and fabric details.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="recipe"
              className="mb-2 block text-sm font-semibold"
            >
              Recipe <span className="text-red-600">*</span>
            </label>
            <select
              id="recipe"
              value={recipeId}
              onChange={(event) => setRecipeId(event.target.value)}
              required
              disabled={loading || submitting}
              className="w-full rounded-lg border border-gray-300 bg-white p-3 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            >
              <option value="">Select a recipe</option>
              {recipes.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.recipe_code} — {recipe.name}
                </option>
              ))}
            </select>
          </div>

          {recipeId && (
            <div className="rounded-lg bg-teal-50 p-4 text-sm text-teal-900">
              {(() => {
                const selectedRecipe = recipes.find(
                  (recipe) => recipe.id === Number(recipeId)
                );

                if (!selectedRecipe) return null;

                return (
                  <>
                    <p>
                      <strong>Recipe:</strong> {selectedRecipe.name}
                    </p>
                    <p>
                      <strong>Standard fabric:</strong>{" "}
                      {selectedRecipe.std_fabric_yards} yards per garment
                    </p>
                    {selectedRecipe.wastage_cap !== undefined && (
                      <p>
                        <strong>Wastage cap:</strong>{" "}
                        {selectedRecipe.wastage_cap}%
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div>
              <label
                htmlFor="targetQty"
                className="mb-2 block text-sm font-semibold"
              >
                Target Quantity <span className="text-red-600">*</span>
              </label>
              <input
                id="targetQty"
                type="number"
                min="1"
                step="1"
                value={targetQty}
                onChange={(event) => setTargetQty(event.target.value)}
                required
                disabled={submitting}
                placeholder="e.g. 100"
                className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
            </div>

            <div>
              <label
                htmlFor="fabricRoll"
                className="mb-2 block text-sm font-semibold"
              >
                Fabric Roll ID <span className="text-red-600">*</span>
              </label>
              <input
                id="fabricRoll"
                type="text"
                value={fabricRollId}
                onChange={(event) => setFabricRollId(event.target.value)}
                required
                disabled={submitting}
                placeholder="e.g. ROLL-003"
                className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="actualFabric"
              className="mb-2 block text-sm font-semibold"
            >
              Actual Fabric Used (yards){" "}
              <span className="text-red-600">*</span>
            </label>
            <input
              id="actualFabric"
              type="number"
              min="0.01"
              step="any"
              value={actualFabricYds}
              onChange={(event) => setActualFabricYds(event.target.value)}
              required
              disabled={submitting}
              placeholder="e.g. 185"
              className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || loading}
            className="rounded-lg bg-teal-700 px-6 py-3 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Creating Order..." : "Create Cutting Order"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Cutting Orders</h2>
            <p className="mt-1 text-sm text-gray-600">
              Orders created by your account.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError("");
              loadOrders()
                .catch((err) =>
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Failed to refresh orders"
                  )
                )
                .finally(() => setLoading(false));
            }}
            disabled={loading}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-gray-50 disabled:opacity-60"
          >
            Refresh Orders
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-gray-600">
            Loading cutting orders...
          </p>
        ) : orders.length === 0 ? (
          <p className="py-8 text-center text-gray-600">
            No cutting orders found. Create your first order above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="p-3 font-semibold">Order No.</th>
                  <th className="p-3 font-semibold">Recipe</th>
                  <th className="p-3 font-semibold">Target Qty</th>
                  <th className="p-3 font-semibold">Fabric Roll</th>
                  <th className="p-3 font-semibold">Fabric (yds)</th>
                  <th className="p-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="p-3 font-medium">{order.order_no}</td>
                    <td className="p-3">
                      {order.recipe_name || order.recipe_code || order.recipe_id}
                    </td>
                    <td className="p-3">{order.target_qty}</td>
                    <td className="p-3">{order.fabric_roll_id}</td>
                    <td className="p-3">{order.actual_fabric_yds}</td>
                    <td className="p-3">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          order.status === "VERIFIED"
                            ? "bg-green-100 text-green-800"
                            : order.status === "REJECTED"
                              ? "bg-red-100 text-red-800"
                              : order.status === "PENDING_VERIFICATION"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-gray-100 text-gray-800"
                        }`}
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
    </main>
  );
}