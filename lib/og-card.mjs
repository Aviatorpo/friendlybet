// ============================================================
// FriendlyBet - OG card builder (server-side, Satori VDOM)
// ============================================================
// Builds the "My Road to Glory" share card as a Satori element tree for
// @vercel/og to rasterize to a 1200x630 PNG. Mirrors the look of the
// client-side canvas card in app.js (_renderBracketCard): semi-finals ->
// final -> champion in a gold box in the LOWER part of the image.
// ============================================================

import bidiFactory from 'bidi-js';

const GOLD = '#d9b46a', GOLD_LT = '#ecd49a', INK = '#f7f6f2', MUTED = '#9a9c93';

// Satori performs NO bidi reordering, so Hebrew (and Hebrew+digits) come out
// reversed. Reorder to visual order up front with the Unicode Bidi Algorithm
// (base direction rtl) so digits like "2026" stay intact inside Hebrew runs.
const bidi = bidiFactory();
function reorderRtl(str) {
  if (!str) return str;
  const levels = bidi.getEmbeddingLevels(str, 'rtl');
  const segments = bidi.getReorderSegments(str, levels);
  const chars = str.split('');
  for (const [start, end] of segments) {
    const slice = chars.slice(start, end + 1).reverse();
    for (let i = start; i <= end; i++) chars[i] = slice[i - start];
  }
  return chars.join('');
}

// Minimal team-name + flag maps (stable 48-team WC2026 set; mirrors
// share-assets/share-core.js so the server doesn't need the DB for names).
const TEAM_NAMES = {
  MEX:{en:'Mexico',he:'מקסיקו'}, RSA:{en:'South Africa',he:'דרום אפריקה'}, KOR:{en:'South Korea',he:'דרום קוריאה'}, CZE:{en:'Czechia',he:"צ'כיה"},
  CAN:{en:'Canada',he:'קנדה'}, BIH:{en:'Bosnia',he:'בוסניה'}, QAT:{en:'Qatar',he:'קטאר'}, SUI:{en:'Switzerland',he:'שווייץ'},
  BRA:{en:'Brazil',he:'ברזיל'}, MAR:{en:'Morocco',he:'מרוקו'}, HAI:{en:'Haiti',he:'האיטי'}, SCO:{en:'Scotland',he:'סקוטלנד'},
  USA:{en:'United States',he:'ארה"ב'}, PAR:{en:'Paraguay',he:'פרגוואי'}, AUS:{en:'Australia',he:'אוסטרליה'}, TUR:{en:'Turkey',he:'טורקיה'},
  GER:{en:'Germany',he:'גרמניה'}, CUR:{en:'Curaçao',he:'קוראסאו'}, CIV:{en:'Ivory Coast',he:'חוף השנהב'}, ECU:{en:'Ecuador',he:'אקוודור'},
  NED:{en:'Netherlands',he:'הולנד'}, JPN:{en:'Japan',he:'יפן'}, SWE:{en:'Sweden',he:'שבדיה'}, TUN:{en:'Tunisia',he:'תוניסיה'},
  BEL:{en:'Belgium',he:'בלגיה'}, EGY:{en:'Egypt',he:'מצרים'}, IRN:{en:'Iran',he:'איראן'}, NZL:{en:'New Zealand',he:'ניו זילנד'},
  ESP:{en:'Spain',he:'ספרד'}, CPV:{en:'Cape Verde',he:'כף ורדה'}, SAU:{en:'Saudi Arabia',he:'ערב הסעודית'}, URU:{en:'Uruguay',he:'אורוגוואי'},
  FRA:{en:'France',he:'צרפת'}, SEN:{en:'Senegal',he:'סנגל'}, IRQ:{en:'Iraq',he:'עיראק'}, NOR:{en:'Norway',he:'נורווגיה'},
  ARG:{en:'Argentina',he:'ארגנטינה'}, ALG:{en:'Algeria',he:"אלג'יריה"}, AUT:{en:'Austria',he:'אוסטריה'}, JOR:{en:'Jordan',he:'ירדן'},
  POR:{en:'Portugal',he:'פורטוגל'}, COD:{en:'Congo DR',he:'קונגו'}, UZB:{en:'Uzbekistan',he:'אוזבקיסטן'}, COL:{en:'Colombia',he:'קולומביה'},
  ENG:{en:'England',he:'אנגליה'}, CRO:{en:'Croatia',he:'קרואטיה'}, GHA:{en:'Ghana',he:'גאנה'}, PAN:{en:'Panama',he:'פנמה'},
};
const FLAG_ISO = {
  ARG:'ar', FRA:'fr', BRA:'br', ENG:'gb-eng', ESP:'es', POR:'pt', NED:'nl', GER:'de',
  BEL:'be', CRO:'hr', URU:'uy', USA:'us', MEX:'mx', SUI:'ch', AUT:'at', SWE:'se',
  SEN:'sn', MAR:'ma', JPN:'jp', KOR:'kr', AUS:'au', CAN:'ca', TUR:'tr',
  NOR:'no', IRN:'ir', SCO:'gb-sct', CZE:'cz', ALG:'dz', CIV:'ci', TUN:'tn', EGY:'eg',
  GHA:'gh', PAN:'pa', PAR:'py', NZL:'nz', UZB:'uz', IRQ:'iq',
  SAU:'sa', JOR:'jo', RSA:'za', HAI:'ht', BIH:'ba', CPV:'cv', COD:'cd', QAT:'qa', CUR:'cw',
  ECU:'ec', COL:'co'
};

