/**
 * seed-translation-samples.ts
 *
 * Seeds sample translation profiles for ALL existing tenants.
 * Only inserts if the tenant has NO translation profiles yet (first-time setup).
 *
 * Run: npx tsx scripts/seed-translation-samples.ts
 */
import { pool } from "../src/db";

async function main() {
  const client = await pool.connect();
  try {
    const { rows: tenants } = await client.query(
      "SELECT id, schema_name, company_name FROM tenants WHERE is_active = true ORDER BY id"
    );

    let seeded = 0;
    let skipped = 0;

    for (const t of tenants) {
      try {
        await client.query(`SET search_path TO "${t.schema_name}"`);

        // Check if any profiles already exist
        const { rows: existing } = await client.query(
          "SELECT 1 FROM translation_profiles LIMIT 1"
        );
        if (existing.length > 0) {
          console.log(`  SKIP ${t.schema_name}: already has profiles`);
          skipped++;
          continue;
        }

        // Helper: create a translation profile
        const seedProfile = async (
          name: string, targetField: string, mode: string, category: string,
          matchPattern: string, replacementFixed: string | null,
          mcc: string | null, mnc: string | null
        ): Promise<number> => {
          const r = await client.query(
            `INSERT INTO translation_profiles
             (name, target_field, mode, category, match_pattern, replacement_fixed, mcc, mnc, sort_order, is_active)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,true) RETURNING id`,
            [name, targetField, mode, category, matchPattern, replacementFixed, mcc, mnc]
          );
          return r.rows[0].id;
        };

        const assignProfile = async (
          profileId: number, scope: string, entityId: number | null, priority: number
        ) => {
          let cId: number | null = null;
          let sId: number | null = null;
          if (scope === 'client' && entityId) cId = entityId;
          else if (scope === 'supplier' && entityId) sId = entityId;
          await client.query(
            `INSERT INTO translation_assignments
             (profile_id, client_id, supplier_id, priority, is_active)
             VALUES ($1,$2,$3,$4,true)`,
            [profileId, cId, sId, priority]
          );
        };

        const addPool = async (profileId: number, items: { value: string; mccmnc?: string }[]) => {
          for (const item of items) {
            await client.query(
              `INSERT INTO translation_pool_items (profile_id, replacement_value, mccmnc) VALUES ($1,$2,$3)`,
              [profileId, item.value, item.mccmnc || null]
            );
          }
        };

        // 1. SID Translation
        const p1 = await seedProfile('Sample SID Replace', 'SENDER', 'FIXED', 'SID', '.*', 'MyBrand', null, null);
        await assignProfile(p1, 'both', null, 1);

        // 2. Number Translation
        const p2 = await seedProfile('Sample BD Number Strip', 'DESTINATION', 'FIXED', 'NUMBER',
          '.*', JSON.stringify({ steps: [{ type:'stripDigits', value:'2' }, { type:'removePrefix', value:'+880' }, { type:'addPrefix', value:'0' }] }),
          '470', null);
        await assignProfile(p2, 'both', null, 1);

        // 3. Content Translation
        const p3 = await seedProfile('Sample Keyword Replace', 'BODY', 'FIXED', 'CONTENT', 'facebook|FB', 'verify', null, null);
        await assignProfile(p3, 'both', null, 1);

        // 4. Random Content — OTP templates with MCC/MNC-tagged pool items
        const p4 = await seedProfile('Sample Random OTP Templates', 'BODY', 'RANDOM', 'RANDOM_CONTENT', '.*', null, '470', null);
        await assignProfile(p4, 'both', null, 1);
        await addPool(p4, [
          // Global templates (apply to all operators in MCC 470 / Bangladesh)
          { value: 'Your OTP code is {{OTP}}. Valid for 5 min.' },
          { value: 'Verification code: {{OTP}}' },
          { value: '{{OTP}} is your one-time password' },
          { value: 'OTP: {{OTP}}. Do not share.' },
          { value: '{{OTP}} is your One Time Password. Use within 5 minutes.' },
          { value: 'Use {{OTP}} to complete verification. OTP expires in 3 mins.' },
          { value: 'Never share {{OTP}} with anyone. Your login code: {{OTP}}' },
          { value: 'Verification OTP: {{OTP}}. Valid for 5 minutes only.' },
          { value: 'Your security code is {{OTP}}. If not requested, ignore.' },
          { value: '{{OTP}} is your login PIN. Do not share this code.' },
          // Operator-specific templates (tagged with MCC/MNC)
          { value: 'GP: {{OTP}} is your Grameenphone verification code.', mccmnc: '470001' },
          { value: 'Robi OTP: {{OTP}} — Valid for 3 minutes', mccmnc: '470002' },
          { value: 'Banglalink: Use {{OTP}} to verify your account', mccmnc: '470003' },
          { value: 'Teletalk: {{OTP}} is your login code', mccmnc: '470004' },
          { value: 'Airtel: Verification code {{OTP}} — Do not share', mccmnc: '470007' },
        ]);

        // 5. Random SID — sender ID pool with operator-targeted items
        const p5 = await seedProfile('Sample Random SID', 'SENDER', 'RANDOM', 'RANDOM_SID', '.*', null, '470', null);
        await assignProfile(p5, 'both', null, 1);
        await addPool(p5, [
          // Global sender IDs (apply to all Bangladesh operators)
          { value: 'BrandSID1' },
          { value: 'BrandSID2' },
          { value: 'BrandSID3' },
          { value: 'MyBrand' },
          { value: 'Net2APP' },
          { value: 'VerifySMS' },
          // Operator-specific sender IDs
          { value: 'GP_OTP', mccmnc: '470001' },
          { value: 'Robi_Secure', mccmnc: '470002' },
          { value: 'BL_Alert', mccmnc: '470003' },
          { value: 'Airtel_BD', mccmnc: '470007' },
        ]);

        // 6. 🇫🇷 French OTP Templates (MCC 208 - France)
        const p6 = await seedProfile('French OTP Templates - MCC 208', 'BODY', 'RANDOM', 'RANDOM_CONTENT', '.*', null, '208', null);
        await assignProfile(p6, 'both', null, 1);
        await addPool(p6, [
          { value: 'Votre code de vérification est {{OTP}}. Valable 5 minutes.' },
          { value: 'Code OTP : {{OTP}}. Ne partagez pas ce code.' },
          { value: '{{OTP}} est votre mot de passe unique. Utilisez-le sous 5 min.' },
          { value: 'Code de sécurité : {{OTP}}. Ignorez si non sollicité.' },
          { value: 'Votre code : {{OTP}}. Valide 3 minutes.' },
        ]);

        // 7. 🇪🇸 Spanish OTP Templates (MCC 214 - Spain)
        const p7 = await seedProfile('Spanish OTP Templates - MCC 214', 'BODY', 'RANDOM', 'RANDOM_CONTENT', '.*', null, '214', null);
        await assignProfile(p7, 'both', null, 1);
        await addPool(p7, [
          { value: 'Su código de verificación es {{OTP}}. Válido por 5 minutos.' },
          { value: 'Código OTP: {{OTP}}. No comparta este código.' },
          { value: '{{OTP}} es su contraseña de un solo uso.' },
          { value: 'Código de seguridad: {{OTP}}. Si no lo solicitó, ignore.' },
          { value: 'Su código: {{OTP}}. Válido 3 minutos.' },
        ]);

        // 8. 🇦🇪 Arabic OTP Templates (MCC 424 - UAE)
        const p8 = await seedProfile('Arabic OTP Templates - MCC 424', 'BODY', 'RANDOM', 'RANDOM_CONTENT', '.*', null, '424', null);
        await assignProfile(p8, 'both', null, 1);
        await addPool(p8, [
          { value: 'رمز التحقق الخاص بك هو {{OTP}}. صالح لمدة 5 دقائق.' },
          { value: 'كلمة المرور لمرة واحدة: {{OTP}}. لا تشارك هذا الرمز.' },
          { value: '{{OTP}} هو رمز التحقق الخاص بك. لا تشاركه.' },
          { value: 'رمز الأمان: {{OTP}}. إذا لم تطلب ذلك، تجاهل.' },
          { value: 'رمز الدخول الخاص بك هو {{OTP}}. صالح لمدة 3 دقائق.' },
        ]);

        // 9. 🇧🇩 Bangla OTP Templates (MCC 470 - Bangladesh)
        const p9 = await seedProfile('Bangla OTP Templates - MCC 470', 'BODY', 'RANDOM', 'RANDOM_CONTENT', '.*', null, '470', null);
        await assignProfile(p9, 'both', null, 1);
        await addPool(p9, [
          { value: 'আপনার OTP কোড হল {{OTP}}। ৫ মিনিটের জন্য বৈধ।' },
          { value: 'যাচাইকরণ কোড: {{OTP}}' },
          { value: '{{OTP}} হল আপনার এককালীন পাসওয়ার্ড' },
          { value: 'OTP: {{OTP}}। কারও সাথে শেয়ার করবেন না।' },
          { value: 'আপনার নিরাপত্তা কোড {{OTP}}। না চাইলে উপেক্ষা করুন।' },
        ]);

        // 10. 🇧🇷 Brazilian Portuguese OTP Templates (MCC 724 - Brazil)
        const p10 = await seedProfile('Brazilian OTP Templates - MCC 724', 'BODY', 'RANDOM', 'RANDOM_CONTENT', '.*', null, '724', null);
        await assignProfile(p10, 'both', null, 1);
        await addPool(p10, [
          // Global templates (apply to all operators in MCC 724 / Brazil)
          { value: 'Seu código de verificação é {{OTP}}. Válido por 5 minutos.' },
          { value: 'Código OTP: {{OTP}}. Não compartilhe este código.' },
          { value: '{{OTP}} é sua senha de uso único.' },
          { value: 'OTP: {{OTP}}. Não compartilhe com ninguém.' },
          { value: 'Seu código de segurança é {{OTP}}. Se não solicitou, ignore.' },
          { value: '{{OTP}} é seu PIN de login. Válido por 3 minutos.' },
          // Operator-specific templates
          { value: 'Vivo: Seu código de verificação {{OTP}} é válido por 5 minutos.', mccmnc: '724001' },
          { value: 'TIM: Use {{OTP}} para confirmar seu login.', mccmnc: '724002' },
          { value: 'Claro: Código OTP {{OTP}} — Não compartilhe.', mccmnc: '724003' },
          { value: 'Oi: Seu código de acesso é {{OTP}}. Válido por 5 minutos.', mccmnc: '724010' },
          { value: 'Vivo: {{OTP}} é seu código de segurança.', mccmnc: '724011' },
          { value: 'TIM: Código de verificação {{OTP}} — Válido por 3 minutos.', mccmnc: '724032' },
          { value: 'Claro: {{OTP}} é sua senha de uso único.', mccmnc: '724033' },
          { value: 'Algar: Use {{OTP}} para verificar sua conta.', mccmnc: '724034' },
        ]);

        // 11. OTP Extract Rule
        await client.query(
          `INSERT INTO otp_extract_rules
           (name, regex_pattern, otp_group_index, forward_template, auto_detect, sort_order, is_active)
           VALUES ('Sample OTP Auto-Extract', '(\\\\\\d{4,8})', 1, '{otp}', true, 0, true)
           ON CONFLICT DO NOTHING`
        );

        console.log(`  ✅ ${t.schema_name}: Seeded 11 sample translation profiles (6 core + 5 multilingual)`);
        seeded++;
      } catch (err) {
        console.warn(`  ⚠️ ${t.schema_name}: ${(err as Error).message}`);
      }
    }

    await client.query("SET search_path TO public");
    console.log(`\nDone! Seeded ${seeded} tenant(s), skipped ${skipped} tenant(s)`);
  } finally {
    client.release();
    process.exit(0);
  }
}

main().catch((err) => { console.error("Failed:", err); process.exit(1); });
