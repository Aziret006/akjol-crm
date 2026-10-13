import { Suspense } from "react";
import { ProfileScreen } from "@/components/screens/profile-screen";

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileScreen />
    </Suspense>
  );
}
