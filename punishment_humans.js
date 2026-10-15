'use strict';

// Human punishment and counterconditioning study for jsPsych 8/Pavlovia.
// The operant phases use independent Bernoulli RI-15 clocks for Q and P.

const EXP_NAME = 'punishment_counterconditioning_humans';
const EXP_VERSION = '5.3.0-response-fields';
const ASSET_VERSION = '5.3.0'; // Must match the ?v= strings in index.html.
const query = new URLSearchParams(window.location.search);

function rawUrlValue(name, fallback = '') {
  const value = query.get(name);
  return value === null ? fallback : value.trim();
}

// A real Prolific link always carries at least one of these. When any is
// present the URL belongs to a live participant, so every developer mode is
// refused outright and the full experiment runs. This is what makes smoke
// mode impossible to trigger accidentally during recruitment.
const HAS_LIVE_RECRUITMENT_PARAMS = Boolean(
  rawUrlValue('PROLIFIC_PID')
  || rawUrlValue('STUDY_ID')
  || rawUrlValue('SESSION_ID')
  || rawUrlValue('completion_url'),
);
const REQUESTED_MODE = rawUrlValue('test_mode');
const MODE_BLOCKED = Boolean(REQUESTED_MODE) && HAS_LIVE_RECRUITMENT_PARAMS;
const ACTIVE_MODE = MODE_BLOCKED ? '' : REQUESTED_MODE;
const KNOWN_MODES = ['', 'smoke', 'quick', '1', 'clase'];
// An unrecognised test_mode used to fall through to the full 26-minute study
// in silence, which is indistinguishable from a stale cached script. On a
// developer URL we now stop and say so. On a live recruitment URL we still
// fail safe and run the full experiment, because a participant must never be
// shown an error over a malformed query string.
const UNKNOWN_MODE = !MODE_BLOCKED && !KNOWN_MODES.includes(ACTIVE_MODE);

// Developer-only. Never a source of scientific data.
const SMOKE_MODE = ACTIVE_MODE === 'smoke';
const QUICK_MODE = ACTIVE_MODE === 'quick';
const TEST_MODE = SMOKE_MODE || QUICK_MODE || ACTIVE_MODE === '1';
// Modo "clase": versión corta (45 s por fase, 3 + 3 contracondicionamiento) pero
// con la interfaz real en español y SIN banner ni pantallas de desarrollador.
// Para mostrar el paradigma en clases. No es modo de desarrollador (TEST_MODE),
// por lo que las instrucciones y los títulos de fase salen normales en español.
const CLASS_MODE = ACTIVE_MODE === 'clase';
const PILOT_MODE = SMOKE_MODE ? 'smoke' : (QUICK_MODE ? 'quick' : (CLASS_MODE ? 'class' : (TEST_MODE ? 'short' : 'full')));
const IS_PAVLOVIA = /(^|\.)pavlovia\.org$/i.test(window.location.hostname);

function modeValue(fullValue, shortValue, quickValue, smokeValue) {
  if (CLASS_MODE) return smokeValue;   // misma duración corta que smoke
  if (SMOKE_MODE) return smokeValue;
  if (QUICK_MODE) return quickValue;
  if (TEST_MODE) return shortValue;
  return fullValue;
}

// Pilot mode (test_mode=smoke) is the real task with only two things changed:
// 45-second operant phases, and 3 + 3 counterconditioning trials instead of
// 12 + 12. Every other value below is identical to a full run, so what the
// pilot shows is the density and pacing participants actually get. Compressing
// the reward schedule or the sound gaps would make the pilot look livelier
// than the study and would be worse than useless for judging it.
const PARAMETERS = Object.freeze({
  trainingMs: modeValue(300, 20, 5, 45) * 1000,
  punishmentMs: modeValue(300, 20, 5, 45) * 1000,
  testMs: modeValue(150, 20, 5, 45) * 1000,
  reacquisitionMs: modeValue(300, 20, 5, 45) * 1000,
  // Real RI-15 in the pilot. A 45-second phase therefore yields about three
  // coins per key, which is exactly the rate a participant experiences.
  riTSeconds: modeValue(15, 2, 1, 15),
  counterconditioningGunshotTrials: modeValue(12, 3, 1, 3),
  counterconditioningWhiteNoiseTrials: modeValue(12, 3, 1, 3),
  // Both CSs are 0.920 s recordings, so a 2 s interval leaves 1.08 s of
  // silence before the outcome in both cases.
  csUsIsiMs: modeValue(2, 0.7, 0.4, 2) * 1000,
  // Raised from 1.3 s so the ten-coin cascade finishes well inside the window.
  // The empty bag is shown for exactly as long, so the two trial types are
  // matched in structure and differ only in whether coins arrive.
  largeRewardShowMs: modeValue(1.8, 0.9, 0.5, 1.8) * 1000,
  firstSoundDelayMinMs: modeValue(2, 0.4, 0.2, 2) * 1000,
  firstSoundDelayMaxMs: modeValue(4, 0.7, 0.3, 4) * 1000,
  // Real gaps in the pilot. With 3 + 3 trials these put the phase at about
  // 60 seconds, which is what makes the pacing judgeable at all.
  oppositeSoundMinGapMs: modeValue(10, 2, 0.9, 10) * 1000,
  oppositeSoundMaxGapMs: modeValue(14, 2.6, 1.1, 14) * 1000,
  sameSoundMinGapMs: modeValue(7, 1.4, 0.7, 7) * 1000,
  sameSoundMaxGapMs: modeValue(11, 2, 0.9, 11) * 1000,
  coinFlashMs: modeValue(0.65, 0.45, 0.3, 0.65) * 1000,
  // Smoke mode only: phase-transition cards still accept space, but also
  // advance on their own after this long, so a run needs no clicking.
  autoAdvanceInstructionMs: SMOKE_MODE ? 4000 : null,
  // Punishment is a plain FR 5 on the punished key in every mode.
  //
  // Varas et al. tailored the ratio per subject to equate shock exposure,
  // because rat press rates vary by large factors. Human rates on this task
  // are tight (Perez et al.: ~2/s, 200-250 actions per 2-min block), so a flat
  // ratio equates the response-punisher contingency at no real cost in
  // exposure balance. The density is deliberate: one 300 s phase has to do
  // what 12 sessions did for the rats. See the README.
  punishmentFr: 5,
  // Kept only for the record: what the tailored rule would have produced.
  targetPunishersReference: 10,
  // Every coin value shown on screen is derived from this single number.
  // Nothing else may hardcode a CLP figure.
  //
  // $20 CLP per coin. With ~130 coins expected the mean bonus is ~$2.600 CLP,
  // on top of a $5.000 CLP base. The bonus paid/shown is capped at bonusCapClp.
  // See PARAMETROS_experimento_CLP.md for the full breakdown.
  rewardValueClp: 20,
  largeRewardCoins: 5,
  pendingOutcomeCap: 1,
  changeoverCountCap: 2,
  phaseCount: 5,
  // Planning estimate used only for the expected-payment metadata: ~70 coins
  // across the four operant phases (20+20+10+20) plus 12 x 5 = 60 fixed
  // counterconditioning coins = 130. Actual operant collection varies under
  // RI-15, so the real payout can differ; bonusCapClp bounds it.
  expectedTotalCoins: 130,
  // Pago base en CLP (protocolo FINAL).
  basePaymentClp: 5000,
  // Tope del bono en CLP: el bono mostrado y pagado nunca supera este monto.
  bonusCapClp: 3000,
});

