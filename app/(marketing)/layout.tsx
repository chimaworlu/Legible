import Header from "../../src/components/Header";
import { MarketingSectionProvider } from "../../src/context/MarketingSectionContext";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MarketingSectionProvider>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          width: "100%",
          overflow: "auto",
          backgroundColor: "var(--color-roles-surface)",
          color: "var(--color-roles-on-surface)",
        }}
      >
        <Header />
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          {children}
        </div>
      </div>
    </MarketingSectionProvider>
  );
}
