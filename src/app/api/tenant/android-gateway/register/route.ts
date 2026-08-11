// Alias route: the Android app calls POST /api/tenant/android-gateway/register
// (as documented in the parent route file). Keep this path working alongside
// the canonical POST /api/tenant/android-gateway.
export { POST } from "../route";
