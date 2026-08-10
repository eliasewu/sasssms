import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions — Net2APP SMS Gateway",
  description:
    "Terms and Conditions for using the Net2APP SMS Gateway platform, HTTP SMS API, SMPP services, and Android gateway application.",
  alternates: { canonical: "https://net2app.com/terms" },
  openGraph: {
    title: "Terms & Conditions — Net2APP SMS Gateway",
    description:
      "Terms and Conditions for using the Net2APP SMS Gateway platform.",
  },
};

const LAST_UPDATED = "August 10, 2026";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12">
          <p className="text-sm font-medium text-blue-600 mb-2">
            Net2APP SMS Gateway
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 mb-3">
            Terms &amp; Conditions
          </h1>
          <p className="text-sm text-gray-500">Last updated: {LAST_UPDATED}</p>
        </div>

        {/* Introduction */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            1. Acceptance of Terms
          </h2>
          <p className="text-gray-700 leading-relaxed">
            By creating an account on, accessing, or using the Net2APP SMS
            Gateway platform, HTTP SMS API, SMPP services, or the Net2APP
            Android gateway application (collectively, &ldquo;the
            Platform&rdquo;), operated by{" "}
            <strong>Tri Angle Trade Centre FZE LLC</strong> (&ldquo;Net2APP,&rdquo;
            &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;), you agree
            to be bound by these Terms &amp; Conditions (&ldquo;Terms&rdquo;).
            If you do not agree to these Terms, you may not create an account
            or use the Platform.
          </p>
        </section>

        {/* Account */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            2. Account Registration and Security
          </h2>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-700">
            <li>
              You must provide accurate, current, and complete information when
              registering, and you must keep your account information updated.
            </li>
            <li>
              You are responsible for safeguarding your SMPP credentials, API
              keys, and account passwords. You agree not to disclose them to
              unauthorized parties.
            </li>
            <li>
              You are responsible for all activity that occurs under your
              account, including messages sent through your sub-clients,
              suppliers, and API keys.
            </li>
            <li>
              You must be at least 18 years old or have the legal authority to
              bind the business entity you represent.
            </li>
            <li>
              We may suspend or terminate accounts that violate these Terms or
              applicable law.
            </li>
          </ul>
        </section>

        {/* Services */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            3. Platform Services
          </h2>
          <p className="text-gray-700 leading-relaxed">
            The Platform provides multi-tenant SMS gateway services including
            SMPP v3.4 connectivity, HTTP SMS APIs, Voice OTP, OTT messaging
            (WhatsApp/Telegram), RCS, and the Android gateway application. We
            may add, modify, or discontinue features at any time. We do not
            guarantee uninterrupted or error-free service, but we make
            commercially reasonable efforts to maintain availability.
          </p>
        </section>

        {/* Acceptable Use */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            4. Acceptable Use &amp; Prohibited Content
          </h2>
          <p className="text-gray-700 leading-relaxed">
            You agree not to use the Platform to send, store, or relay:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-700">
            <li>Spam, unsolicited bulk messages, or messages sent without consent</li>
            <li>Fraudulent, deceptive, or misleading content</li>
            <li>Illegal content or content that violates applicable law</li>
            <li>Content that infringes the intellectual property rights of others</li>
            <li>Content that is defamatory, harassing, threatening, or obscene</li>
            <li>Malware, phishing, or other malicious content</li>
            <li>Messages sent to phone numbers without lawful basis (e.g., without consent or a legitimate transactional purpose)</li>
          </ul>
          <p className="text-gray-700 leading-relaxed mt-3">
            You are solely responsible for ensuring that your use of the
            Platform complies with all applicable laws, regulations, and
            carrier policies in every jurisdiction where you send messages.
            Violations may result in immediate suspension of service without
            refund.
          </p>
        </section>

        {/* Billing */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            5. Billing, Payments, and Credits
          </h2>
          <ul className="list-disc list-inside mt-2 space-y-1 text-gray-700">
            <li>
              SMS credits are deducted at the time of submission or delivery,
              depending on the charging mode configured for your account.
            </li>
            <li>
              Credits are non-refundable except as required by law or as
              expressly agreed in writing.
            </li>
            <li>
              Prepaid balances that remain unused may expire in accordance with
              your plan terms.
            </li>
            <li>
              Subscription plans (Professional, Enterprise) may renew
              automatically and are billed according to the plan terms in
              effect at the time of purchase.
            </li>
            <li>
              We may change pricing with notice. Continued use after a price
              change constitutes acceptance of the new pricing.
            </li>
          </ul>
        </section>

        {/* DLR */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            6. Delivery Reports (DLR)
          </h2>
          <p className="text-gray-700 leading-relaxed">
            Delivery reports reflect the status reported by mobile networks and
            upstream suppliers. Actual delivery to a handset is ultimately
            determined by the recipient&apos;s mobile operator and device state.
            We do not guarantee that all messages are delivered or that all
            DLRs are accurate. We are not liable for failed or delayed
            delivery caused by network conditions, recipient devices, or
            operator policies.
          </p>
        </section>

        {/* IP & Data */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            7. Intellectual Property and Data
          </h2>
          <p className="text-gray-700 leading-relaxed">
            All software, documentation, and materials provided by Net2APP are
            owned by Net2APP and protected by intellectual property laws. Your
            message content and data remain yours. You grant us a limited
            license to process, transmit, and store your data solely to
            provide the Platform services. Our handling of personal data is
            described in our{" "}
            <a
              href="/privacy"
              className="text-blue-600 hover:underline"
            >
              Privacy Policy
            </a>
            .
          </p>
        </section>

        {/* SLA */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            8. Service Levels and Limitations
          </h2>
          <p className="text-gray-700 leading-relaxed">
            The Platform is provided on an &ldquo;as-is&rdquo; and
            &ldquo;as-available&rdquo; basis. We make no warranties, express or
            implied, including warranties of merchantability, fitness for a
            particular purpose, or non-infringement. TPS limits apply per
            plan; exceeding your limits may result in throttling. SMS credits
            deducted for messages that ultimately fail may be credited back in
            accordance with your plan&apos;s billing matrix.
          </p>
        </section>

        {/* Liability */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            9. Limitation of Liability
          </h2>
          <p className="text-gray-700 leading-relaxed">
            To the maximum extent permitted by law, Net2APP shall not be
            liable for any indirect, incidental, special, consequential, or
            punitive damages, or for any loss of profits, revenue, data, or
            goodwill arising out of or related to your use of the Platform.
            Our aggregate liability shall not exceed the amounts you paid to
            us in the three (3) months preceding the claim.
          </p>
        </section>

        {/* Suspension */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            10. Suspension and Termination
          </h2>
          <p className="text-gray-700 leading-relaxed">
            We may suspend or terminate your access to the Platform, with or
            without notice, if: (a) you breach these Terms, (b) you use the
            Platform in a way that threatens the security or integrity of the
            Platform or other users, (c) your account is inactive or has an
            expired package, or (d) required by law. Upon termination, your
            data may be deleted after a reasonable retention period. You may
            terminate your account at any time by contacting support.
          </p>
        </section>

        {/* Changes */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            11. Changes to These Terms
          </h2>
          <p className="text-gray-700 leading-relaxed">
            We may update these Terms from time to time. We will update the
            &ldquo;Last updated&rdquo; date at the top of this page and may
            notify you by email. Continued use of the Platform after changes
            constitutes acceptance of the updated Terms.
          </p>
        </section>

        {/* Governing Law */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            12. Governing Law
          </h2>
          <p className="text-gray-700 leading-relaxed">
            These Terms are governed by the laws of the United Arab Emirates,
            without regard to conflict-of-law principles. Any disputes arising
            from these Terms shall be subject to the exclusive jurisdiction of
            the courts of Dubai, UAE.
          </p>
        </section>

        {/* Contact */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">
            13. Contact Us
          </h2>
          <p className="text-gray-700 leading-relaxed">
            If you have questions about these Terms, please contact us:
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
      </div>
    </main>
  );
}
