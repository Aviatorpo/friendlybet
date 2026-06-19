// ============================================================
// FriendlyBet - OG card builder (server-side, Satori VDOM)
// ============================================================
// Builds the "My Road to Glory" share card as a Satori element tree for
// @vercel/og to rasterize to a 1200x630 PNG. Mirrors the look of the
// client-side canvas card in app.js (_renderBracketCard): semi-finals ->
// final -> champion in a gold box in the LOWER part of the image.
// ============================================================

import bidiFactory from 'bidi-js';
import { championRoad, lateKnockoutSeedFromMatches } from './bracket-core.mjs';

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
  const label = (code || '').slice(0, 3) || '-';
  return h('div', {
    width: w, height: hh, borderRadius: 6,
    background: 'linear-gradient(140deg, rgba(236,212,154,0.92), rgba(138,109,53,0.88))',
    border: '1px solid rgba(255,255,255,0.28)', color: '#11100c',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'Sora', fontWeight: 800, fontSize: Math.max(10, Math.floor(hh * 0.42)),
  }, label);
};

// A team chip: flag on top, name below (matches the canvas card's chip).
function chip(code, lang, w) {
  return h('div', {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    width: w, height: 76, gap: 6, borderRadius: 13,
    border: '2px solid rgba(217,180,106,0.45)', background: 'rgba(255,255,255,0.04)',
  }, [
    flag(code, 42, 28),
    txt(code ? teamName(code, lang) : '—', { color: INK, fontSize: 17, fontFamily: 'Sora', fontWeight: 700 }),
  ]);
}
function sectionLabel(text) {
  return h('div', { color: GOLD, fontSize: 15, fontFamily: 'Sora', fontWeight: 800, letterSpacing: 4, display: 'flex' }, text);
}

// A compact "road" row: stage badge + flag + name of the team the champion beat.
function roadRow(step, lang) {
  const fin = step.stage === 'FINAL';
  return h('div', { display: 'flex', alignItems: 'center', gap: 13 }, [
    h('div', {
      display: 'flex', alignItems: 'center', justifyContent: 'center', width: 66, height: 30,
      borderRadius: 8, background: fin ? 'linear-gradient(140deg,#ecd49a,#d9b46a)' : 'rgba(217,180,106,0.16)',
      border: fin ? '0' : '1px solid rgba(217,180,106,0.5)',
      color: fin ? '#0d0d0a' : GOLD, fontSize: 14, fontFamily: 'Sora', fontWeight: 800,
    }, step.stage),
    flag(step.beat, 44, 30),
    txt(step.beat ? teamName(step.beat, lang) : '—', { color: INK, fontSize: 22, fontFamily: 'Heebo', fontWeight: 700 }),
  ]);
}

