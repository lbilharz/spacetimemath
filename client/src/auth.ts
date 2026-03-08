/** Shared module — holds the live SpaceTimeDB auth token after connection. */
export let capturedToken: string | undefined;

export function setCapturedToken(token: string) {
  capturedToken = token;
}