const teamName = (code, lang) => {
  const t = TEAM_NAMES[code];
  if (!t) return code || '';
  return (lang === 'he' ? t.he : t.en) || code;
};
const flagSrc = (code) => { const iso = FLAG_ISO[code]; return iso ? `https://flagcdn.com/w320/${iso}.png` : null; };

// Tiny hyperscript for Satori's React-element-like VDOM.
const h = (type, style, children) => ({ type, props: { style, ...(children !== undefined ? { children } : {}) } });
// Satori doesn't do bidi reordering — Hebrew renders reversed unless we mark
// the node direction:rtl. Apply it to any string that contains Hebrew glyphs.
const hasHebrew = (s) => /[֐-׿]/.test(s || '');
const txt = (content, style) => h('div', { display: 'flex', ...style }, hasHebrew(content) ? reorderRtl(content) : content);
const flag = (code, w, hh) => {
  const src = flagSrc(code);
  if (!src) return h('div', { width: w, height: hh, borderRadius: 5, background: '#26221a' });
  return { type: 'img', props: { src, width: w, height: hh, style: { borderRadius: 5, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.25)' } } };
};

// A team chip: flag on top, name below (matches the canvas card's chip).
function chip(code, lang, w) {
  return h('div', {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    width: w, height: 86, gap: 7, borderRadius: 14,
    border: '2px solid rgba(217,180,106,0.45)', background: 'rgba(255,255,255,0.04)',
  }, [
    flag(code, 46, 31),
    txt(code ? teamName(code, lang) : '—', { color: INK, fontSize: 19, fontFamily: 'Sora', fontWeight: 700 }),
  ]);
}
function sectionLabel(text) {
  return h('div', { color: GOLD, fontSize: 15, fontFamily: 'Sora', fontWeight: 800, letterSpacing: 4, display: 'flex' }, text);
}

// data: { nickname, pool, semis:[4], finals:[2], champ, lang }
export function buildCardElement(data) {
  const lang = data.lang === 'en' ? 'en' : 'he';
  const semis = data.semis || [];
  const finals = data.finals || [];
  const champ = data.champ;

  return h('div', {
    width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
    background: 'linear-gradient(135deg, #0d0d0a 0%, #080806 60%, #100d08 100%)',
    padding: '34px 48px', position: 'relative', fontFamily: 'Heebo',
  }, [
    // gold frame
    h('div', { position: 'absolute', top: 16, left: 16, right: 16, bottom: 16, border: '2px solid rgba(217,180,106,0.30)', borderRadius: 24 }),

    // header
    h('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, [
      h('div', { display: 'flex', alignItems: 'center', gap: 13 }, [
        h('div', { width: 40, height: 40, borderRadius: 11, background: 'linear-gradient(140deg, #d9b46a, #8a6d35)', display: 'flex' }),
        h('div', { color: INK, fontSize: 30, fontFamily: 'Sora', fontWeight: 800 }, 'FriendlyBet'),
      ]),
      h('div', { display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }, [
        txt(data.nickname || '', { color: GOLD, fontSize: 22, fontFamily: 'Sora', fontWeight: 800 }),
        data.pool ? txt(data.pool, { color: MUTED, fontSize: 15 }) : null,
      ].filter(Boolean)),
    ]),

    // title
    h('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 6 }, [
      h('div', { color: INK, fontSize: 40, fontFamily: 'Sora', fontWeight: 800, display: 'flex' }, 'My Road to Glory'),
      h('div', { color: MUTED, fontSize: 17, display: 'flex' }, 'World Cup 2026 · my bracket'),
    ]),

    // bracket: semis row + final row
    h('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 12 }, [
      sectionLabel('SEMI-FINALS'),
      h('div', { display: 'flex', gap: 12 }, [chip(semis[0], lang, 150), chip(semis[1], lang, 150), chip(semis[2], lang, 150), chip(semis[3], lang, 150)]),
      h('div', { display: 'flex', alignItems: 'center', gap: 16, marginTop: 4 }, [
        chip(finals[0], lang, 168),
        h('div', { color: GOLD, fontSize: 22, fontFamily: 'Sora', fontWeight: 800, display: 'flex' }, 'vs'),
        chip(finals[1], lang, 168),
      ]),
    ]),

    // champion box (lower part)
    h('div', {
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      marginTop: 'auto', gap: 6, padding: '14px 0', borderRadius: 22,
      background: 'rgba(217,180,106,0.13)', border: '3px solid #d9b46a',
    }, [
      h('div', { color: GOLD, fontSize: 14, fontFamily: 'Sora', fontWeight: 800, letterSpacing: 3, display: 'flex' }, 'CHAMPIONS'),
      h('div', { display: 'flex', alignItems: 'center', gap: 18 }, [
        flag(champ, 78, 52),
        txt(champ ? teamName(champ, lang) : '—', { color: GOLD_LT, fontSize: 44, fontFamily: 'Sora', fontWeight: 800 }),
      ]),
      txt(lang === 'he' ? 'האלופה שלי למונדיאל 2026' : 'my predicted world champion', { color: MUTED, fontSize: 16 }),
    ]),

    // footer: brand + CTA on one side, a QR to enter the app on the other.
    // data.qr is a pre-fetched base64 data URI (see api/og.mjs) so a flaky QR
    // service can never break the whole card render — we just omit it.
    h('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }, [
      h('div', { display: 'flex', flexDirection: 'column' }, [
        h('div', { color: GOLD, fontSize: 22, fontFamily: 'Sora', fontWeight: 800, display: 'flex' }, 'friendlybet.live'),
        txt(lang === 'he' ? 'בנה תחזית משלך — חינם' : 'build your own — free', { color: MUTED, fontSize: 15 }),
      ]),
      data.qr ? h('div', { display: 'flex', alignItems: 'center', gap: 10 }, [
        txt(lang === 'he' ? 'סרקו לכניסה' : 'scan to play', { color: GOLD, fontSize: 13, fontFamily: 'Sora', fontWeight: 700 }),
        h('div', { display: 'flex', padding: 5, background: '#f6f4ee', borderRadius: 9, border: '2px solid #d9b46a' }, [
          { type: 'img', props: { src: data.qr, width: 60, height: 60 } },
        ]),
      ]) : null,
    ].filter(Boolean)),
  ].filter(Boolean));
}

