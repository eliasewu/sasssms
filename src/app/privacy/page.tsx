import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Net2APP SMS Gateway",
  description:
    "Privacy Policy for the Net2APP SMS Gateway Android application. Learn how we handle your SMPP credentials, SMS content, and device data.",
  alternates: { canonical: "https://net2app.com/privacy" },
  openGraph: {
    title: "Privacy Policy — Net2APP SMS Gateway",
    description:
      "Privacy Policy for the Net2APP SMS Gateway Android application.",
  },
};

const LAST_UPDATED = "August 1, 2026";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12">
          <p className="text-sm font-medium text-blue-600 mb-2">
            Net2APP SMS Gateway
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 mb-3">
            Privacy Policy
          </h1>
          <p className="text-sm text-gray-500">
            Last updated: {LAST_UPDATED}
          </p>
        </div>

        {/* Introduction */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            1. Introduction
          </h2>
          <p className="text-gray-700 leading-relaxed">
            This Privacy Policy describes how the Net2APP SMS Gateway Android
            application (&ldquo;the App&rdquo;), developed and operated by{" "}
            <strong>Tri Angle Trade Centre FZE LLC</strong> (&ldquo;Net2APP,&rdquo;
            &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), collects,
            uses, and shares information when you use the App. By installing and
            using the App, you agree to the practices described in this policy.
          </p>
        </section>

        {/* Information We Collect */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            2. Information We Collect
          </h2>

          <h3 className="text-lg font-medium text-gray-800 mt-6 mb-2">
            2.1 SMPP Credentials
          </h3>
          <p className="text-gray-700 leading-relaxed">
            The App requires your Net2APP supplier SMPP username and password to
            establish secure connections with our servers. These credentials are:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-700">
            <li>Stored only in the App&apos;s local secure storage on your device</li>
            <li>Transmitted exclusively over TCP connections to Net2APP servers</li>
            <li>Never shared with third parties</li>
            <li>Not collected or stored on any Net2APP server beyond the SMPP bind handshake</li>
          </ul>

          <h3 className="text-lg font-medium text-gray-800 mt-6 mb-2">
            2.2 SMS Content and Phone Numbers
          </h3>
          <p className="text-gray-700 leading-relaxed">
            The App sends and receives SMS messages through your device&apos;s
            cellular radio. SMS content and phone numbers processed by the App
            are:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-700">
            <li>
              <strong>Outbound (MT):</strong> Received from Net2APP servers via
              SMPP and forwarded through your device&apos;s SMS provider. The SMS
              content passes through your mobile carrier&apos;s network.
            </li>
            <li>
              <strong>Inbound (MO):</strong> Received from other mobile devices
              and forwarded to Net2APP servers via SMPP for delivery to the
              originating tenant.
            </li>
            <li>
              The App does <strong>not</strong> store a permanent log of SMS
              content on the device beyond transient in-memory processing.
            </li>
          </ul>

          <h3 className="text-lg font-medium text-gray-800 mt-6 mb-2">
            2.3 Device Information
          </h3>
          <p className="text-gray-700 leading-relaxed">
            The App collects minimal device information necessary for operation:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-700">
            <li>
              <strong>Device ID:</strong> A unique identifier for registering
              your device with the Net2APP platform
            </li>
            <li>
              <strong>Phone State:</strong> Used solely to detect your SIM&apos;s
              MCC/MNC (Mobile Country Code / Mobile Network Code) for routing
              purposes
            </li>
            <li>
              <strong>Network Status:</strong> Used to manage SMPP connections
              and reconnect on network changes
            </li>
          </ul>
        </section>

        {/* How We Use Information */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            3. How We Use Your Information
          </h2>
          <p className="text-gray-700 leading-relaxed">
            We use the collected information exclusively for:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-700">
            <li>Establishing and maintaining SMPP connections to Net2APP servers</li>
            <li>Routing SMS messages between your device and Net2APP tenants</li>
            <li>Authenticating your device as an authorized SMS gateway</li>
            <li>Providing connection status and delivery reports</li>
          </ul>
          <p className="text-gray-700 leading-relaxed mt-3">
            We do <strong>not</strong> use your information for advertising,
            profiling, analytics, or any purpose unrelated to SMS gateway
            functionality.
          </p>
        </section>

        {/* Data Sharing */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            4. Data Sharing and Disclosure
          </h2>
          <p className="text-gray-700 leading-relaxed">
            We do <strong>not</strong> sell, rent, or trade your personal
            information. SMS content is forwarded through the following parties
            as part of normal operation:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-700">
            <li>
              <strong>Net2APP Servers:</strong> Your device sends and receives
              SMS content via SMPP connections to Net2APP infrastructure servers
              (currently located in Canada, France, and Germany). These servers
              deliver the messages to the appropriate tenant.
            </li>
            <li>
              <strong>Your Mobile Carrier:</strong> SMS messages are transmitted
              through your mobile network operator&apos;s infrastructure as part
              of normal SMS delivery.
            </li>
            <li>
              <strong>Legal Requirements:</strong> We may disclose information if
              required by law, court order, or governmental regulation.
            </li>
          </ul>
        </section>

        {/* Data Security */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            5. Data Security
          </h2>
          <p className="text-gray-700 leading-relaxed">
            We implement industry-standard security measures to protect your
            information:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-700">
            <li>SMPP credentials are stored using Android&apos;s secure storage mechanisms</li>
            <li>All SMPP connections use TCP with protocol-level authentication</li>
            <li>The App does not expose SMS content to other applications on the device</li>
            <li>Net2APP servers use PostgreSQL schema isolation to prevent cross-tenant data access</li>
          </ul>
          <p className="text-gray-700 leading-relaxed mt-3">
            However, no method of electronic storage or transmission is 100%
            secure. We cannot guarantee absolute security.
          </p>
        </section>

        {/* Data Retention */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            6. Data Retention
          </h2>
          <p className="text-gray-700 leading-relaxed">
            The App retains your SMPP credentials on the device until you
            uninstall it or clear its data. SMS content is processed transiently
            and not permanently stored on the device. Message logs on Net2APP
            servers are retained according to each tenant&apos;s data retention
            settings.
          </p>
        </section>

        {/* Children's Privacy */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            7. Children&apos;s Privacy
          </h2>
          <p className="text-gray-700 leading-relaxed">
            The App is intended for business and enterprise use only. We do not
            knowingly collect personal information from children under 13. If you
            believe a child has provided us with personal information, please
            contact us immediately.
          </p>
        </section>

        {/* Your Rights */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            8. Your Rights
          </h2>
          <p className="text-gray-700 leading-relaxed">
            Depending on your jurisdiction, you may have the right to:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-700">
            <li>Access the personal data we hold about you</li>
            <li>Request correction or deletion of your data</li>
            <li>Object to or restrict processing of your data</li>
            <li>Data portability</li>
            <li>Withdraw consent at any time (by uninstalling the App)</li>
          </ul>
          <p className="text-gray-700 leading-relaxed mt-3">
            To exercise these rights, contact us at the email address below.
          </p>
        </section>

        {/* Changes */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            9. Changes to This Policy
          </h2>
          <p className="text-gray-700 leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify
            you of material changes by updating the &ldquo;Last updated&rdquo;
            date at the top of this page and through the App. Continued use of
            the App after changes constitutes acceptance of the updated policy.
          </p>
        </section>

        {/* Contact */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            10. Contact Us
          </h2>
          <p className="text-gray-700 leading-relaxed">
            If you have questions or concerns about this Privacy Policy or our
            data practices, please contact us:
          </p>
          <div className="mt-3 p-4 bg-white rounded-lg border border-gray-200 text-gray-700">
            <p>
              <strong>Tri Angle Trade Centre FZE LLC</strong>
            </p>
            <p>Dubai, United Arab Emirates</p>
            <p>
              Email:{" "}
              <a
                href="mailto:info@net2app.com"
                className="text-blue-600 hover:underline"
              >
                info@net2app.com
              </a>
            </p>
            <p>
              Website:{" "}
              <a
                href="https://net2app.com"
                className="text-blue-600 hover:underline"
              >
                https://net2app.com
              </a>
            </p>
          </div>
        </section>

        {/* Google Play Specific */}
        <section className="mb-10 p-5 bg-blue-50 rounded-lg border border-blue-100">
          <h2 className="text-lg font-semibold text-blue-900 mb-2">
            Google Play Required Disclosures
          </h2>
          <p className="text-blue-800 text-sm leading-relaxed">
            This App uses the following sensitive permissions for the stated
            purposes:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-blue-800 text-sm">
            <li>
              <strong>SMS (send/receive):</strong> Required to function as an SMS
              gateway — sending MT messages from Net2APP tenants and receiving MO
              messages from mobile users
            </li>
            <li>
              <strong>Phone state:</strong> Used to detect the SIM&apos;s
              MCC/MNC for carrier routing — not for call interception
            </li>
            <li>
              <strong>Foreground service:</strong> Required to maintain SMPP
              connections in the background for real-time message delivery
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
