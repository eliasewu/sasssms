// Alias route: the Android app calls GET /api/tenant/android-gateway/status
// (as documented in the parent route file). Keep this path working alongside
// the canonical GET /api/tenant/android-gateway.
export { GET } from "../route";
