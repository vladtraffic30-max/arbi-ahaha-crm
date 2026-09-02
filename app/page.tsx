import { getChatGPTUser } from "./chatgpt-auth";
import CRMApp from "./crm-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getChatGPTUser();
  return (
    <CRMApp
      user={{
        name: user?.displayName ?? "Власник FRANKLIN",
        email: user?.email ?? "owner@franklin.local",
      }}
    />
  );
}