const FILES = Object.freeze({
  gunshot: 'resources/loud_bang.wav',
  whiteNoise: 'resources/neutral.wav',
});

const KEY_TOKEN = Object.freeze({ q: 'blue', p: 'red' });

const urlValue = rawUrlValue;

// Storage can throw in private-browsing or embedded contexts, so every access
// is guarded. Losing storage degrades to a fresh draw rather than an error.
function safeStorageGet(name) {
  try {
    return sessionStorage.getItem(name);
  } catch (error) {
    return null;
  }
}

function safeStorageSet(name, value) {
  try {
    sessionStorage.setItem(name, value);
  } catch (error) {
    // Non-fatal: the assignment simply will not survive a reload.
  }
}

function makePilotId() {
  const saved = safeStorageGet('punishmentPilotId');
  if (saved) return saved;
  const id = `PILOT_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  safeStorageSet('punishmentPilotId', id);
  return id;
}

function uniform(low, high) {
  return low + Math.random() * (high - low);
}

function shuffle(values) {
  const copy = values.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

function money(clp) {
  return '$' + Math.round(clp).toLocaleString('es-CL');
}

// Trims float noise so 2 renders as "2" and 2.5 as "2.5".
function clpNumber(clp) {
  return Number(Number(clp).toFixed(2));
}

function tokenHtml(color, extraClass = '', clp = PARAMETERS.rewardValueClp) {
  const value = clpNumber(clp);
  return `<span class="game-token token-${color} ${extraClass}" aria-label="${color} ${value} pesos"><span class="coin-value"><span>$${value}</span></span></span>`;
}

// Row sizes for a settled pile, bottom row first: 10 coins give 4, 3, 2, 1.
// Derived from the coin count so the display follows largeRewardCoins.
function pileRows(count) {
  const rows = [];
  let remaining = count;
  let width = Math.max(1, Math.ceil((Math.sqrt((8 * count) + 1) - 1) / 2));
  while (remaining > 0) {
    const inRow = Math.min(width, remaining);
    rows.push(inRow);
    remaining -= inRow;
    width = Math.max(1, width - 1);
  }
  return rows;
}

// The coins cascade into a transparent bag, bottom row first, so the pile
// visibly builds up. The cascade starts at reward onset, so the CS-US interval
// measured to the first coin is unchanged by the coin count.
function largeRewardHtml(color) {
  const coins = PARAMETERS.largeRewardCoins;
  const each = clpNumber(PARAMETERS.rewardValueClp);
  const total = clpNumber(coins * PARAMETERS.rewardValueClp);
  // Keep the whole cascade inside the display window in every mode.
  const stagger = Math.min(38, (PARAMETERS.largeRewardShowMs * 0.4) / coins);
  const COIN = 46;
  const STEP_X = 40;
  const STEP_Y = 30;
  const CENTRE_X = 165;
  const BOTTOM_Y = 150;

  const tokens = [];
  let index = 0;
  pileRows(coins).forEach((inRow, rowIndex) => {
    const rowWidth = ((inRow - 1) * STEP_X) + COIN;
    const startX = CENTRE_X - (rowWidth / 2);
    for (let n = 0; n < inRow; n += 1) {
      const left = Math.round(startX + (n * STEP_X));
      const top = BOTTOM_Y - (rowIndex * STEP_Y);
      const tilt = ((index % 3) - 1) * 8;
      const delay = Math.round(index * stagger);
      tokens.push(
        `<span class="cluster-token" style="left:${left}px;top:${top}px;`
        + `--tilt:${tilt}deg;animation-delay:${delay}ms">${tokenHtml(color)}</span>`,
      );
      index += 1;
    }
  });

  return `
    <div class="big-reward-burst reward-${color}" aria-label="${coins} monedas de $${each}">
      <div class="reward-glow"></div>
      <div class="reward-bag-back" aria-hidden="true"></div>
      ${tokens.join('')}
      <div class="reward-bag-front" aria-hidden="true"></div>
      <div class="reward-total"><strong>${coins} × $${each}</strong><span>+$${total}</span></div>
    </div>`;
}

