"use client";

import { useCallback, useEffect, useState } from "react";

const API_URL = "/api";

interface VerificationComponent {
  verification_item_id: number;
  component_id: number;
  component_name: string;
  pieces_per_garment: number;
  expected_qty: number;
  actual_qty: number | null;
  status: "UNCHECKED" | "GREEN" | "YELLOW" | "RED";
}

interface PendingOrder {
  order_id: number;
  order_no: string;
  recipe_id: number;
  recipe_code: string;
  recipe_name: string;
  category: string;
  target_qty: number;
  fabric_roll_id: string;
  actual_fabric_yds: number | string;
  created_at: string;
  components: VerificationComponent[];
}

interface CountInput {
  [verificationItemId: number]: string;
}

function getStatus(actual: number | null, expected: number) {
  if (actual === null) return "UNCHECKED";
  if (actual === expected) return "GREEN";
  if (actual > expected) return "YELLOW";
  return "RED";
}

function statusClasses(status: string) {
  switch (status) {
    case "GREEN":
      return "bg-green-100 text-green-800";
    case "YELLOW":
      return "bg-amber-100 text-amber-900";
    case "RED":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

export default function VerifierPage() {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [counts, setCounts] = useState<Record<number, CountInput>>({});
  const [rejectionNotes, setRejectionNotes] = useState<
    Record<number, string>
  >({});
  const [loading, setLoading] = useState(true);
  const [savingOrderId, setSavingOrderId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadPendingOrders = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/verification/pending`, {
        method: "GET",
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to load pending orders");
      }

      const pendingOrders: PendingOrder[] = data.orders || [];
      setOrders(pendingOrders);

      setCounts((previous) => {
        const updated = { ...previous };

        for (const order of pendingOrders) {
          updated[order.order_id] ??= {};

          for (const component of order.components) {
            if (updated[order.order_id][component.verification_item_id] === undefined) {
              updated[order.order_id][component.verification_item_id] =
                component.actual_qty === null
                  ? ""
                  : String(component.actual_qty);
            }
          }
        }

        return updated;
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load pending orders"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPendingOrders();
  }, [loadPendingOrders]);

  function updateCount(
    orderId: number,
    itemId: number,
    value: string
  ) {
    setCounts((previous) => ({
      ...previous,
      [orderId]: {
        ...previous[orderId],
        [itemId]: value,
      },
    }));
  }

  function updateRejectionNote(orderId: number, value: string) {
    setRejectionNotes((previous) => ({
      ...previous,
      [orderId]: value,
    }));
  }

  function getOrderCountStatus(order: PendingOrder) {
    const orderCounts = counts[order.order_id] || {};

    return order.components.map((component) => {
      const value = orderCounts[component.verification_item_id];

      if (value === undefined || value.trim() === "") {
        return {
          ...component,
          inputValue: value ?? "",
          actual: null,
          status: "UNCHECKED",
        };
      }

      const actual = Number(value);

      if (!Number.isInteger(actual) || actual < 0) {
        return {
          ...component,
          inputValue: value,
          actual: null,
          status: "INVALID",
        };
      }

      return {
        ...component,
        inputValue: value,
        actual,
        status: getStatus(actual, Number(component.expected_qty)),
      };
    });
  }

  async function saveCounts(order: PendingOrder) {
    setError("");
    setSuccess("");

    const componentCounts = getOrderCountStatus(order);

    if (componentCounts.some((item) => item.status === "UNCHECKED")) {
      setError("Enter an actual quantity for every component.");
      return;
    }

    if (componentCounts.some((item) => item.status === "INVALID")) {
      setError("Component counts must be non-negative whole numbers.");
      return;
    }

    setSavingOrderId(order.order_id);

    try {
      const response = await fetch(
        `${API_URL}/verification/${order.order_id}/counts`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            counts: componentCounts.map((item) => ({
              verification_item_id: item.verification_item_id,
              actual_qty: item.actual,
            })),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to save component counts");
      }

      setSuccess(`Counts saved for ${order.order_no}.`);
      await loadPendingOrders();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save counts"
      );
    } finally {
      setSavingOrderId(null);
    }
  }

  async function submitDecision(
    order: PendingOrder,
    decision: "APPROVED" | "REJECTED"
  ) {
    setError("");
    setSuccess("");

    const orderCounts = getOrderCountStatus(order);

    if (decision === "APPROVED") {
      if (orderCounts.some((item) => item.status === "UNCHECKED")) {
        setError("Count every component before approving this order.");
        return;
      }

      if (orderCounts.some((item) => item.status === "INVALID")) {
        setError("Correct invalid component counts before approving.");
        return;
      }

      if (orderCounts.some((item) => item.status === "RED")) {
        setError("Approval blocked: component shortages exist.");
        return;
      }

      // Save the current counts before requesting approval.
      // The backend independently validates all counts and shortages.
    }

    const note = rejectionNotes[order.order_id]?.trim() || "";

    if (decision === "REJECTED" && !note) {
      setError("Enter a reason before rejecting the order.");
      return;
    }

    setSavingOrderId(order.order_id);

    try {
      // Save counts first so the decision endpoint sees the latest values.
      if (decision === "APPROVED") {
        const countResponse = await fetch(
          `${API_URL}/verification/${order.order_id}/counts`,
          {
            method: "PUT",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              counts: orderCounts.map((item) => ({
                verification_item_id: item.verification_item_id,
                actual_qty: item.actual,
              })),
            }),
          }
        );

        const countData = await countResponse.json();

        if (!countResponse.ok) {
          throw new Error(
            countData.message || "Failed to save component counts"
          );
        }
      }

      const response = await fetch(
        `${API_URL}/verification/${order.order_id}/decision`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            decision,
            ...(decision === "REJECTED" ? { rejection_note: note } : {}),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to process decision");
      }

      setSuccess(
        `${order.order_no} ${
          decision === "APPROVED" ? "approved" : "rejected"
        } successfully.`
      );

      setRejectionNotes((previous) => ({
        ...previous,
        [order.order_id]: "",
      }));

      await loadPendingOrders();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to process the decision"
      );
    } finally {
      setSavingOrderId(null);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-5 text-gray-900 md:p-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-teal-700">
              ApparelFlow ERP
            </p>
            <h1 className="mt-2 text-3xl font-bold">
              Cutting Verifier Dashboard
            </h1>
            <p className="mt-2 text-gray-600">
              Verify component counts before orders proceed to sewing.
            </p>
          </div>

          <button
            type="button"
            onClick={loadPendingOrders}
            disabled={loading || savingOrderId !== null}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 font-semibold hover:bg-gray-100 disabled:opacity-60"
          >
            Refresh Orders
          </button>
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

        <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-600">Pending Orders</p>
            <p className="mt-2 text-3xl font-bold">{orders.length}</p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-600">Components to Check</p>
            <p className="mt-2 text-3xl font-bold">
              {orders.reduce(
                (total, order) => total + order.components.length,
                0
              )}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-600">Orders With Shortages</p>
            <p className="mt-2 text-3xl font-bold">
              {
                orders.filter((order) =>
                  getOrderCountStatus(order).some(
                    (component) => component.status === "RED"
                  )
                ).length
              }
            </p>
          </div>
        </section>

        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-600">
            Loading pending verification orders...
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
            <h2 className="text-xl font-bold">No Pending Orders</h2>
            <p className="mt-2 text-gray-600">
              There are currently no cutting orders awaiting verification.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => {
              const componentCounts = getOrderCountStatus(order);
              const hasShortage = componentCounts.some(
                (item) => item.status === "RED"
              );
              const hasInvalid = componentCounts.some(
                (item) => item.status === "INVALID"
              );
              const hasUnchecked = componentCounts.some(
                (item) => item.status === "UNCHECKED"
              );
              const busy = savingOrderId === order.order_id;

              return (
                <article
                  key={order.order_id}
                  className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                >
                  <div className="border-b border-gray-200 bg-gray-50 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-bold">
                          {order.order_no}
                        </h2>
                        <p className="mt-1 text-sm text-gray-600">
                          {order.recipe_code} — {order.recipe_name}
                        </p>
                      </div>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                        PENDING VERIFICATION
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                      <div>
                        <p className="text-gray-500">Target Quantity</p>
                        <p className="mt-1 font-semibold">{order.target_qty}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Fabric Roll</p>
                        <p className="mt-1 font-semibold">
                          {order.fabric_roll_id}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Fabric Used</p>
                        <p className="mt-1 font-semibold">
                          {order.actual_fabric_yds} yards
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Components</p>
                        <p className="mt-1 font-semibold">
                          {order.components.length}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-5">
                    <h3 className="mb-4 font-bold">Component Verification</h3>

                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[650px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="p-3">Component</th>
                            <th className="p-3">Expected</th>
                            <th className="p-3">Actual Count</th>
                            <th className="p-3">Variance</th>
                            <th className="p-3">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {componentCounts.map((component) => {
                            const variance =
                              component.actual === null
                                ? null
                                : component.actual - component.expected_qty;

                            return (
                              <tr
                                key={component.verification_item_id}
                                className="border-b border-gray-100 last:border-0"
                              >
                                <td className="p-3 font-medium">
                                  {component.component_name}
                                </td>
                                <td className="p-3">
                                  {component.expected_qty}
                                </td>
                                <td className="p-3">
                                  <input
                                    aria-label={`Actual count for ${component.component_name}`}
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={component.inputValue}
                                    disabled={busy}
                                    onChange={(event) =>
                                      updateCount(
                                        order.order_id,
                                        component.verification_item_id,
                                        event.target.value
                                      )
                                    }
                                    className="w-28 rounded-lg border border-gray-300 p-2 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                                  />
                                </td>
                                <td className="p-3">
                                  {variance === null
                                    ? "—"
                                    : variance > 0
                                      ? `+${variance}`
                                      : variance}
                                </td>
                                <td className="p-3">
                                  <span
                                    className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(
                                      component.status
                                    )}`}
                                  >
                                    {component.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => saveCounts(order)}
                        disabled={busy}
                        className="rounded-lg border border-gray-300 px-4 py-2 font-semibold hover:bg-gray-50 disabled:opacity-60"
                      >
                        {busy ? "Saving..." : "Save Counts"}
                      </button>

                      <p className="text-sm text-gray-600">
                        {hasShortage
                          ? "A shortage exists. Approval is blocked."
                          : hasInvalid
                            ? "Correct invalid quantities before deciding."
                            : hasUnchecked
                              ? "Enter all component counts before approving."
                              : "All components have valid counts."}
                      </p>
                    </div>

                    <div className="mt-6 border-t border-gray-200 pt-5">
                      <label
                        htmlFor={`rejection-${order.order_id}`}
                        className="mb-2 block text-sm font-semibold"
                      >
                        Rejection Reason
                      </label>
                      <textarea
                        id={`rejection-${order.order_id}`}
                        rows={2}
                        value={rejectionNotes[order.order_id] || ""}
                        disabled={busy}
                        onChange={(event) =>
                          updateRejectionNote(
                            order.order_id,
                            event.target.value
                          )
                        }
                        placeholder="Required if you reject this order..."
                        className="w-full rounded-lg border border-gray-300 p-3 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                      />

                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            submitDecision(order, "APPROVED")
                          }
                          disabled={
                            busy ||
                            hasShortage ||
                            hasInvalid ||
                            hasUnchecked
                          }
                          className="rounded-lg bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busy ? "Processing..." : "Approve Order"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            submitDecision(order, "REJECTED")
                          }
                          disabled={busy}
                          className="rounded-lg bg-red-700 px-5 py-3 font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Reject Order
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}