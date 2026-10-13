import { Suspense } from "react";
import { ChatsScreen } from "@/components/screens/chats-screen";

export default function ChatsPage() {
  return (
    <Suspense fallback={null}>
      <ChatsScreen />
    </Suspense>
  );
}