// The white-noise outcome: the same bag, at the same point in the trial, for
// the same duration, but empty. Matching the structure of the two trial types
// leaves the arrival of coins as the only difference between them.
function emptyRewardHtml() {
  return `
    <div class="big-reward-burst is-empty" aria-label="Una bolsa vacía, sin monedas">
      <div class="reward-bag-back" aria-hidden="true"></div>
      <div class="reward-bag-front" aria-hidden="true"></div>
      <div class="reward-total is-empty"><strong>Vacía</strong><span>+$0</span></div>
    </div>`;
}

const prolificPid = urlValue('PROLIFIC_PID');
const studyId = urlValue('STUDY_ID');
const prolificSessionId = urlValue('SESSION_ID');
const participantId = prolificPid || urlValue('participant') || makePilotId();
const completionUrl = urlValue('completion_url');

// Which key is punished is drawn at random, once, on the first load.
//
// The draw is persisted for the tab session so that a reload cannot reassign a
// participant mid-task. It is stored per participant id, so switching ids while
// testing draws afresh rather than inheriting the previous assignment.
//
// Because this is a simple random draw rather than block randomisation, group
// sizes will not come out exactly equal: at n = 200 expect an imbalance of
// roughly +/- 7 per arm. Check the split before analysis.
const PUNISHED_KEY_STORAGE = `punishedKey:${participantId}`;

function assignPunishedKey() {
  // Explicit override for testing a chosen arm. Refused on any URL carrying
  // live recruitment parameters, so a participant's assignment can never be
  // set from the address bar.
  const requested = urlValue('punished').toLowerCase();
  if (!HAS_LIVE_RECRUITMENT_PARAMS && (requested === 'q' || requested === 'p')) {
    return { key: requested, method: 'url_override', draw: null };
  }

  const stored = safeStorageGet(PUNISHED_KEY_STORAGE);
  if (stored === 'q' || stored === 'p') {
    return { key: stored, method: 'random_restored', draw: null };
  }

  const draw = Math.random();
  const key = draw < 0.5 ? 'q' : 'p';
  safeStorageSet(PUNISHED_KEY_STORAGE, key);
  return { key, method: 'random', draw };
}

const allocation = assignPunishedKey();
const punishedKey = allocation.key;
const controlKey = punishedKey === 'q' ? 'p' : 'q';
const punishedColor = KEY_TOKEN[punishedKey];

// Between-subjects intervention group, drawn independently of the punished key.
//
//   gunshot_paired  gunshot -> ten coins, white noise -> empty bag
//   noise_paired    white noise -> ten coins, gunshot -> empty bag
//
// Both groups receive the same 12 gunshots, the same 12 white-noise
// presentations, the same 12 ten-coin rewards and the same trial structure.
// The only thing that differs is which CS predicts the reward. Exposure to the
// gunshot is therefore equated, so habituation to it cannot explain a group
// difference in recovery of the punished action.
const GROUP_STORAGE = `ccGroup:${participantId}`;

function assignGroup() {
  const requested = urlValue('group').toLowerCase();
  if (!HAS_LIVE_RECRUITMENT_PARAMS
    && (requested === 'bang_paired' || requested === 'neutro_paired')) {
    return { group: requested, method: 'url_override', draw: null };
  }

  const stored = safeStorageGet(GROUP_STORAGE);
  if (stored === 'bang_paired' || stored === 'neutro_paired') {
    return { group: stored, method: 'random_restored', draw: null };
  }

  const draw = Math.random();
  const group = draw < 0.5 ? 'bang_paired' : 'neutro_paired';
  safeStorageSet(GROUP_STORAGE, group);
  return { group, method: 'random', draw };
}

const groupAllocation = assignGroup();
const ccGroup = groupAllocation.group;
// The CS that is followed by the ten-coin bag for this participant.
const REWARDED_CS = ccGroup === 'bang_paired' ? 'bang' : 'neutro';
const UNREWARDED_CS = REWARDED_CS === 'bang' ? 'neutro' : 'bang';

// Derived, so the recorded labels follow both the group and the coin count.
const PAIRING_LABEL = `${REWARDED_CS}_to_${PARAMETERS.largeRewardCoins}_coins`;
const UNPAIRED_LABEL = `${UNREWARDED_CS}_to_empty_bag`;

const state = {
  earningsClp: 0,
  // Constant for the whole session now that punishment is a flat FR.
  fr: PARAMETERS.punishmentFr,
  tailoredFr: null,
  punishedKeyResponseRate: null,
  currentPhase: 'initialising',
  aborted: false,
  counterconditioningStartMs: null,
  lastSoundOnsetMs: null,
  lastSoundType: '',
};

