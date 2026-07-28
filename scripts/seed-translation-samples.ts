/**
 * seed-translation-samples.ts
 *
 * Seeds sample translation profiles for ALL existing tenants.
 * - Brand-new tenants: seeds all 11 core profiles + NUMBER_BLACKLIST + CONTENT_FILTER
 * - Existing tenants: seeds only NUMBER_BLACKLIST + CONTENT_FILTER if not already present
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

    let fullSeeded = 0;
    let blSeeded = 0;
    let cfSeeded = 0;
    let skipped = 0;

    for (const t of tenants) {
      try {
        await client.query(`SET search_path TO "${t.schema_name}"`);

        // ── Helper: insert profile only if it doesn't already exist ──
        const seedIfNotExists = async (
          name: string, targetField: string, mode: string, category: string,
          matchPattern: string, replacementFixed: string | null,
          mcc: string | null, mnc: string | null
        ): Promise<boolean> => {
          const check = await client.query(
            `SELECT 1 FROM translation_profiles WHERE name = $1 AND category = $2 LIMIT 1`,
            [name, category]
          );
          if (check.rows.length > 0) return false; // already exists
          const r = await client.query(
            `INSERT INTO translation_profiles
             (name, target_field, mode, category, match_pattern, replacement_fixed, mcc, mnc, sort_order, is_active)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,true) RETURNING id`,
            [name, targetField, mode, category, matchPattern, replacementFixed, mcc, mnc]
          );
          // Global assignment (applies to all clients/suppliers)
          await client.query(
            `INSERT INTO translation_assignments (profile_id, client_id, supplier_id, priority, is_active)
             VALUES ($1, NULL, NULL, 1, true)`,
            [r.rows[0].id]
          );
          return true;
        };

        // ── Check if this is a brand-new tenant (no profiles at all) ──
        const { rows: existing } = await client.query(
          "SELECT 1 FROM translation_profiles LIMIT 1"
        );
        const isNewTenant = existing.length === 0;

        if (isNewTenant) {
          // ── Full seed: all 11 core + multilingual profiles ──
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
            { value: 'GP: {{OTP}} is your Grameenphone verification code.', mccmnc: '470001' },
            { value: 'Robi OTP: {{OTP}} — Valid for 3 minutes', mccmnc: '470002' },
            { value: 'Banglalink: Use {{OTP}} to verify your account', mccmnc: '470003' },
            { value: 'Teletalk: {{OTP}} is your login code', mccmnc: '470004' },
            { value: 'Airtel: Verification code {{OTP}} — Do not share', mccmnc: '470007' },
          ]);

          // 5. Random SID
          const p5 = await seedProfile('Sample Random SID', 'SENDER', 'RANDOM', 'RANDOM_SID', '.*', null, '470', null);
          await assignProfile(p5, 'both', null, 1);
          await addPool(p5, [
            { value: 'BrandSID1' }, { value: 'BrandSID2' }, { value: 'BrandSID3' },
            { value: 'MyBrand' }, { value: 'Net2APP' }, { value: 'VerifySMS' },
            { value: 'GP_OTP', mccmnc: '470001' }, { value: 'Robi_Secure', mccmnc: '470002' },
            { value: 'BL_Alert', mccmnc: '470003' }, { value: 'Airtel_BD', mccmnc: '470007' },
          ]);

          // 6-10. Multilingual OTP templates
          for (const [name, mcc, items] of [
            ['French OTP Templates - MCC 208', '208', [
              'Votre code de vérification est {{OTP}}. Valable 5 minutes.',
              'Code OTP : {{OTP}}. Ne partagez pas ce code.',
              '{{OTP}} est votre mot de passe unique. Utilisez-le sous 5 min.',
              'Code de sécurité : {{OTP}}. Ignorez si non sollicité.',
              'Votre code : {{OTP}}. Valide 3 minutes.',
            ]] as const,
            ['Spanish OTP Templates - MCC 214', '214', [
              'Su código de verificación es {{OTP}}. Válido por 5 minutos.',
              'Código OTP: {{OTP}}. No comparta este código.',
              '{{OTP}} es su contraseña de un solo uso.',
              'Código de seguridad: {{OTP}}. Si no lo solicitó, ignore.',
              'Su código: {{OTP}}. Válido 3 minutos.',
            ]] as const,
            ['Arabic OTP Templates - MCC 424', '424', [
              'رمز التحقق الخاص بك هو {{OTP}}. صالح لمدة 5 دقائق.',
              'كلمة المرور لمرة واحدة: {{OTP}}. لا تشارك هذا الرمز.',
              '{{OTP}} هو رمز التحقق الخاص بك. لا تشاركه.',
              'رمز الأمان: {{OTP}}. إذا لم تطلب ذلك، تجاهل.',
              'رمز الدخول الخاص بك هو {{OTP}}. صالح لمدة 3 دقائق.',
            ]] as const,
            ['Bangla OTP Templates - MCC 470', '470', [
              'আপনার OTP কোড হল {{OTP}}। ৫ মিনিটের জন্য বৈধ।',
              'যাচাইকরণ কোড: {{OTP}}',
              '{{OTP}} হল আপনার এককালীন পাসওয়ার্ড',
              'OTP: {{OTP}}। কারও সাথে শেয়ার করবেন না।',
              'আপনার নিরাপত্তা কোড {{OTP}}। না চাইলে উপেক্ষা করুন।',
            ]] as const,
            ['Brazilian OTP Templates - MCC 724', '724', [
              'Seu código de verificação é {{OTP}}. Válido por 5 minutos.',
              'Código OTP: {{OTP}}. Não compartilhe este código.',
              '{{OTP}} é sua senha de uso único.',
              'OTP: {{OTP}}. Não compartilhe com ninguém.',
              'Seu código de segurança é {{OTP}}. Se não solicitou, ignore.',
              '{{OTP}} é seu PIN de login. Válido por 3 minutos.',
              { value: 'Vivo: Seu código de verificação {{OTP}} é válido por 5 minutos.', mccmnc: '724001' },
              { value: 'TIM: Use {{OTP}} para confirmar seu login.', mccmnc: '724002' },
              { value: 'Claro: Código OTP {{OTP}} — Não compartilhe.', mccmnc: '724003' },
              { value: 'Oi: Seu código de acesso é {{OTP}}. Válido por 5 minutos.', mccmnc: '724010' },
              { value: 'Vivo: {{OTP}} é seu código de segurança.', mccmnc: '724011' },
              { value: 'TIM: Código de verificação {{OTP}} — Válido por 3 minutos.', mccmnc: '724032' },
              { value: 'Claro: {{OTP}} é sua senha de uso único.', mccmnc: '724033' },
              { value: 'Algar: Use {{OTP}} para verificar sua conta.', mccmnc: '724034' },
            ]] as const,
          ] as const) {
            const p = await seedProfile(name, 'BODY', 'RANDOM', 'RANDOM_CONTENT', '.*', null, mcc, null);
            await assignProfile(p, 'both', null, 1);
            const poolItems = items.map(v => typeof v === 'string' ? { value: v } : v);
            await addPool(p, poolItems);
          }

          // 11. OTP Extract Rule
          await client.query(
            `INSERT INTO otp_extract_rules
             (name, regex_pattern, otp_group_index, forward_template, auto_detect, sort_order, is_active)
             VALUES ('Sample OTP Auto-Extract', '(\\\\\\d{4,8})', 1, '{otp}', true, 0, true)
             ON CONFLICT DO NOTHING`
          );

          fullSeeded++;
          console.log(`  ✅ ${t.schema_name}: Seeded 11 sample translation profiles`);
        }

        // ── Number Blacklist rules (for ALL tenants, new or existing) ──
        const bl1 = await seedIfNotExists(
          'BL: Bangladesh numbers (13-19)', 'DESTINATION', 'FIXED', 'NUMBER_BLACKLIST',
          '^8801[3-9]', null, '470', null
        );
        const bl2 = await seedIfNotExists(
          'BL: Bangladesh GP prefix', 'DESTINATION', 'FIXED', 'NUMBER_BLACKLIST',
          '^88017', null, '470', '001'
        );
        const bl3 = await seedIfNotExists(
          'BL: India premium numbers', 'DESTINATION', 'FIXED', 'NUMBER_BLACKLIST',
          '^91(90|91|92|93|94|95|96|97|98|99)(09|19|29|39|49|59|69|79|89|99)',
          null, '404', null
        );
        if (bl1 || bl2 || bl3) blSeeded++;

        // ── Content Filter rules (for ALL tenants, new or existing) ──
        const cf1 = await seedIfNotExists(
          'CF: Block spam keywords', 'BODY', 'FIXED', 'CONTENT_FILTER',
          '(?i)(\\\\b(spam|scam|fraud|phishing|viagra|casino|lottery|winner|congratulations.*won|claim.*prize)\\\\b)',
          'blacklist', null, null
        );
        const cf2 = await seedIfNotExists(
          'CF: Block gambling keywords', 'BODY', 'FIXED', 'CONTENT_FILTER',
          '(?i)(\\\\b(bet|gambling|poker|blackjack|roulette|slots|jackpot|wagering)\\\\b)',
          'blacklist', null, null
        );
        const cf3 = await seedIfNotExists(
          'CF: Only allow OTP messages', 'BODY', 'FIXED', 'CONTENT_FILTER',
          '(?i)(otp|verification|code|password|pin|login|authenticate|confirm|one.time)',
          'whitelist', null, null
        );
        if (cf1 || cf2 || cf3) cfSeeded++;

        if (!isNewTenant) {
          console.log(`  ✅ ${t.schema_name}: Seeded NUMBER_BLACKLIST + CONTENT_FILTER rules`);
        }

      } catch (err) {
        console.warn(`  ⚠️ ${t.schema_name}: ${(err as Error).message}`);
      }
    }

    await client.query("SET search_path TO public");
    console.log(`\nDone! ${fullSeeded} full seeds, ${blSeeded} blacklist updates, ${cfSeeded} content filter updates`);
  } finally {
    client.release();
    process.exit(0);
  }
}

main().catch((err) => { console.error("Failed:", err); process.exit(1); });
