#!/usr/bin/env node
/**
 * audit-scene.cjs — Valida una escena/clase contra MASTERCLASS_RULES.md.
 *
 * Uso:
 *   node scripts/audit-scene.cjs scripts/voice-gaia/script-XX.json
 *   node scripts/audit-scene.cjs scripts/voice-gaia/*.json    # batch
 *
 * Verifica las reglas AUTOMATIZABLES de las 12 secciones. Las subjetivas
 * (mood, bloom intentional, "respiración visual") las marca como
 * "review humano" — no las penaliza, solo las recuerda.
 *
 * Exit code: 0 si pasa, 1 si falla cualquier regla obligatoria.
 */

const fs = require('fs');
const path = require('path');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

const BANNED_OPENERS = [
  /^hoy te (voy a |vamos a )?(enseñar|explicar|aprender)/i,
  /^aprenderás /i,
  /^vamos a aprender /i,
  /^es importante (entender|que) /i,
];

const BANNED_VOSEO = [
  /\bvos /, /\btenés\b/i, /\belevás\b/i, /\bdeseás\b/i, /\bsabés\b/i,
  /\bquerés\b/i, /\bpodés\b/i, /\bvení\b/i, /\bandá\b/i, /\bmirá\b/i,
];

const BANNED_CASTIZO = [
  /\bvale\b(?!\s+(\$|\d|doscientos|trescientos|cuatrocientos|quinientos|cien|mil))/i,
  /\btío\b/i, /\bchaval\b/i, /\bgilipollas\b/i,
  /\bvosotros\b/i,
];

const TECH_TERMS_TO_DELAY = [
  'información asimétrica', 'equilibrio de nash', 'utilidad esperada',
  'matriz de pagos', 'estrategia dominante', 'frontera eficiente',
  'sharpe ratio', 'expectativas racionales', 'curva de phillips',
];

const REQUIRED_VOICE_SETTINGS = {
  voice_id: 'XrExE9yKIg1WjnnlVkGX',
  voice_name: 'Matilda',
};

const VALID_MODELS = ['eleven_v3', 'eleven_multilingual_v2', 'eleven_turbo_v2_5'];
const RECOMMENDED_MODEL = 'eleven_v3';

const VALID_TEMPLATES = [
  'two-worlds', 'zoom-out', 'zoom-in', 'reveal',
  'inversion', 'collapse', 'cascade', 'bridge',
];

const VALID_EMOTIONS = ['asombro', 'inquietud', 'calidez', 'adrenalina', 'claridad'];

class Auditor {
  constructor(scriptPath) {
    this.scriptPath = scriptPath;
    this.script = null;
    this.issues = [];
  }

  load() {
    try {
      const raw = fs.readFileSync(this.scriptPath, 'utf8');
      this.script = JSON.parse(raw);
    } catch (e) {
      this.fail('schema', 'No se pudo parsear JSON: ' + e.message);
      return false;
    }
    return true;
  }

  fail(rule, message) { this.issues.push({ severity: 'fail', rule, message }); }
  warn(rule, message) { this.issues.push({ severity: 'warn', rule, message }); }
  info(rule, message) { this.issues.push({ severity: 'info', rule, message }); }

  auditPhilosophy() {
    const allScenes = this.allScenes();
    if (allScenes.length === 0) return;
    const firstScene = allScenes[0];
    const firstText = firstScene.text || '';

    // Cliffhanger scenes (intermediate/closing) can end with a statement, not a question.
    // The hook only applies to scenes marked as story_beat=hook or scene 1 with no beat set.
    const isCliffhanger = firstScene.story_beat === 'cliffhanger';
    const isHook = firstScene.story_beat === 'hook' || !firstScene.story_beat;

    if (isHook && !isCliffhanger && !firstText.includes('?')) {
      this.warn('§0.1 curiosity-gap', 'La primera escena no termina con una pregunta. Curiosity gap probablemente débil.');
    }
    for (const re of BANNED_OPENERS) {
      if (re.test(firstText)) {
        this.fail('§0.2 misconception-first', 'Apertura prohibida detectada: "' + firstText.slice(0, 50) + '..." — empieza con feeling, no con declaración.');
      }
    }
    const firstTextLower = firstText.toLowerCase();
    for (const term of TECH_TERMS_TO_DELAY) {
      if (firstTextLower.includes(term)) {
        this.warn('§0.3 show-dont-define', 'Término técnico "' + term + '" en escena 1. Debe aparecer DESPUÉS del feeling.');
      }
    }
  }

