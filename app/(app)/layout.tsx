import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth");
  }

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "var(--color-roles-surface)",
      color: "var(--color-roles-on-surface)",
    }}>
      {children}
    </div>
  );
}
