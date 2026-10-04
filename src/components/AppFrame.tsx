"use client";

import { AuthScreen } from "@/components/AuthScreen";
import { Header } from "@/components/Header";
import { useCollection } from "@/components/CollectionProvider";
import { usePathname } from "next/navigation";

export function AppFrame({ children }: { children: React.ReactNode }) {
  const { ready, user } = useCollection();
  const pathname = usePathname();
  const isSharedView = pathname.startsWith("/classeur/");
  return (
    <div className="flex h-dvh flex-col overflow-clip">
      <Header />
      <main className="@container/main flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto [container-type:size]">
        {ready && !user && !isSharedView ? <AuthScreen /> : children}
      </main>
    </div>
  );
}