  auditAnatomy() {
    const totalDuration = this.script.total_duration_target_sec;
    if (totalDuration) {
      if (totalDuration < 480 || totalDuration > 1500) {
        this.warn('§1 duración total', 'total_duration_target_sec=' + totalDuration + ' fuera de rango recomendado (480-1500s)');
      }
    }

    const chapters = this.script.chapters;
    if (chapters) {
      if (chapters.length < 4 || chapters.length > 7) {
        this.warn('§1 número de capítulos', chapters.length + ' capítulos — recomendado 4-6');
      }
      for (const ch of chapters) {
        const sd = ch.duration_target_sec;
        if (sd && (sd < 60 || sd > 240)) {
          this.warn('§1 capítulo duración', 'Capítulo "' + ch.id + '" dura ' + sd + 's — recomendado 90-240s');
        }
        if (!ch.central_gap) this.warn('§1 capítulo gap', 'Capítulo "' + ch.id + '" sin central_gap');
      }
    }

    const allScenes = this.allScenes();
    for (const s of allScenes) {
      const sd = s.duration_target_sec;
      if (sd && (sd < 15 || sd > 60)) {
        this.warn('§1 escena duración', 'Escena "' + s.id + '" dura ' + sd + 's — recomendado 15-60s');
      }
    }
  }

  auditCuriosityGap() {
    const allScenes = this.allScenes();
    for (const s of allScenes) {
      const text = s.text || '';
      for (const re of BANNED_OPENERS) {
        if (re.test(text)) {
          this.warn('§2 anti-patrones', 'Escena "' + s.id + '": apertura prohibida detectada');
        }
      }
      if (/^como (vimos|aprendimos|mencionamos)/i.test(text)) {
        this.warn('§2 anti-patrones', 'Escena "' + s.id + '": recap prohibido al inicio');
      }
    }
  }

  auditTemplates() {
    const allScenes = this.allScenes();
    const usedTemplates = new Set();
    for (const s of allScenes) {
      if (s.template) {
        if (!VALID_TEMPLATES.includes(s.template)) {
          this.warn('§5 template inválida', 'Escena "' + s.id + '": template "' + s.template + '" no está en las 8 canónicas');
        }
        usedTemplates.add(s.template);
      }
    }
    if (allScenes.length >= 10 && usedTemplates.size < 3) {
      this.warn('§5 diversidad templates', 'Solo ' + usedTemplates.size + ' templates distintas en ' + allScenes.length + ' escenas');
    }
  }

  auditLanguage() {
    const allScenes = this.allScenes();
    for (const s of allScenes) {
      const text = s.text || '';
      for (const re of BANNED_VOSEO) {
        if (re.test(text)) {
          this.fail('§9 voseo prohibido', 'Escena "' + s.id + '": voseo en "' + text.slice(0, 80) + '..."');
        }
      }
      for (const re of BANNED_CASTIZO) {
        if (re.test(text)) {
          this.warn('§9 castizo', 'Escena "' + s.id + '": modismo castizo detectado');
        }
      }
    }

    if (this.script.voice_name && this.script.voice_name !== REQUIRED_VOICE_SETTINGS.voice_name) {
      this.warn('§9 voz no canónica', 'voice_name="' + this.script.voice_name + '" — esperado Matilda');
    }
    if (this.script.voice_id && this.script.voice_id !== REQUIRED_VOICE_SETTINGS.voice_id) {
      this.warn('§9 voz no canónica', 'voice_id distinto al canónico (Matilda)');
    }
    if (this.script.model_id && !VALID_MODELS.includes(this.script.model_id)) {
      this.warn('§9 modelo no canónico', 'model_id="' + this.script.model_id + '"');
    }
    if (this.script.model_id && this.script.model_id !== RECOMMENDED_MODEL) {
      this.info('§9 modelo upgrade', 'Usando "' + this.script.model_id + '" — flagship actual es "' + RECOMMENDED_MODEL + '"');
    }
  }

  auditCrossReferences() {
    const cr = this.script.cross_references;
    if (!cr || cr.length === 0) {
      this.info('§10 cross-refs', 'Sin cross_references. Mínimo 2 recomendado');
    } else if (cr.length < 2) {
      this.info('§10 cross-refs', 'Solo ' + cr.length + ' cross_reference. Mínimo: 2');
    }
  }

