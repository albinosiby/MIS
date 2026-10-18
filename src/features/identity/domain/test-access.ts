/** Reserved fixture identities require explicit server configuration. */
export function mayUseSyntheticIdentity(email: string, testAccessEnabled: boolean) {
  return testAccessEnabled || !["@greenfield.demo", "@greenfield.test"].some(
    (domain) => email.toLowerCase().endsWith(domain),
  );
}