const metadata = {
  participant: participantId,
  experiment: 1,
  intervention: ccGroup === 'bang_paired' ? 'counterconditioning' : 'control_noise_paired',
  cc_group: ccGroup,
  rewarded_cs: REWARDED_CS,
  unrewarded_cs: UNREWARDED_CS,
  group_allocation_method: groupAllocation.method,
  group_allocation_random_draw: groupAllocation.draw,
  allocation_method: allocation.method,
  allocation_random_draw: allocation.draw,
  punished_key: punishedKey,
  control_key: controlKey,
  punished_token_color: punishedColor,
  prolific_pid: prolificPid,
  prolific_study_id: studyId,
  prolific_session_id: prolificSessionId,
  experiment_name: EXP_NAME,
  experiment_version: EXP_VERSION,
  asset_version: ASSET_VERSION,
  test_mode: TEST_MODE ? 1 : 0,
  pilot_mode: PILOT_MODE,
  // 1 only when a developer mode was requested on a URL carrying live
  // recruitment parameters and was therefore refused.
  developer_mode_blocked: MODE_BLOCKED ? 1 : 0,
  requested_test_mode: REQUESTED_MODE,
  analysable: PILOT_MODE === 'full' ? 1 : 0,
  browser_user_agent: navigator.userAgent,
  screen_width: window.screen.width,
  screen_height: window.screen.height,
  reward_value_clp: PARAMETERS.rewardValueClp,
  large_reward_coins: PARAMETERS.largeRewardCoins,
  large_reward_clp: PARAMETERS.rewardValueClp * PARAMETERS.largeRewardCoins,
  expected_total_coins: PARAMETERS.expectedTotalCoins,
  expected_bonus_clp: PARAMETERS.expectedTotalCoins * PARAMETERS.rewardValueClp,
  base_payment_clp: PARAMETERS.basePaymentClp,
  expected_total_clp:
    PARAMETERS.basePaymentClp
    + (PARAMETERS.expectedTotalCoins * PARAMETERS.rewardValueClp),
  reward_schedule: 'independent_bernoulli_ri_per_key',
  ri_parameter_s: PARAMETERS.riTSeconds,
  ri_probability_per_second: 1 / PARAMETERS.riTSeconds,
  pending_outcome_cap: PARAMETERS.pendingOutcomeCap,
  changeover_count_cap: PARAMETERS.changeoverCountCap,
  punishment_fr: PARAMETERS.punishmentFr,
  fr_rule: 'fixed',
  max_interval_multiplier: 3,
  max_interval_s: PARAMETERS.riTSeconds * 3,
  cs_us_isi_s: PARAMETERS.csUsIsiMs / 1000,
  opposite_sound_minimum_gap_s: PARAMETERS.oppositeSoundMinGapMs / 1000,
};

const jsPsych = initJsPsych({
  show_progress_bar: false,
  on_finish: () => {
    if (!IS_PAVLOVIA && !state.aborted) {
      const safeId = participantId.replace(/[^a-zA-Z0-9_-]/g, '_');
      jsPsych.data.get().localSave('csv', `castigo_${safeId}.csv`);
      document.body.innerHTML = [
        '<main class="message-shell">',
        '<section class="task-message completion-card">',
        '<div class="message-icon message-icon-success">✓</div>',
        '<p class="eyebrow">Listo</p>',
        '<h1>Tus datos se han descargado</h1>',
        '<p>Gracias por participar.</p>',
        '</section>',
        '</main>',
      ].join('');
    }
  },
});

jsPsych.data.addProperties(metadata);

const gunshotAudio = new Audio(FILES.gunshot);
const whiteNoiseAudio = new Audio(FILES.whiteNoise);
gunshotAudio.preload = 'auto';
whiteNoiseAudio.preload = 'auto';

function playSound(type) {
  const audio = type === 'bang' ? gunshotAudio : whiteNoiseAudio;
  audio.pause();
  audio.currentTime = 0;
  const playPromise = audio.play();
  if (playPromise && typeof playPromise.catch === 'function') {
    playPromise.catch(() => {});
  }
}

function phaseHeading(number, testName) {
  if (SMOKE_MODE) return `Smoke test — ${testName}`;
  if (QUICK_MODE) return `Quick test — ${testName}`;
  return TEST_MODE ? `Short test — ${testName}` : `Parte ${number} de ${PARAMETERS.phaseCount}`;
}

function messageHtml(
  eyebrow,
  title,
  paragraphs,
  prompt = 'Presiona la barra espaciadora para continuar.',
  keyPrompt = !SMOKE_MODE,
) {
  const body = paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('');
  const footer = keyPrompt
    ? `<div class="space-prompt"><kbd>ESPACIO</kbd><span>${prompt}</span></div>`
    : '<div class="space-prompt"><kbd>ESPACIO</kbd><span>Presiona la barra espaciadora '
      + 'para continuar, o espera — esta pantalla avanza sola.</span></div>';
  return `
    <main class="message-shell">
      <section class="task-message">
        <p class="eyebrow">${eyebrow}</p>
        <h1>${title}</h1>
        ${body}
        ${footer}
      </section>
    </main>`;
}

// In smoke mode every phase-transition card both accepts space and times out,
// so a run needs no clicking but is never faster than you can read.
function messageTrial(eyebrow, title, paragraphs, event = 'instruction') {
  const trial = {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: messageHtml(eyebrow, title, paragraphs),
    choices: [' '],
    data: { event, earnings_clp: () => state.earningsClp, fr: () => state.fr },
  };
  if (SMOKE_MODE) trial.trial_duration = PARAMETERS.autoAdvanceInstructionMs;
  return trial;
}

