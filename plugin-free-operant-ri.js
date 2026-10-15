var jsPsychFreeOperantRi = (function (jspsych) {
  'use strict';

  const info = {
    name: 'free-operant-ri',
    version: '3.0.0',
    parameters: {
      phase: { type: jspsych.ParameterType.STRING, default: '' },
      phase_number: { type: jspsych.ParameterType.INT, default: 1 },
      phase_count: { type: jspsych.ParameterType.INT, default: 5 },
      phase_label: { type: jspsych.ParameterType.STRING, default: '' },
      duration_ms: { type: jspsych.ParameterType.INT, default: 300000 },
      stop_at_coins: { type: jspsych.ParameterType.INT, default: null },
      ri_t_seconds: { type: jspsych.ParameterType.FLOAT, default: 15 },
      // Interval ceiling as a multiple of ri_t_seconds. Varas et al. truncate
      // at 3x the mean; set to 0 to disable.
      max_interval_multiplier: { type: jspsych.ParameterType.FLOAT, default: 3 },
      // Per-draw logging is off by default: it accounted for 43% of the rows
      // in a pilot file and is only needed to verify the Bernoulli process
      // itself. Setup moments are still recorded via block_end counts and
      // ri_forced_setup events.
      log_ri_draws: { type: jspsych.ParameterType.BOOL, default: false },
      reward_value_clp: { type: jspsych.ParameterType.INT, default: 8 },
      starting_earnings_clp: { type: jspsych.ParameterType.INT, default: 0 },
      fr: { type: jspsych.ParameterType.INT, default: 0 },
      punish_mode: { type: jspsych.ParameterType.BOOL, default: false },
      punished_key: { type: jspsych.ParameterType.STRING, default: 'q' },
      key_token: { type: jspsych.ParameterType.OBJECT, default: { q: 'blue', p: 'red' } },
      aversive_audio: { type: jspsych.ParameterType.AUDIO, default: null },
      coin_flash_ms: { type: jspsych.ParameterType.INT, default: 650 },
      bonus_cap: { type: jspsych.ParameterType.INT, default: 0 },
      allow_skip: { type: jspsych.ParameterType.BOOL, default: false },
      event_metadata: { type: jspsych.ParameterType.OBJECT, default: {} },
    },
    data: {
      phase: { type: jspsych.ParameterType.STRING },
      event: { type: jspsych.ParameterType.STRING },
      resp_q: { type: jspsych.ParameterType.INT },
      resp_p: { type: jspsych.ParameterType.INT },
      tokens_q: { type: jspsych.ParameterType.INT },
      tokens_p: { type: jspsych.ParameterType.INT },
      tokens_block: { type: jspsych.ParameterType.INT },
      punishers_block: { type: jspsych.ParameterType.INT },
      elapsed_s: { type: jspsych.ParameterType.FLOAT },
      earnings_clp_end: { type: jspsych.ParameterType.INT },
      aborted: { type: jspsych.ParameterType.BOOL },
    },
  };

  function money(clp) {
    return '$' + Math.round(clp).toLocaleString('es-CL');
  }

  // Trims float noise so 2 renders as "2" and 2.5 as "2.5". The coin value is
  // always taken from trial.reward_value_clp, never hardcoded.
  function clpNumber(clp) {
    return Number(Number(clp).toFixed(2));
  }

  function tokenHtml(color, clp, extraClass = '') {
    const value = clpNumber(clp);
    return `<span class="game-token token-${color} ${extraClass}" aria-label="${color} ${value} pesos"><span class="coin-value"><span>$${value}</span></span></span>`;
  }

  class FreeOperantRiPlugin {
    constructor(jsPsych) {
      this.jsPsych = jsPsych;
    }

    static info = info;

    trial(displayElement, trial) {
      const keys = ['q', 'p'];
      const riProbability = 1 / trial.ri_t_seconds;
      const outcomeCap = 1;
      const changeoverCap = 2;
      const blockStart = performance.now();

      let pausedTotal = 0;
      let pauseStarted = null;
      let ended = false;
      let rafId = null;
      let earningsClp = trial.starting_earnings_clp;
      let lastKey = null;
      let changeoverCount = changeoverCap;
      let totalTokens = 0;
      let punishers = 0;
      let punishedResponseCounter = 0;
      let flashUntil = 0;
      let flashColor = '';

      // Varas et al. (2026) sample VI intervals from an exponential truncated
      // at three times the mean (60 s mean, 180 s maximum). The Bernoulli
      // clock here has the same unbounded geometric tail, so it is capped the
      // same way: if a clock runs this long without setting up an outcome, one
      // is set up regardless and the clock restarts.
      const maxIntervalMs = trial.ri_t_seconds * trial.max_interval_multiplier * 1000;

      const available = { q: false, p: false };
      const nextRiCheck = { q: 1000, p: 1000 };
      // When each key's clock last (re)started, in active elapsed ms.
      const clockStart = { q: 0, p: 0 };
      const responses = { q: 0, p: 0 };
      const tokens = { q: 0, p: 0 };
      const riDraws = { q: 0, p: 0 };
      const riSetups = { q: 0, p: 0 };
      const forcedSetups = { q: 0, p: 0 };
      const aversive = trial.aversive_audio ? new Audio(trial.aversive_audio) : null;
      if (aversive) aversive.preload = 'auto';

      const coinClp = clpNumber(trial.reward_value_clp);
      const progress = Math.max(0, Math.min(100, (trial.phase_number / trial.phase_count) * 100));
      displayElement.innerHTML = `
        <main class="operant-shell">
          <header class="task-topbar">
            <div class="task-brand">
              <span class="brand-dot" aria-hidden="true"></span>
              <span>NeuroPolicy Lab</span>
            </div>
            <div class="phase-chip" id="operant-phase"></div>
            <div class="points-chip">
              <span>Bonus</span>
              <strong id="operant-points">$0</strong>
            </div>
          </header>

          <section class="operant-panel arcade-panel">
            <div class="panel-heading">
              <div>
                <p class="eyebrow">Elige libremente</p>
                <h1>Presiona Q o P para juntar monedas de $${coinClp}</h1>
              </div>
            </div>

            <div class="phase-progress" aria-hidden="true">
              <span style="width: ${progress}%"></span>
            </div>

            <div class="choice-grid">
              <div class="choice-card choice-q" id="operant-key-q">
                <span class="choice-caption">Izquierda</span>
                <div class="arcade-button arcade-button-blue"><kbd>Q</kbd></div>
                ${tokenHtml('blue', coinClp, 'choice-token')}
                <span class="choice-help">Presiona Q</span>
              </div>

              <div class="reward-space" aria-live="polite">
                <div id="operant-coin" hidden></div>
                <div class="reward-feedback" id="reward-feedback" hidden>+$${coinClp}</div>
                <p>Aquí aparecen las monedas</p>
              </div>

              <div class="choice-card choice-p" id="operant-key-p">
                <span class="choice-caption">Derecha</span>
                <div class="arcade-button arcade-button-red"><kbd>P</kbd></div>
                ${tokenHtml('red', coinClp, 'choice-token')}
                <span class="choice-help">Presiona P</span>
              </div>
            </div>
          </section>

          <p class="task-footer">No siempre hay una moneda disponible al presionar. Puedes cambiar de tecla cuando quieras.</p>
          ${trial.allow_skip ? '<p class="task-footer" style="opacity:.7">Demo — barra espaciadora: saltar a la siguiente fase</p>' : ''}
          <div class="pause-overlay" id="pause-overlay" hidden>
            <div><strong>Tarea en pausa</strong><span>Vuelve a esta pestaña para continuar.</span></div>
          </div>
        </main>`;

      const phaseElement = displayElement.querySelector('#operant-phase');
      const pointsElement = displayElement.querySelector('#operant-points');
      const coinElement = displayElement.querySelector('#operant-coin');
      const rewardFeedback = displayElement.querySelector('#reward-feedback');
      const pauseOverlay = displayElement.querySelector('#pause-overlay');
      const keyElements = {
        q: displayElement.querySelector('#operant-key-q'),
        p: displayElement.querySelector('#operant-key-p'),
      };
      phaseElement.textContent = trial.phase_label;

      const activeElapsed = (timestamp = performance.now()) => {
        const currentPause = pauseStarted === null ? 0 : timestamp - pauseStarted;
        return Math.max(0, timestamp - blockStart - pausedTotal - currentPause);
      };

      const pushEvent = (values) => {
        this.jsPsych.data.get().push(Object.assign({
          trial_type: 'free-operant-ri-event',
          phase: trial.phase,
          session: 1,
          block: 1,
          t_block: Number((activeElapsed() / 1000).toFixed(4)),
          time_elapsed: this.jsPsych.getTotalTime(),
          earnings_clp: earningsClp,
          points: earningsClp,
          fr: trial.fr,
          reward_schedule: 'independent_bernoulli_ri_per_key',
          ri_parameter_s: trial.ri_t_seconds,
          ri_probability_per_second: riProbability,
          pending_outcome_cap: outcomeCap,
          changeover_count_cap: changeoverCap,
        }, trial.event_metadata, values));
      };

      pushEvent({ event: 'phase_start', t_block: 0 });

      const playPunisher = () => {
        if (!aversive) return;
        aversive.pause();
        aversive.currentTime = 0;
        const playPromise = aversive.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {});
        }
      };

      const updateRiClocks = (elapsed) => {
        // Perez et al. (2026): each action has its own independent RI clock.
        // A clock pauses only while its own one-outcome availability is full.
        keys.forEach((key) => {
          while (!available[key] && elapsed >= nextRiCheck[key]) {
            const draw = Math.random();
            const success = draw < riProbability;
            riDraws[key] += 1;
            if (success) {
              available[key] = true;
              riSetups[key] += 1;
            }
            if (trial.log_ri_draws) {
              pushEvent({
                event: 'ri_draw',
                key,
                ri_draw_number_key: riDraws[key],
                ri_draw_value: draw,
                ri_draw_success: success ? 1 : 0,
                outcome_available_after_draw: available[key] ? 1 : 0,
              });
            }
            nextRiCheck[key] += 1000;
          }

          // Interval ceiling. Truncates the geometric tail at three times the
          // scheduled interval, as in Varas et al.
          if (!available[key] && elapsed - clockStart[key] >= maxIntervalMs) {
            available[key] = true;
            riSetups[key] += 1;
            forcedSetups[key] += 1;
            pushEvent({
              event: 'ri_forced_setup',
              key,
              interval_s: (elapsed - clockStart[key]) / 1000,
              max_interval_s: maxIntervalMs / 1000,
              forced_setup_number_key: forcedSetups[key],
            });
          }
        });
      };

      const finish = (aborted = false) => {
        if (ended) return;
        ended = true;
        if (rafId !== null) cancelAnimationFrame(rafId);
        document.removeEventListener('keydown', onKeyDown);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        if (aversive) aversive.pause();

        const elapsed = activeElapsed();
        this.jsPsych.finishTrial({
          phase: trial.phase,
          event: 'block_end',
          fr: trial.fr,
          punish_mode: trial.punish_mode ? 1 : 0,
          punished_key: trial.punished_key,
          resp_q: responses.q,
          resp_p: responses.p,
          tokens_q: tokens.q,
          tokens_p: tokens.p,
          tokens_block: tokens.q + tokens.p,
          sounds_block: punishers,
          punishers_block: punishers,
          punished_response_counter_end: punishedResponseCounter,
          ri_draws_q: riDraws.q,
          ri_draws_p: riDraws.p,
          ri_setups_q: riSetups.q,
          ri_setups_p: riSetups.p,
          forced_setups_q: forcedSetups.q,
          forced_setups_p: forcedSetups.p,
          max_interval_s: maxIntervalMs / 1000,
          pending_reward_q_end: available.q ? 1 : 0,
          pending_reward_p_end: available.p ? 1 : 0,
          elapsed_s: elapsed / 1000,
          points_end: earningsClp,
          earnings_clp_end: earningsClp,
          aborted,
          reward_schedule: 'independent_bernoulli_ri_per_key',
          ri_parameter_s: trial.ri_t_seconds,
          ri_probability_per_second: riProbability,
          pending_outcome_cap: outcomeCap,
          changeover_count_cap: changeoverCap,
        });
      };

      const onKeyDown = (event) => {
        if (ended || document.hidden || event.repeat) return;
        const key = event.key.toLowerCase();
        if (key === 'escape') {
          event.preventDefault();
          finish(true);
          this.jsPsych.abortExperiment(
            '<p>The experiment was closed before completion.</p>',
            { phase: trial.phase, event: 'experiment_aborted' },
          );
          return;
        }
        // Modo demo/clase: la barra espaciadora salta a la siguiente fase.
        // Se exige un pequeño margen (>400 ms) para que el MISMO espacio que
        // inició la fase (al avanzar la instrucción previa) no la salte al instante.
        if (trial.allow_skip && key === ' ' && (performance.now() - blockStart) > 400) {
          event.preventDefault();
          finish(false);
          return;
        }
        if (!keys.includes(key)) return;
        event.preventDefault();

        // Identical for Q and P on purpose: a pitch difference between the
        // keys would be an extra discriminative cue alongside the punishment.
        if (window.TaskAudio) window.TaskAudio.click();

        const elapsed = activeElapsed();
        updateRiClocks(elapsed);
        responses[key] += 1;

        // Captured before lastKey is reassigned, so the recorded value is the
        // key of the PREVIOUS response. Recording it after the assignment made
        // the field always equal `key`, which was useless.
        const previousKey = lastKey;

        let changeoverEligible;
        if (lastKey === null) {
          changeoverCount = changeoverCap;
          changeoverEligible = true;
        } else if (key === lastKey) {
          changeoverCount = Math.min(changeoverCap, changeoverCount + 1);
          changeoverEligible = true;
        } else {
          changeoverCount = 1;
          changeoverEligible = false;
        }
        lastKey = key;

        let tokenEarned = false;
        let tokenColor = '';
        if (changeoverEligible && available[key]) {
          tokenEarned = true;
          tokenColor = trial.key_token[key];
          available[key] = false;
          // Collecting restarts that key's clock, so the interval ceiling is
          // measured from the last reinforcer on that key.
          nextRiCheck[key] = elapsed + 1000;
          clockStart[key] = elapsed;
          tokens[key] += 1;
          totalTokens += 1;
          earningsClp += trial.reward_value_clp;
          flashColor = tokenColor;
          flashUntil = elapsed + trial.coin_flash_ms;
          if (window.TaskAudio) window.TaskAudio.coin();
        }

        let soundPlayed = false;
        if (trial.punish_mode && trial.fr > 0 && key === trial.punished_key) {
          punishedResponseCounter += 1;
          if (punishedResponseCounter >= trial.fr) {
            punishedResponseCounter = 0;
            playPunisher();
            soundPlayed = true;
            punishers += 1;
          }
        }

        keyElements[key].classList.add('is-pressed');
        window.setTimeout(() => keyElements[key]?.classList.remove('is-pressed'), 90);

        pushEvent({
          event: 'response',
          // These are the fields most analyses start from, alongside key and
          // t_block. reinforced and punished duplicate coins_earned and
          // sound_played under names that say what they mean, so the file is
          // readable without the codebook.
          response_number: responses.q + responses.p,
          response_number_key: responses[key],
          key,
          reinforced: tokenEarned ? 1 : 0,
          punished: soundPlayed ? 1 : 0,
          is_punished_key: key === trial.punished_key ? 1 : 0,
          key_role: key === trial.punished_key ? 'punished' : 'control',
          token_color: tokenColor,
          token_earned: tokenEarned ? 1 : 0,
          coins_earned: tokenEarned ? 1 : 0,
          reward_clp: tokenEarned ? trial.reward_value_clp : 0,
          sound_played: soundPlayed ? 1 : 0,
          sound_type: soundPlayed ? 'bang' : '',
          earnings_clp: earningsClp,
          points: earningsClp,
          punished_response_counter: punishedResponseCounter,
          rss: changeoverCount,
          changeover_count: changeoverCount,
          changeover_eligible: changeoverEligible ? 1 : 0,
          previous_key: previousKey === null ? '' : previousKey,
          is_changeover: previousKey !== null && previousKey !== key ? 1 : 0,
          first_response_of_block: previousKey === null ? 1 : 0,
          available_q: available.q ? 1 : 0,
          available_p: available.p ? 1 : 0,
        });

        if (trial.stop_at_coins !== null && totalTokens >= trial.stop_at_coins) {
          finish(false);
        }
      };

      const onVisibilityChange = () => {
        if (ended) return;
        if (document.hidden && pauseStarted === null) {
          pauseStarted = performance.now();
          pauseOverlay.hidden = false;
          pushEvent({ event: 'visibility_hidden' });
        } else if (!document.hidden && pauseStarted !== null) {
          const pauseDuration = performance.now() - pauseStarted;
          pausedTotal += pauseDuration;
          pauseStarted = null;
          pauseOverlay.hidden = true;
          pushEvent({
            event: 'visibility_visible',
            pause_duration_s: Number((pauseDuration / 1000).toFixed(4)),
          });
        }
      };

      const render = (timestamp) => {
        if (ended) return;
        const elapsed = activeElapsed(timestamp);
        if (pauseStarted === null) updateRiClocks(elapsed);

        pointsElement.textContent = money(trial.bonus_cap > 0 ? Math.min(earningsClp, trial.bonus_cap) : earningsClp);

        if (flashUntil > elapsed && flashColor) {
          coinElement.innerHTML = tokenHtml(flashColor, coinClp, 'earned-token');
          coinElement.hidden = false;
          rewardFeedback.hidden = false;
        } else {
          coinElement.hidden = true;
          rewardFeedback.hidden = true;
        }

        if (elapsed >= trial.duration_ms) {
          finish(false);
          return;
        }
        rafId = requestAnimationFrame(render);
      };

      document.addEventListener('keydown', onKeyDown, { passive: false });
      document.addEventListener('visibilitychange', onVisibilityChange);
      window.__freeOperantDebug = {
        snapshot: () => ({
          phase: trial.phase,
          available: Object.assign({}, available),
          nextRiCheck: Object.assign({}, nextRiCheck),
          lastKey,
          changeoverCount,
          responses: Object.assign({}, responses),
          tokens: Object.assign({}, tokens),
          earningsClp,
          punishedKey: trial.punished_key,
          punishedResponseCounter,
          punishers,
          riDraws: Object.assign({}, riDraws),
          riSetups: Object.assign({}, riSetups),
        }),
      };
      rafId = requestAnimationFrame(render);
    }
  }

  return FreeOperantRiPlugin;
})(jsPsychModule);
