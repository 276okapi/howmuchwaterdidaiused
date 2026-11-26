"use client";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function SignOut() {
  const router = useRouter();
  return (
    <button
      className="btn btn-ghost"
      onClick={async () => {
        await authClient.signOut();
        router.push("/login");
        router.refresh();
      }}
    >
      Wyloguj się
    </button>
  );
}
