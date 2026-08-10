/**
 * Central Android APK release configuration.
 *
 * This is the SINGLE source of truth for the APK build info shown and served
 * across the platform. When a new APK is built and deployed to the server,
 * update `APK_VERSION` (and `APK_SIZE_MB` if the file size changes) here —
 * the download endpoint, the dashboard page, and the landing page all read
 * from this module, so there is exactly one place to bump.
 *
 * The deployed artifact lives on the server at /opt/net2app/android-app/ and
 * must be named net2app-v<version>.apk.
 *
 * NOTE (Aug 10): v2.4.1 is the current build — dashboard (Device Profile /
 * SIM Settings / Send SMS / Inbox tabs) + hardened startup + EarlyCrashCapture
 * that uploads the FULL AndroidRuntime JS stack for the mqt_js startup crash,
 * with complete JSON control-char escaping (the previous build's crash
 * uploads were rejected with HTTP 400 because raw control chars in logcat
 * broke JSON.parse). Artifact: /opt/net2app/android-app/net2app-v2.4.1.apk.
 */
export const APK_VERSION = "2.4.5";
export const APK_FILENAME = `net2app-v${APK_VERSION}.apk`;
export const APK_PATH = `/opt/net2app/android-app/${APK_FILENAME}`;
export const APK_SIZE_MB = 63;
