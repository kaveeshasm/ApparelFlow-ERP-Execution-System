
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = "http://localhost:9090";

type ComponentVariance = {
  component_name: string;
  expected_qty: number;
  actual_qty: number;
  variance: number;
  status: "GREEN" | "YELLOW" | "RED";
};

type SewingOrder = {
  order_id: number;
  order_no: string;
  recipe_name: string;
  category: string;
  target_qty: number;
  fabric_roll_id: string;
  actual_fabric_yds: string;
  status: "VERIFIED" | "SEWING_IN_PROGRESS";
  created_at: string;
  verifier_id: number;
  verified_at: string;
  wastage_pct: string;
  component_variances: ComponentVariance[];
};

export default function SewingSupervisorPage() {
  const router = useRouter();

  const [orders, setOrders] = useState<SewingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingId, setStartingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/sewing-queue`, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const data = await response.json();

      if (response.status === 401 || response.status === 403) {
        setError("Please log in as the Sewing Supervisor.");
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to load sewing queue.");
      }

      setOrders(data.orders ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to the backend."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const startSewing = async (orderId: number) => {
    setStartingId(orderId);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API_URL}/sewing-queue/${orderId}/start`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to start sewing.");
      }

      setMessage(`Sewing started for order ${orderId}.`);
      await loadOrders();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to start sewing."
      );
    } finally {
      setStartingId(null);
    }
  };

  const verifiedCount = orders.filter(
    (order) => order.status === "VERIFIED"
  ).length;

  const inProgressCount = orders.filter(
    (order) => order.status === "SEWING_IN_PROGRESS"
  ).length;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-slate-950 px-6 py-5 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">ApparelFlow ERP</h1>
            <p className="mt-1 text-sm text-slate-300">
              Sewing Supervisor Dashboard
            </p>
          </div>

          <button
            onClick={loadOrders}
            disabled={loading}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh Queue"}
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800"
          >
            {error}
            {error.includes("log in") && (
              <button
                onClick={() => router.push("/login")}
                className="ml-3 font-bold underline"
              >
                Go to login
              </button>
            )}
          </div>
        )}

        {message && (
          <div
            role="status"
            className="rounded-lg border border-green-300 bg-green-50 p-4 text-green-800"
          >
            {message}
          </div>
        )}

        <div>
          <h2 className="text-xl font-bold">Verified Sewing Queue</h2>
          <p className="mt-1 text-sm text-slate-600">
            Only orders approved by the Cutting Verifier are available here.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard title="Orders in Queue" value={orders.length} />
          <SummaryCard title="Ready to Start" value={verifiedCount} />
          <SummaryCard title="Sewing in Progress" value={inProgressCount} />
        </div>

        {loading ? (
          <div className="rounded-xl bg-white p-8 text-center text-slate-600 shadow-sm">
            Loading sewing queue...
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-xl bg-white p-8 text-center shadow-sm">
            <h3 className="font-semibold">No verified orders available</h3>
            <p className="mt-2 text-sm text-slate-600">
              Approved cutting orders will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <article
                key={order.order_id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 p-5">
                  <div>
                    <p className="text-sm font-medium text-slate-500">
                      {order.order_no}
                    </p>
                    <h3 className="mt-1 text-lg font-bold">
                      {order.recipe_name}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {order.category} · Target quantity: {order.target_qty}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-sm font-semibold ${
                      order.status === "VERIFIED"
                        ? "bg-green-100 text-green-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {order.status.replaceAll("_", " ")}
                  </span>
                </div>

                <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
                  <Info label="Fabric Roll" value={order.fabric_roll_id} />
                  <Info
                    label="Actual Fabric"
                    value={`${Number(order.actual_fabric_yds).toFixed(2)} yards`}
                  />
                  <Info label="Verified By (User ID)" value={order.verifier_id} />
                  <Info
                    label="Fabric Wastage"
                    value={`${Number(order.wastage_pct).toFixed(2)}%`}
                  />
                  <Info
                    label="Verification Date"
                    value={
                      order.verified_at
                        ? new Date(order.verified_at).toLocaleString()
                        : "Not available"
                    }
                  />
                </div>

                <div className="px-5 pb-5">
                  <h4 className="mb-3 font-semibold">
                    Component Verification Audit
                  </h4>

                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead className="bg-slate-100 text-slate-700">
                        <tr>
                          <th className="px-4 py-3">Component</th>
                          <th className="px-4 py-3">Expected</th>
                          <th className="px-4 py-3">Actual</th>
                          <th className="px-4 py-3">Variance</th>
                          <th className="px-4 py-3">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {order.component_variances?.map((component, index) => (
                          <tr
                            key={`${component.component_name}-${index}`}
                            className="border-t border-slate-200"
                          >
                            <td className="px-4 py-3 font-medium">
                              {component.component_name}
                            </td>
                            <td className="px-4 py-3">
                              {component.expected_qty}
                            </td>
                            <td className="px-4 py-3">
                              {component.actual_qty}
                            </td>
                            <td className="px-4 py-3">
                              {component.variance > 0 ? "+" : ""}
                              {component.variance}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`rounded-full px-2 py-1 text-xs font-bold ${
                                  component.status === "GREEN"
                                    ? "bg-green-100 text-green-800"
                                    : component.status === "YELLOW"
                                      ? "bg-yellow-100 text-yellow-900"
                                      : "bg-red-100 text-red-800"
                                }`}
                              >
                                {component.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-slate-600">
                      Review the verification audit before proceeding.
                    </p>

                    {order.status === "VERIFIED" ? (
                      <button
                        onClick={() => startSewing(order.order_id)}
                        disabled={startingId !== null}
                        className="rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {startingId === order.order_id
                          ? "Starting..."
                          : "Start Sewing"}
                      </button>
                    ) : (
                      <span className="rounded-lg bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800">
                        Sewing has started
                      </span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-600">{title}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 break-words font-semibold">{value}</p>
    </div>
  );
}
