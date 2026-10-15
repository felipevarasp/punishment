// Synthesised task sounds: key-press clicks, coin collection, the
// counterconditioning coin cascade, and the neutral empty-bag outcome.
//
// These are generated with the Web Audio API rather than shipped as files so
// that there are no extra binaries in the Pavlovia repository, no preload race
// against the experiment start, and no cache-versioning problem. The gunshot
// and white noise remain real recordings (resources/*.wav) and are unaffected.
//
// Levels are deliberately staged: the key click is quiet enough that several
// hundred presses do not become fatiguing and cannot mask the gunshot, and the
// empty-bag sound is dull and low so it can never be mistaken for a reward.
var TaskAudio = (function () {
  'use strict';

  var ctx = null;
  var master = null;
  var unavailable = false;

  function context() {
    if (unavailable) return null;
    if (ctx === null) {
      var Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) {
        unavailable = true;
        return null;
      }
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 1;
      master.connect(ctx.destination);
    }
    return ctx;
  }

  // Browsers start the context suspended until a user gesture. Every entry
  // point calls this, and the task gates its first screen on a key press.
  function resume() {
    var c = context();
    if (c && c.state === 'suspended') {
      var promise = c.resume();
      if (promise && typeof promise.catch === 'function') promise.catch(function () {});
    }
    return c;
  }

  function tone(options) {
    var c = resume();
    if (!c) return;
    var startAt = c.currentTime + (options.start || 0);
    var duration = options.duration;
    var peak = options.peak;
    var attack = options.attack === undefined ? 0.004 : options.attack;
    var release = options.release === undefined ? 0.06 : options.release;
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = options.type || 'square';
    osc.frequency.setValueAtTime(options.freq, startAt);
    // Exponential ramps cannot touch zero, hence the 0.0001 floor.
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(peak, startAt + attack);
    gain.gain.setValueAtTime(peak, startAt + Math.max(attack, duration - release));
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.02);
  }

  // The familiar two-note arcade coin: a short B5 slurring up to a held E6.
  function coin(startOffset, level) {
    var start = startOffset || 0;
    var scale = level === undefined ? 1 : level;
    tone({
      freq: 987.77, start: start, duration: 0.075, peak: 0.17 * scale, release: 0.02,
    });
    tone({
      freq: 1318.51, start: start + 0.075, duration: 0.40, peak: 0.15 * scale, release: 0.33,
    });
  }

  // Ten coins landing in the bag. Short ascending blips tracking the visual
  // cascade, closed by one full coin so the outcome resolves rather than
  // simply stopping.
  function coinCascade(count, staggerSeconds) {
    var step = staggerSeconds || 0.038;
    for (var index = 0; index < count; index += 1) {
      tone({
        freq: 880 * Math.pow(2, (index % 8) / 12),
        start: index * step,
        duration: 0.11,
        peak: 0.085,
        release: 0.09,
      });
    }
    coin(count * step, 1);
  }

  // Response feedback. Quiet and very short by design.
  function click() {
    tone({
      freq: 320,
      start: 0,
      duration: 0.042,
      type: 'triangle',
      peak: 0.05,
      attack: 0.002,
      release: 0.034,
    });
  }

  // The empty bag. Low, dull and clearly not a reward.
  function emptyOutcome() {
    tone({
      freq: 155,
      start: 0,
      duration: 0.26,
      type: 'sine',
      peak: 0.07,
      attack: 0.006,
      release: 0.22,
    });
  }

  return {
    resume: resume,
    coin: coin,
    coinCascade: coinCascade,
    click: click,
    emptyOutcome: emptyOutcome,
  };
}());