// data: { nickname, pool, champ, road:[{stage,beat}], hero (dataURI|null), qr, lang }
// Landscape 1200x630: full-bleed trophy illustration with champion identity
// and a road-to-victory strip. This is the WhatsApp/Open Graph moment.
export function buildCardElement(data) {
  const lang = data.lang === 'en' ? 'en' : 'he';
  const champ = data.champ;
  const road = (data.road || []).filter(s => s && s.beat);

  return h('div', {
    width: '100%', height: '100%', display: 'flex',
    background: '#0b0b08', position: 'relative', fontFamily: 'Heebo',
  }, [
    data.hero
      ? { type: 'img', props: { src: data.hero, width: 1200, height: 630, style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, objectFit: 'cover', objectPosition: '50% 10%' } } }
      : h('div', { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', background: 'linear-gradient(160deg,#16130c,#0b0b08)' }),
    h('div', { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(to bottom, rgba(6,6,4,0.32), rgba(6,6,4,0.02) 36%, rgba(6,6,4,0.52) 64%, #0b0b08 100%)' }),

    h('div', { position: 'absolute', top: 34, left: 52, right: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, [
      h('div', { display: 'flex', alignItems: 'center', gap: 13 }, [
        h('div', { width: 42, height: 42, borderRadius: 11, background: 'linear-gradient(140deg, #d9b46a, #8a6d35)', display: 'flex' }),
        h('div', { color: INK, fontSize: 29, fontFamily: 'Sora', fontWeight: 800, display: 'flex', textShadow: '0 3px 14px rgba(0,0,0,0.85)' }, 'FriendlyBet'),
      ]),
      data.pool ? txt(data.pool, { color: GOLD_LT, fontSize: 20, fontFamily: 'Heebo', fontWeight: 800, textShadow: '0 3px 14px rgba(0,0,0,0.9)' }) : null,
    ].filter(Boolean)),

    h('div', { position: 'absolute', left: 70, right: 70, bottom: 40, display: 'flex', flexDirection: 'column', alignItems: 'center' }, [
      h('div', { color: GOLD, fontSize: 23, fontFamily: 'Sora', fontWeight: 800, letterSpacing: 7, display: 'flex', textShadow: '0 5px 18px #000' }, 'MY ROAD TO VICTORY'),
      h('div', { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 8 }, [
        txt(champ ? teamName(champ, lang) : '-', { color: GOLD_LT, fontSize: 58, fontFamily: 'Sora', fontWeight: 800, textShadow: '0 8px 24px rgba(0,0,0,0.9)' }),
        flag(champ, 76, 50),
      ]),
      road.length ? h('div', { display: 'flex', gap: 10, marginTop: 22, justifyContent: 'center' },
        road.map(step => h('div', {
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          width: step.stage === 'FINAL' ? 148 : 132, height: 84, gap: 5, borderRadius: 14,
          background: step.stage === 'FINAL' ? 'rgba(217,180,106,0.25)' : 'rgba(255,255,255,0.08)',
          border: step.stage === 'FINAL' ? '2px solid rgba(217,180,106,0.7)' : '1px solid rgba(217,180,106,0.28)',
        }, [
          h('div', { color: GOLD, fontSize: 14, fontFamily: 'Sora', fontWeight: 800, display: 'flex' }, step.stage),
          flag(step.beat, 42, 28),
          txt(step.beat ? teamName(step.beat, lang) : '-', { color: INK, fontSize: 16, fontFamily: 'Heebo', fontWeight: 800 }),
        ]))
      ) : h('div', { display: 'flex' }),
      h('div', { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 20 }, [
        h('div', { color: GOLD_LT, fontSize: 26, fontFamily: 'Sora', fontWeight: 800, display: 'flex' }, 'FriendlyBet.Live'),
        txt(lang === 'he' ? 'בנו תחזית משלכם - חינם' : 'build your own bracket - free', { color: MUTED, fontSize: 17, fontFamily: 'Heebo', fontWeight: 700 }),
      ]),
    ]),

    h('div', { position: 'absolute', top: 16, left: 16, right: 16, bottom: 16, border: '2px solid rgba(217,180,106,0.42)', borderRadius: 24 }),
  ].filter(Boolean));
}

function buildLegacyCardElement(data) {
  const lang = data.lang === 'en' ? 'en' : 'he';
  const champ = data.champ;
  const road = (data.road || []).filter(s => s && s.beat); // only resolved steps

  return h('div', {
    width: '100%', height: '100%', display: 'flex', flexDirection: 'row',
    background: '#0b0b08', position: 'relative', fontFamily: 'Heebo',
  }, [
    // ---- LEFT: hero illustration (cover, anchored near the top) ----
    h('div', { display: 'flex', width: 468, height: 630, position: 'relative', overflow: 'hidden' }, [
      data.hero
        ? { type: 'img', props: { src: data.hero, width: 468, height: 630, style: { objectFit: 'cover', objectPosition: '50% 16%' } } }
        : h('div', { width: 468, height: 630, display: 'flex', background: 'linear-gradient(160deg,#16130c,#0b0b08)' }),
      // right-edge fade so the photo melts into the dark panel
      h('div', { position: 'absolute', top: 0, bottom: 0, right: 0, width: 120, background: 'linear-gradient(to right, rgba(11,11,8,0), #0b0b08)' }),
    ]),

    // ---- RIGHT: prediction + road + footer ----
    h('div', { display: 'flex', flexDirection: 'column', flex: 1, padding: '34px 44px 30px 30px', justifyContent: 'space-between' }, [
      // header
      h('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, [
        h('div', { display: 'flex', alignItems: 'center', gap: 12 }, [
          h('div', { width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(140deg, #d9b46a, #8a6d35)', display: 'flex' }),
          h('div', { color: INK, fontSize: 27, fontFamily: 'Sora', fontWeight: 800 }, 'FriendlyBet'),
        ]),
        data.pool ? txt(data.pool, { color: GOLD_LT, fontSize: 17, fontFamily: 'Heebo', fontWeight: 700 }) : null,
      ].filter(Boolean)),

      // champion identity
      h('div', { display: 'flex', flexDirection: 'column', gap: 6 }, [
        h('div', { color: GOLD, fontSize: 19, fontFamily: 'Sora', fontWeight: 800, letterSpacing: 6, display: 'flex' }, 'MY PREDICTION'),
        h('div', { display: 'flex', alignItems: 'center', gap: 16 }, [
          txt(champ ? teamName(champ, lang) : '—', { color: GOLD_LT, fontSize: 52, fontFamily: 'Sora', fontWeight: 800 }),
          flag(champ, 72, 48),
        ]),
      ]),

      // road to the title (only when at least one step resolved)
      road.length ? h('div', { display: 'flex', flexDirection: 'column', gap: 11 }, [
        h('div', { color: MUTED, fontSize: 15, fontFamily: 'Sora', fontWeight: 700, letterSpacing: 4, display: 'flex' }, lang === 'he' ? 'הדרך לתואר' : 'ROAD TO THE TITLE'),
        ...road.map(step => roadRow(step, lang)),
      ]) : h('div', { display: 'flex' }),

      // footer: brand + QR
      h('div', { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }, [
        h('div', { display: 'flex', flexDirection: 'column' }, [
          h('div', { color: GOLD_LT, fontSize: 30, fontFamily: 'Sora', fontWeight: 800, display: 'flex' }, 'FriendlyBet.Live'),
          txt(lang === 'he' ? 'בנו תחזית משלכם — חינם' : 'build your own bracket — free', { color: MUTED, fontSize: 15 }),
        ]),
        data.qr ? h('div', { display: 'flex', padding: 5, background: '#f6f4ee', borderRadius: 9, border: '2px solid #d9b46a' }, [
          { type: 'img', props: { src: data.qr, width: 58, height: 58 } },
        ]) : null,
      ].filter(Boolean)),
    ]),

    // gold frame on top of everything
    h('div', { position: 'absolute', top: 14, left: 14, right: 14, bottom: 14, border: '2px solid rgba(217,180,106,0.35)', borderRadius: 22 }),
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
  // group_position_picks + sp_third_place_picks are anon-readable (verified), so
  // we can resolve the full bracket server-side and derive the champion's road.
  const [usr, pool, ko, tw, gpp, tpp, matches] = await Promise.all([
    q(`users?id=eq.${u}&select=nickname`),
    q(`pools?id=eq.${p}&select=name,betting_mode`),
    rpc('get_public_bracket', { p_user_id: u, p_pool_id: p }),
    q(`tournament_winner_picks?pool_id=eq.${p}&user_id=eq.${u}&select=team_code`),
    q(`group_position_picks?user_id=eq.${u}&pool_id=eq.${p}&select=group_letter,position,team_code`),
    q(`sp_third_place_picks?user_id=eq.${u}&pool_id=eq.${p}&select=group_letter`),
    q(`matches?stage=eq.GROUP_STAGE&status=in.(FINISHED,AWARDED)&select=stage,group_letter,home_team_code,away_team_code,home_score,away_score,status`),
  ]);
  const bp = {};
  (ko || []).forEach(r => { bp[r.bracket_position] = r.predicted_winner; });
  const groupPositions = {};
  (gpp || []).forEach(r => { (groupPositions[r.group_letter] = groupPositions[r.group_letter] || [])[r.position - 1] = r.team_code; });
  let thirdPlaceAdvancers = (tpp || []).map(r => r.group_letter);
  if (pool && pool[0] && pool[0].betting_mode === 'late_knockout') {
    const seed = lateKnockoutSeedFromMatches(matches || []);
    if (seed) {
      Object.keys(groupPositions).forEach(k => delete groupPositions[k]);
      Object.assign(groupPositions, seed.groupPositions);
      thirdPlaceAdvancers = seed.thirdPlaceAdvancers;
    }
  }
  const champ = (tw && tw[0] && tw[0].team_code) || bp[31] || null;
  const road = championRoad({ groupPositions, thirdPlaceAdvancers, bracketPicks: bp, tournamentWinner: champ });
  return {
    nickname: (usr && usr[0] && usr[0].nickname) || (lang === 'he' ? 'שחקן' : 'Player'),
    pool: (pool && pool[0] && pool[0].name) || '',
    champ,
    road,
    lang,
  };
}

export { teamName, flagSrc };