// The one screen smoke mode still gates on a key press. Keeping it is
// deliberate: a keydown supplies the user activation that browsers require
// before any audio may play, so without it the gunshot would be silently
// suppressed and the smoke test would prove nothing about the sounds.
function smokeStartTrial() {
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: messageHtml(
      'Developer pilot run',
      'Not for data collection',
      [
        `This runs the whole five-phase sequence with <strong>${PARAMETERS.trainingMs / 1000}-second</strong> operant phases and ${PARAMETERS.counterconditioningGunshotTrials} gunshot plus ${PARAMETERS.counterconditioningWhiteNoiseTrials} white-noise trials. It takes about four and a half minutes.`,
        'Everything else is at its real setting, including the RI-15 reward schedule and the counterconditioning gaps, so the coin rate and pacing are what participants actually get. Coins are deliberately sparse: expect roughly three per key per phase.',
        `Press <strong>Q</strong> and <strong>P</strong> freely during the response phases. The punished key is <strong>${punishedKey.toUpperCase()}</strong>, and its fixed ratio is calculated from your own training rate exactly as in the real task.`,
        'Every screen from here can be advanced with the space bar, or left to advance on its own. Nothing needs clicking.',
      ],
      'Press the space bar to start.',
      true,
    ),
    choices: [' '],
    data: { event: 'smoke_start' },
  };
}

// A persistent corner banner in every developer mode, so a shortened run can
// never be mistaken on screen or in a screen recording for a real session.
function showDevBanner() {
  if (!TEST_MODE) return;
  const banner = document.createElement('div');
  banner.className = 'dev-banner';
  banner.setAttribute('role', 'status');
  // The version is shown so a stale cached script is obvious on sight.
  banner.textContent = `Developer ${PILOT_MODE} mode · v${ASSET_VERSION} — not scientific data`;
  document.body.appendChild(banner);
}

// Aviso discreto para la demo de clase: recuerda que la barra espaciadora salta
// a la siguiente fase. Solo en modo clase.
function showClassHint() {
  if (!CLASS_MODE) return;
  const hint = document.createElement('div');
  hint.setAttribute('role', 'status');
  hint.textContent = 'Demo — barra espaciadora: saltar a la siguiente fase';
  hint.setAttribute('style', 'position:fixed;bottom:10px;left:50%;'
    + 'transform:translateX(-50%);z-index:9999;padding:6px 14px;border-radius:999px;'
    + 'background:rgba(23,36,60,.82);color:#fff;'
    + 'font:600 12px/1 Inter,system-ui,sans-serif;letter-spacing:.02em;'
    + 'pointer-events:none;');
  document.body.appendChild(hint);
}

// Salto de la fase pasiva de contracondicionamiento con la barra espaciadora.
// Solo en modo clase: en un run real la fase no se puede saltar.
let ccSkipHandler = null;
function enableCcSkip() {
  if (!CLASS_MODE) return;
  window.__ccSkipFlag = false;
  ccSkipHandler = (e) => {
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      window.__ccSkipFlag = true;   // los sub-ensayos restantes del CC se omiten
      jsPsych.finishTrial();        // termina el sub-ensayo en curso
    }
  };
  // Pequeño retardo: evita que el MISMO espacio que avanzó a esta fase dispare el salto.
  window.setTimeout(() => {
    if (ccSkipHandler) document.addEventListener('keydown', ccSkipHandler, { passive: false });
  }, 300);
}
function disableCcSkip() {
  if (ccSkipHandler) {
    document.removeEventListener('keydown', ccSkipHandler);
    ccSkipHandler = null;
  }
}

// Shown instead of the experiment when a developer URL names a mode this build
// does not have. Nearly always a stale cached script or a typo.
function showUnknownModeScreen() {
  document.body.innerHTML = `
    <main class="message-shell">
      <section class="task-message">
        <p class="eyebrow">Developer error</p>
        <h1>Unrecognised test_mode</h1>
        <p>This build (<strong>v${ASSET_VERSION}</strong>) does not support
           <strong>test_mode=${REQUESTED_MODE.replace(/[<>&"]/g, '')}</strong>.</p>
        <p>Supported values are <strong>smoke</strong>, <strong>quick</strong>
           and <strong>1</strong>. If you expected one of these to work, you are
           probably running a cached older script: reload with
           <strong>Cmd/Ctrl + Shift + R</strong>.</p>
        <p>The experiment has not started. No data were recorded.</p>
      </section>
    </main>`;
}

// jsPsych 8 snapshots `trial.data` before `on_start` runs, so anything written
// to trial.data there is silently discarded. Runtime values must be written in
// `on_finish` (or supplied as dynamic-parameter functions) to reach the file.
function markerTrial(phase, event, onStart = null, extraData = null) {
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: '',
    choices: 'NO_KEYS',
    trial_duration: 1,
    data: { phase, event },
    on_start: () => {
      state.currentPhase = phase;
      if (onStart) onStart();
    },
    on_finish: (data) => {
      data.earnings_clp = state.earningsClp;
      data.points = state.earningsClp;
      data.fr = state.fr;
      if (extraData) Object.assign(data, extraData());
    },
  };
}

function operantTrial(phase, phaseNumber, durationMs, punishMode, testName) {
  return {
    type: jsPsychFreeOperantRi,
    phase,
    phase_number: phaseNumber,
    phase_count: PARAMETERS.phaseCount,
    phase_label: QUICK_MODE
      ? `Quick test · ${testName}`
      : (TEST_MODE ? `Short test · ${testName}` : `Parte ${phaseNumber} de ${PARAMETERS.phaseCount}`),
    duration_ms: durationMs,
    stop_at_coins: null,
    ri_t_seconds: PARAMETERS.riTSeconds,
    reward_value_clp: PARAMETERS.rewardValueClp,
    starting_earnings_clp: () => state.earningsClp,
    fr: () => state.fr,
    punish_mode: punishMode,
    punished_key: punishedKey,
    key_token: KEY_TOKEN,
    aversive_audio: FILES.gunshot,
    coin_flash_ms: PARAMETERS.coinFlashMs,
    bonus_cap: PARAMETERS.bonusCapClp,
    allow_skip: CLASS_MODE,
    event_metadata: metadata,
    data: { phase, session: 1, block: 1 },
    on_start: () => {
      state.currentPhase = phase;
    },
    on_finish: (data) => {
      state.earningsClp = data.earnings_clp_end;
      if (data.aborted) state.aborted = true;
    },
  };
}