  auditSchema() {
    if (!this.script.central_emotion) {
      this.info('§11 schema', 'Falta `central_emotion`');
    } else if (!VALID_EMOTIONS.some(e => this.script.central_emotion.toLowerCase().includes(e))) {
      this.warn('§11 emoción inválida', 'central_emotion="' + this.script.central_emotion + '" — usa: asombro | inquietud | calidez | adrenalina | claridad');
    }
    if (!this.script.aspect_ratio_primary) {
      this.info('§11 schema', 'Falta `aspect_ratio_primary` — recomendado "9:16"');
    }
  }

  auditChecklist() {
    const allScenes = this.allScenes();
    const firstScene = allScenes[0];

    if (firstScene) {
      // Skip hook check for cliffhanger scenes
      const isCliffhanger = firstScene.story_beat === 'cliffhanger';
      const isHook = firstScene.story_beat === 'hook' || !firstScene.story_beat;
      if (isHook && !isCliffhanger) {
        const charsToQuestion = (firstScene.text || '').indexOf('?');
        if (charsToQuestion === -1) {
          this.warn('§12 hook', 'No hay "?" en la primera escena — hook débil');
        } else if (charsToQuestion > 250) {
          this.warn('§12 hook lento', 'Pregunta gatillo aparece tarde (char ' + charsToQuestion + ')');
        }
      }
    }

    const usesAudioTags = allScenes.some(s => /\[[a-z][a-z0-9 ]*\]/i.test(s.text || ''));
    if (this.script.model_id === 'eleven_v3' && !usesAudioTags) {
      this.info('§12 audio tags', 'Usando eleven_v3 pero sin audio tags inline. Subutiliza el modelo.');
    }
  }

  allScenes() {
    if (this.script.scenes) return this.script.scenes;
    if (this.script.chapters) {
      return this.script.chapters.flatMap(ch => ch.scenes || []);
    }
    return [];
  }

  run() {
    if (!this.load()) return false;
    this.auditPhilosophy();
    this.auditAnatomy();
    this.auditCuriosityGap();
    this.auditTemplates();
    this.auditLanguage();
    this.auditCrossReferences();
    this.auditSchema();
    this.auditChecklist();
    return true;
  }

  report() {
    const fails = this.issues.filter(i => i.severity === 'fail');
    const warns = this.issues.filter(i => i.severity === 'warn');
    const infos = this.issues.filter(i => i.severity === 'info');

    console.log('\n' + BOLD + CYAN + 'Audit:' + RESET + ' ' + this.scriptPath);
    console.log(BOLD + (this.script.title || '(sin título)') + RESET);
    const allScenes = this.allScenes();
    console.log(GRAY + '  ' + allScenes.length + ' escenas · modelo: ' + (this.script.model_id || 'n/d') + RESET + '\n');

    for (const i of fails) {
      console.log('  ' + RED + '✗ FAIL' + RESET + ' ' + BOLD + i.rule + RESET + ' — ' + i.message);
    }
    for (const i of warns) {
      console.log('  ' + YELLOW + '⚠ WARN' + RESET + ' ' + BOLD + i.rule + RESET + ' — ' + i.message);
    }
    for (const i of infos) {
      console.log('  ' + GRAY + 'ℹ INFO' + RESET + ' ' + i.rule + ' — ' + i.message);
    }

    const verdict =
      fails.length > 0 ? RED + BOLD + '✗ ' + fails.length + ' fails · ' + warns.length + ' warns · ' + infos.length + ' info' + RESET :
      warns.length > 0 ? YELLOW + BOLD + '⚠ ' + warns.length + ' warns · ' + infos.length + ' info' + RESET :
                         GREEN + BOLD + '✓ clean · ' + infos.length + ' info' + RESET;
    console.log('\n  ' + verdict);
    return fails.length === 0;
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Uso: node ' + path.basename(__filename) + ' <script.json> [<script2.json> ...]');
  process.exit(2);
}

let anyFail = false;
for (const arg of args) {
  if (!fs.existsSync(arg)) {
    console.error(RED + 'No existe: ' + arg + RESET);
    anyFail = true;
    continue;
  }
  const auditor = new Auditor(arg);
  if (auditor.run()) {
    const passed = auditor.report();
    if (!passed) anyFail = true;
  }
}

process.exit(anyFail ? 1 : 0);
