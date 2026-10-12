
export type UserRole =
  | "cutting_supervisor"
  | "cutting_verifier"
  | "sewing_supervisor";

export const roleRoutes: Record<UserRole, string> = {
  cutting_supervisor: "/supervisor",
  cutting_verifier: "/verifier",
  sewing_supervisor: "/sewing",
};

export function getStoredUser() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedUser = localStorage.getItem("userData");

    if (!storedUser) {
      return null;
    }

    const user = JSON.parse(storedUser);

    if (
      !user ||
      typeof user.id !== "number" ||
      !roleRoutes[user.role as UserRole]
    ) {
      return null;
    }

    return user as {
      id: number;
      email: string;
      fullName: string;
      role: UserRole;
    };
  } catch {
    return null;
  }
}
