#!/usr/bin/env node
/*
 * Simulateur d'équilibrage pour « Démocratie ».
 * Extrait le moteur de jeu de index.html et joue des milliers de parties
 * avec différents profils de joueurs (bots), puis affiche la répartition des fins.
 *
 * Usage : node tools/simulate.js [nbParties=2000] [difficulté=normal]
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const ctx = { console, Math };
vm.createContext(ctx);
vm.runInContext(code + '\n;this.Engine=Engine;this.makeRng=makeRng;this.ENDINGS=ENDINGS;this.EVENTS=EVENTS;this.bilan=bilan;', ctx);
const { Engine, makeRng, EVENTS } = ctx;

const N = +process.argv[2] || 2000;
const DIFF = process.argv[3] || 'normal';

/* --------- Profils de joueurs --------- */
const KEYS = ['pop', 'eco', 'secu', 'lib', 'integ', 'intl', 'inst'];

/** Évalue un choix selon des poids ; "need" accentue les indicateurs faibles. */
function evalChoice(G, c, w, opts = {}) {
  const fx = c.fx || {};
  let sc = 0;
  for (const k of KEYS) {
    if (!fx[k]) continue;
    let ww = w[k] || 1;
    if (opts.need) ww *= 1 + Math.max(0, 50 - G.s[k]) / 25;
    sc += fx[k] * ww;
  }
  if (fx.treso) sc += fx.treso * (w.treso || 0.5) * (opts.need && G.s.treso < 0 ? 1.8 : 1);
  if (fx.opp) sc -= fx.opp * (w.opp || 0.5);
  if (fx.campaign) sc += fx.campaign * (w.campaign || 0);
  if (fx.bonus) sc += fx.bonus * (w.bonus || 0);
  if (c.auth) sc -= (w.authPenalty || 0);
  if (c.auth) sc += (w.authBonus || 0);
  if (c.risk) sc -= (w.riskAversion || 0);
  if (c.later) sc += (w.later || 0);
  if (w.flagArmy && c.flag === 'armyLoyal') sc += w.flagArmy;
  if (w.flagArmy && c.flag === 'postponed') sc += G.s.pop < 50 ? 20 : -20;
  return sc;
}

const BOTS = {
  aleatoire: G => Math.floor(G.rng() * Engine.currentCard(G).choices.length),
  premier: () => 0,
  naif: G => { const cs = Engine.currentCard(G).choices; const ok = cs.map((c, i) => i).filter(i => !cs[i].auth); return ok[Math.floor(G.rng() * ok.length)]; },
  populiste: G => best(G, { pop: 3, eco: 0.5, secu: 0.5, treso: 0.2, opp: 1 }, { need: true }),
  autoritaire: G => {
    const cs = Engine.currentCard(G).choices;
    const i = cs.findIndex(c => c.auth);
    return i >= 0 ? i : best(G, { pop: 1, secu: 1, treso: 0.4 }, { need: true });
  },
  integre: G => best(G, { integ: 3, lib: 2, inst: 2, intl: 1, pop: 0.5, treso: 0.4, authPenalty: 100 }, { need: true }),
  econome: G => best(G, { treso: 2, eco: 2, pop: 0.3, authPenalty: 30 }, { need: true }),
  equilibre: G => best(G, { pop: 1.3, eco: 1.1, secu: 0.9, lib: 0.8, integ: 1, intl: 0.6, inst: 0.8, treso: 0.6, opp: 0.6, authPenalty: 12, riskAversion: 1.5 }, { need: true }),
  autocrate: G => best(G, { pop: 1.4, eco: 1.1, secu: 1.2, lib: 0.2, integ: 0.4, intl: 0.9, inst: 0.4, treso: 0.7, opp: 1, campaign: 0.4, bonus: 2, authBonus: 4, flagArmy: 15 }, { need: true }),
  cynique: G => best(G, { pop: 1.4, eco: 1.1, secu: 0.9, lib: 0.5, integ: 0.6, intl: 0.5, inst: 0.6, treso: 0.6, opp: 0.8, campaign: 0.4, bonus: 2, authPenalty: 3 }, { need: true }),
};
function best(G, w, opts) {
  const cs = Engine.currentCard(G).choices;
  let bi = 0, bs = -1e9;
  cs.forEach((c, i) => { const s = evalChoice(G, c, w, opts) + G.rng() * 0.5; if (s > bs) { bs = s; bi = i; } });
  return bi;
}