function hasLongRun(order) {
  return order.some((value, index) => (
    index >= 2 && value === order[index - 1] && value === order[index - 2]
  ));
}

function buildSoundOrder() {
  const values = [
    ...Array(PARAMETERS.counterconditioningGunshotTrials).fill('bang'),
    ...Array(PARAMETERS.counterconditioningWhiteNoiseTrials).fill('neutro'),
  ];
  for (let attempt = 0; attempt < 10000; attempt += 1) {
    const candidate = shuffle(values);
    if (!hasLongRun(candidate)) return candidate;
  }
  throw new Error('Could not construct the counterconditioning sound order.');
}

// Both trial types now run CS, then the same interval, then an outcome shown
// for the same duration, so this no longer depends on the sound type.
function previousTrialDuration() {
  return PARAMETERS.csUsIsiMs + PARAMETERS.largeRewardShowMs;
}

function buildCounterconditioningSchedule() {
  const order = buildSoundOrder();
  return order.map((type, index) => {
    if (index === 0) {
      return {
        trialNumber: 1,
        type,
        previousType: '',
        preItiMs: Math.round(uniform(
          PARAMETERS.firstSoundDelayMinMs,
          PARAMETERS.firstSoundDelayMaxMs,
        )),
        plannedOnsetGapMs: null,
      };
    }
    const previousType = order[index - 1];
    const opposite = previousType !== type;
    const plannedOnsetGapMs = Math.round(opposite
      ? uniform(PARAMETERS.oppositeSoundMinGapMs, PARAMETERS.oppositeSoundMaxGapMs)
      : uniform(PARAMETERS.sameSoundMinGapMs, PARAMETERS.sameSoundMaxGapMs));
    return {
      trialNumber: index + 1,
      type,
      previousType,
      preItiMs: Math.max(250, plannedOnsetGapMs - previousTrialDuration()),
      plannedOnsetGapMs,
    };
  });
}

const counterconditioningSchedule = buildCounterconditioningSchedule();

function listeningTrial(item) {
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `
      <main class="passive-shell">
        <section class="passive-card">
          <div class="listening-pulse" aria-hidden="true"></div>
          <p>Escucha con atención</p>
        </section>
      </main>`,
    choices: 'NO_KEYS',
    trial_duration: item.preItiMs,
    record_data: false,
  };
}

function counterconditioningSoundTrial(item) {
  const pairedReward = item.type === REWARDED_CS;
  let counterconditioningOnsetS = null;
  let actualPreviousOnsetGapS = null;
  let oppositeToPrevious = 0;
  let oppositeGapRequirementMet = 1;
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: `
      <main class="passive-shell">
        <section class="passive-card is-listening">
          <div class="listening-pulse" aria-hidden="true"></div>
          <p>Escucha con atención</p>
        </section>
      </main>`,
    choices: 'NO_KEYS',
    trial_duration: PARAMETERS.csUsIsiMs,
    response_ends_trial: false,
    data: {
      phase: 'counterconditioning',
      session: item.trialNumber,
      block: 0,
      event: 'counterconditioning_sound',
      sound_sequence_position: item.trialNumber,
      previous_sound_type: item.previousType,
      planned_previous_onset_gap_s: item.plannedOnsetGapMs === null
        ? null
        : item.plannedOnsetGapMs / 1000,
      key: item.type,
      token_color: pairedReward ? punishedColor : '',
      token_earned: 0,
      coins_earned: 0,
      reward_clp: 0,
      sound_played: 1,
      sound_type: item.type,
      pairing: pairedReward ? PAIRING_LABEL : UNPAIRED_LABEL,
    },
    on_start: () => {
      const onsetMs = performance.now();
      const actualGapMs = state.lastSoundOnsetMs === null
        ? null
        : onsetMs - state.lastSoundOnsetMs;
      const isOpposite = state.lastSoundType !== '' && state.lastSoundType !== item.type;
      state.currentPhase = 'counterconditioning';
      counterconditioningOnsetS = state.counterconditioningStartMs === null
        ? null
        : (onsetMs - state.counterconditioningStartMs) / 1000;
      actualPreviousOnsetGapS = actualGapMs === null ? null : actualGapMs / 1000;
      oppositeToPrevious = isOpposite ? 1 : 0;
      oppositeGapRequirementMet = !isOpposite || actualGapMs >= (
        PARAMETERS.oppositeSoundMinGapMs - 30
      ) ? 1 : 0;
      state.lastSoundOnsetMs = onsetMs;
      state.lastSoundType = item.type;
      playSound(item.type);
    },
    on_finish: (data) => {
      data.counterconditioning_onset_s = counterconditioningOnsetS;
      data.actual_previous_onset_gap_s = actualPreviousOnsetGapS;
      data.opposite_to_previous = oppositeToPrevious;
      data.opposite_gap_requirement_met = oppositeGapRequirementMet;
      data.earnings_clp = state.earningsClp;
      data.points = state.earningsClp;
      data.fr = state.fr;
    },
  };
}

