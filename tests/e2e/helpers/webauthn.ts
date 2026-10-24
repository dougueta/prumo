import type { CDPSession, Page } from "@playwright/test";

/**
 * 006 · T004 — autenticador WebAuthn virtual (Chromium, via CDP). Simula Face ID/digital do
 * aparelho: plataforma, verificação de usuário sempre aprovada.
 */
export type VirtualAuthenticator = {
  cdp: CDPSession;
  authenticatorId: string;
  credentials(): Promise<Array<{ credentialId: string; signCount: number }>>;
  /** Próximas verificações falham (simula biometria recusada). */
  setUserVerified(verified: boolean): Promise<void>;
  remove(): Promise<void>;
};

export async function addVirtualAuthenticator(page: Page): Promise<VirtualAuthenticator> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable", { enableUI: false });
  const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return {
    cdp,
    authenticatorId,
    async credentials() {
      const { credentials } = await cdp.send("WebAuthn.getCredentials", { authenticatorId });
      return credentials.map((c) => ({ credentialId: c.credentialId, signCount: c.signCount }));
    },
    async setUserVerified(verified) {
      await cdp.send("WebAuthn.setUserVerified", { authenticatorId, isUserVerified: verified });
    },
    async remove() {
      await cdp.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
    },
  };
}