/** Joue une partie complète ; renvoie l'objet partie final. */
function play(bot, seed) {
  const G = Engine.create({ rng: makeRng(seed), difficulty: DIFF });
  while (!G.ending) {
    Engine.beginMonth(G);
    while (!G.ending && G.idx < G.pending.length) Engine.choose(G, bot(G));
    if (G.ending) break;
    const sum = Engine.endMonth(G);
    if (!G.ending && sum.election && sum.election.contest) {
      // défaite : la plupart des bots reconnaissent, l'autoritaire conteste
      const cs = G.pending[0].choices;
      const i = (bot === BOTS.autoritaire || bot === BOTS.autocrate) ? cs.findIndex(c => c.auth) : 0;
      Engine.choose(G, i);
    }
    if (G.turn > 60) throw new Error('boucle infinie');
  }
  return G;
}

/* --------- Rapport --------- */
const pct = (a, b) => (100 * a / b).toFixed(0).padStart(3) + '%';
console.log(`\n=== ${N} parties par profil — difficulté ${DIFF} ===\n`);
const header = 'profil       | réélu | entaché | défaite | autocr. | chute | mois moy | score moy | vote moy | auth moy | derive moy';
console.log(header); console.log('-'.repeat(header.length));
const evCount = {};
for (const [name, bot] of Object.entries(BOTS)) {
  const c = {}; let months = 0, score = 0, vote = 0, nv = 0, auth = 0, der = 0;
  const falls = {};
  for (let i = 0; i < N; i++) {
    const G = play(bot, 1000 + i);
    const id = G.ending.id;
    c[id] = (c[id] || 0) + 1;
    if (['coup', 'revolution', 'destitution', 'faillite', 'sanctions'].includes(id)) falls[id] = (falls[id] || 0) + 1;
    months += G.turn; score += G.ending.score; auth += G.stats.auth; der += G.s.derive;
    if (G.electionResult) { vote += G.electionResult.vote; nv++; }
    if (name === (process.env.COV || 'aleatoire')) for (const id2 in G.lastSeen) evCount[id2] = (evCount[id2] || 0) + 1;
  }
  const chute = Object.values(falls).reduce((a, b) => a + b, 0);
  console.log(`${name.padEnd(12)} | ${pct(c.reelu || 0, N)}  |  ${pct(c.reelu_entache || 0, N)}   |  ${pct((c.defaite || 0) + (c.defaite_amere || 0), N)}   |  ${pct(c.autocrate || 0, N)}   | ${pct(chute, N)}  |   ${(months / N).toFixed(1)}   |   ${(score / N).toFixed(0).padStart(5)}   |   ${nv ? (vote / nv).toFixed(1) : '  - '}   |   ${(auth / N).toFixed(1).padStart(4)}   |   ${(der / N).toFixed(0)}`);
  console.log(`${''.padEnd(12)}   chutes : ${Object.entries(falls).map(([k, v]) => `${k} ${pct(v, N)}`).join(', ') || '—'}`);
}
console.log(`\n${EVENTS.length} événements définis. Part des parties (profil ${process.env.COV || 'aleatoire'}) où chaque événement apparaît au moins une fois :`);
console.log(Object.entries(evCount).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${pct(v, N).trim()}`).join('  '));

/* --------- Trajectoires moyennes (option --traj) --------- */
if (process.argv.includes('--traj')) {
  for (const name of (process.env.BOTS || 'naif,equilibre,autocrate').split(',')) {
    const acc = {}; const cnt = {};
    for (let i = 0; i < 300; i++) {
      const G = play(BOTS[name], 5000 + i);
      for (const h of G.history) if (h.turn % 8 === 0) {
        acc[h.turn] = acc[h.turn] || {}; cnt[h.turn] = (cnt[h.turn] || 0) + 1;
        for (const k of [...KEYS, 'treso', 'opp', 'derive']) acc[h.turn][k] = (acc[h.turn][k] || 0) + h[k];
      }
    }
    console.log(`\n-- ${name} --`);
    for (const t in acc) console.log(`t${t.padStart(2)} (n=${String(cnt[t]).padStart(3)}) ` + Object.entries(acc[t]).map(([k, v]) => `${k}:${(v / cnt[t]).toFixed(0)}`).join(' '));
  }
}