// Fetch a user's knockout-climax picks from Supabase REST (anon SELECT is
// allowed by RLS). Returns the shape buildCardElement expects.
const SUPABASE_URL = 'https://kovhuahdoluxyqqwqohw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Aj_p7rZjAat_-ros9gzD_g_AsPtotpU';
export async function fetchCardData(u, p, lang) {
  const headers = { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY };
  const q = (path) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers }).then(r => r.ok ? r.json() : null).catch(() => null);
  // The knockout bracket goes through the get_public_bracket RPC: anon SELECT on
  // knockout_picks is closed by RLS, so a direct table read returns [] (empty
  // semis/finals). The SECURITY DEFINER RPC returns only this user's shareable
  // bracket. Group/winner reads still use direct SELECT (anon-allowed).
  const rpc = (fn, body) => fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(r => r.ok ? r.json() : null).catch(() => null);
  const [usr, pool, ko, tw] = await Promise.all([
    q(`users?id=eq.${u}&select=nickname`),
    q(`pools?id=eq.${p}&select=name`),
    rpc('get_public_bracket', { p_user_id: u, p_pool_id: p }),
    q(`tournament_winner_picks?pool_id=eq.${p}&user_id=eq.${u}&select=team_code`),
  ]);
  const bp = {};
  (ko || []).forEach(r => { bp[r.bracket_position] = r.predicted_winner; });
  return {
    nickname: (usr && usr[0] && usr[0].nickname) || (lang === 'he' ? 'שחקן' : 'Player'),
    pool: (pool && pool[0] && pool[0].name) || '',
    semis: [bp[25], bp[26], bp[27], bp[28]],
    finals: [bp[29], bp[30]],
    champ: (tw && tw[0] && tw[0].team_code) || bp[31],
    lang,
  };
}

export { teamName, flagSrc };