// The outcome of a counterconditioning trial: the full bag after a gunshot,
// the empty bag after white noise. Both appear after the same interval and
// stay for the same duration.
function counterconditioningOutcomeTrial(item) {
  const rewarded = item.type === REWARDED_CS;
  const rewardClp = rewarded
    ? PARAMETERS.largeRewardCoins * PARAMETERS.rewardValueClp
    : 0;
  const coins = rewarded ? PARAMETERS.largeRewardCoins : 0;
  let actualCsUsIsiS = null;
  return {
    type: jsPsychHtmlKeyboardResponse,
    stimulus: rewarded
      ? `
      <main class="passive-shell">
        <section class="passive-card reward-card big-win-card">
          <p class="reward-label">¡Gran premio!</p>
          ${largeRewardHtml(punishedColor)}
        </section>
      </main>`
      : `
      <main class="passive-shell">
        <section class="passive-card reward-card empty-outcome-card">
          <p class="reward-label">Sin monedas</p>
          ${emptyRewardHtml()}
        </section>
      </main>`,
    choices: 'NO_KEYS',
    trial_duration: PARAMETERS.largeRewardShowMs,
    response_ends_trial: false,
    data: {
      phase: 'counterconditioning',
      session: item.trialNumber,
      block: 0,
      event: rewarded ? 'counterconditioning_reward' : 'counterconditioning_empty',
      key: item.type,
      token_color: rewarded ? punishedColor : '',
      token_earned: coins,
      coins_earned: coins,
      reward_clp: rewardClp,
      sound_played: 0,
      sound_type: '',
      outcome_type: rewarded ? 'full_bag' : 'empty_bag',
      pairing: rewarded ? PAIRING_LABEL : UNPAIRED_LABEL,
      cs_us_isi_s: PARAMETERS.csUsIsiMs / 1000,
    },
    on_start: () => {
      state.earningsClp += rewardClp;
      actualCsUsIsiS = state.lastSoundOnsetMs === null
        ? null
        : (performance.now() - state.lastSoundOnsetMs) / 1000;
      if (window.TaskAudio) {
        if (rewarded) {
          window.TaskAudio.coinCascade(
            PARAMETERS.largeRewardCoins,
            Math.min(38, (PARAMETERS.largeRewardShowMs * 0.4) / PARAMETERS.largeRewardCoins) / 1000,
          );
        } else {
          window.TaskAudio.emptyOutcome();
        }
      }
    },
    on_finish: (data) => {
      data.actual_cs_us_isi_s = actualCsUsIsiS;
      data.earnings_clp = state.earningsClp;
      data.points = state.earningsClp;
      data.fr = state.fr;
    },
  };
}

function buildCounterconditioningTimeline() {
  const trials = [];
  // En modo clase cada sub-ensayo se envuelve en un nodo con conditional_function:
  // al activar la bandera de salto, los sub-ensayos restantes se omiten al instante
  // (sin reproducir más sonidos). En un run real no se envuelve nada.
  const add = (t) => trials.push(
    CLASS_MODE ? { timeline: [t], conditional_function: () => !window.__ccSkipFlag } : t,
  );
  counterconditioningSchedule.forEach((item) => {
    add(listeningTrial(item));
    add(counterconditioningSoundTrial(item));
    add(counterconditioningOutcomeTrial(item));
  });
  return trials;
}

const timeline = [];

timeline.push({
  type: jsPsychPreload,
  audio: [FILES.gunshot, FILES.whiteNoise],
  message: '<main class="loading-shell"><div class="loading-spinner"></div><p>Preparando la tarea…</p></main>',
  error_message: '<main class="message-shell"><section class="task-message"><h1>Problema de carga</h1><p>No se pudieron cargar los archivos del experimento. Por favor, contacta al investigador.</p></section></main>',
  data: { event: 'preload' },
});

// Smoke mode replaces the fullscreen prompt, welcome card and controls card
// with a single consolidated screen. Every other mode keeps them unchanged.
if (SMOKE_MODE) {
  timeline.push(smokeStartTrial());
} else {
  timeline.push({
    type: jsPsychFullscreen,
    fullscreen_mode: true,
    message: `
      <section class="task-message compact-card">
        <div class="message-icon">↗</div>
        <p class="eyebrow">Antes de comenzar</p>
        <h1>Pantalla completa</h1>
        <p>Esto mantiene la tarea clara y sin distracciones.</p>
      </section>`,
    button_label: 'Entrar en pantalla completa',
    data: { event: 'fullscreen_enter' },
  });

  timeline.push(messageTrial('NeuroPolicy Lab', 'Junta monedas y aumenta tu bono', [
    `Usa dos teclas para juntar monedas de colores. Cada moneda vale <strong>$${PARAMETERS.rewardValueClp}</strong>.`,
    'Usa un computador o laptop con teclado físico. Ajusta el volumen a un nivel cómodo y mantenlo sin cambios.',
  ]));

  timeline.push(messageTrial('Controles', 'Dos teclas, dos colores de moneda', [
    `<span class="inline-key"><kbd>Q</kbd>${tokenHtml('blue', 'instruction-token')}</span><span class="inline-key"><kbd>P</kbd>${tokenHtml('red', 'instruction-token')}</span>`,
    'Presiona cualquiera de las dos teclas cuando quieras y en el orden que quieras. No siempre hay una moneda disponible al presionar, así que sigue intentando y elige libremente.',
  ]));
}

timeline.push(messageTrial(
  phaseHeading(1, 'training'),
  'Aprende cómo funcionan las teclas',
  ['Junta todas las monedas que puedas. La tarea avanzará automáticamente.'],
  'training_instruction',
));

