import type { Metadata } from "next";
import { Frame } from "@/components/frame";
import { CrmProvider } from "@/lib/store";
import "./globals.css";

export const metadata: Metadata = {
  title: "Акжол CRM",
  description: "CRM диспетчерской таксопарка Акжол",
  icons: { icon: "/mark.svg" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="h-full">
      <body className="min-h-full bg-[#eef2f4] text-[#333]">
        <CrmProvider>
          <Frame>{children}</Frame>
        </CrmProvider>
      </body>
    </html>
  );
}