const training = operantTrial('training', 1, PARAMETERS.trainingMs, false, 'training');
training.on_finish = (data) => {
  state.earningsClp = data.earnings_clp_end;
  if (data.aborted) {
    state.aborted = true;
    return;
  }
  // Punishment is a flat FR 5. The tailored ratio is still computed and
  // recorded so the two can be compared, and so the departure from Varas et
  // al. is visible in the data rather than only in the code.
  const punishedResponses = punishedKey === 'q' ? data.resp_q : data.resp_p;
  const responseRate = punishedResponses / Math.max(0.000001, data.elapsed_s);
  const tailoredFr = Math.max(1, Math.round(
    (responseRate * (PARAMETERS.punishmentMs / 1000))
    / PARAMETERS.targetPunishersReference,
  ));
  data.punished_key_response_rate = responseRate;
  data.tailored_fr_reference = tailoredFr;
  state.tailoredFr = tailoredFr;
  state.punishedKeyResponseRate = responseRate;
  state.fr = PARAMETERS.punishmentFr;
  data.fr_rule = 'fixed';
  data.fr = state.fr;
  // Projected gunshots if training-rate responding continues.
  data.projected_punishers = Math.round(
    (responseRate * (PARAMETERS.punishmentMs / 1000)) / PARAMETERS.punishmentFr,
  );
};
timeline.push(training);

timeline.push(markerTrial('fr_calculation', 'fr_set', null, () => ({
  key: punishedKey,
  punishment_duration_s: PARAMETERS.punishmentMs / 1000,
  punished_key_response_rate: state.punishedKeyResponseRate,
  fr_rule: 'fixed',
  tailored_fr_reference: state.tailoredFr,
  target_punishers_reference: PARAMETERS.targetPunishersReference,
})));

timeline.push(messageTrial(
  phaseHeading(2, 'punishment'),
  'Sigue juntando monedas',
  [
    'Las dos teclas siguen entregando monedas igual que antes.',
    'Ahora puede ocurrir un sonido desagradable mientras respondes. Puedes seguir eligiendo cualquiera de las dos teclas.',
  ],
  'punishment_instruction',
));
timeline.push(operantTrial('punishment', 2, PARAMETERS.punishmentMs, true, 'punishment'));

timeline.push(messageTrial(
  phaseHeading(3, 'counterconditioning'),
  'Observa y escucha',
  [
    'En esta parte no usarás las teclas.',
    'Mantén tu atención en el centro de la pantalla. Algunos sonidos irán seguidos de una recompensa mayor de monedas.',
  ],
  'counterconditioning_instruction',
));
timeline.push(markerTrial('counterconditioning', 'phase_start', () => {
  state.counterconditioningStartMs = performance.now();
  state.lastSoundOnsetMs = null;
  state.lastSoundType = '';
  enableCcSkip();
}));
timeline.push(...buildCounterconditioningTimeline());
timeline.push(markerTrial('counterconditioning', 'phase_end', () => {
  disableCcSkip();
}));

timeline.push(messageTrial(
  phaseHeading(4, 'extinction test'),
  'Vuelven las teclas',
  ['Junta todas las monedas que puedas. Elige entre las teclas como prefieras.'],
  'extinction_test_instruction',
));
timeline.push(operantTrial('extinction_test', 4, PARAMETERS.testMs, false, 'extinction test'));

timeline.push(messageTrial(
  phaseHeading(5, 'reacquisition'),
  'Una última ronda',
  ['Sigue juntando todas las monedas que puedas.'],
  'reacquisition_instruction',
));
timeline.push(operantTrial(
  'reacquisition',
  5,
  PARAMETERS.reacquisitionMs,
  true,
  'reacquisition',
));

const completionTrial = {
  type: jsPsychHtmlKeyboardResponse,
  stimulus: () => messageHtml(
    'Listo',
    '¡Gracias por participar!',
    [`Tu bono en monedas es <strong>${money(Math.min(state.earningsClp, PARAMETERS.bonusCapClp))}</strong>.`],
    'Presiona la barra espaciadora para guardar tus datos.',
  ),
  choices: [' '],
  data: { phase: 'completion', event: 'experiment_complete' },
  on_finish: (data) => {
    data.earnings_clp = state.earningsClp;
    data.points = state.earningsClp;
    data.fr = state.fr;
  },
};
if (SMOKE_MODE) completionTrial.trial_duration = 6000;
timeline.push(completionTrial);

if (MODE_BLOCKED) {
  console.warn(
    `[${EXP_NAME}] test_mode="${REQUESTED_MODE}" was refused because the URL `
    + 'carries live recruitment parameters. The full experiment is running.',
  );
}

window.__punishmentTask = {
  jsPsych,
  state,
  parameters: PARAMETERS,
  metadata,
  counterconditioningSchedule,
  timeline,
  pilotMode: PILOT_MODE,
  modeBlocked: MODE_BLOCKED,
  assetVersion: ASSET_VERSION,
};

if (UNKNOWN_MODE) {
  console.error(
    `[${EXP_NAME}] Unrecognised test_mode="${REQUESTED_MODE}" in build `
    + `v${ASSET_VERSION}. The experiment was not started.`,
  );
  showUnknownModeScreen();
} else {
  // Browsers hold an AudioContext suspended until a user gesture. The first
  // instruction card is dismissed with the space bar, which unlocks it well
  // before any sound is needed.
  ['keydown', 'pointerdown'].forEach((eventName) => {
    document.addEventListener(eventName, () => {
      if (window.TaskAudio) window.TaskAudio.resume();
    }, { once: true });
  });

  showDevBanner();
  showClassHint();
  jsPsych.run(timeline);
}
