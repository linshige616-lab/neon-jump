import Phaser from 'phaser'
import './style.css'

const W = 720
const H = 1280
const START_X = 180
const BASE_Y = 980
const GRAVITY = 2400
const BALL_R = 22
const BEST_KEY = 'neon-jump-best'

const $ = (id) => document.getElementById(id)
const scoreEl = $('score')
const bestEl = $('best')
const powerWrap = $('power-wrap')
const powerFill = $('power-fill')
const overlayStart = $('overlay-start')
const overlayOver = $('overlay-over')
const overlayPause = $('overlay-pause')

function loadBest() {
  try { return Number(localStorage.getItem(BEST_KEY) || 0) || 0 } catch { return 0 }
}
function saveBest(v) {
  try { localStorage.setItem(BEST_KEY, String(v)) } catch { /* ignore */ }
}
function vibrate(ms) {
  try { if (navigator.vibrate) navigator.vibrate(ms) } catch { /* ignore */ }
}

// Tiny WebAudio synth — no audio assets, so the bundle stays small for mini-games.
let audioCtx = null
let muted = false
function beep(freq, dur = 0.09, type = 'sine', vol = 0.08, slideTo = null) {
  if (muted) return
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)()
    if (audioCtx.state === 'suspended') audioCtx.resume()
    const o = audioCtx.createOscillator()
    const g = audioCtx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, audioCtx.currentTime)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, audioCtx.currentTime + dur)
    g.gain.setValueAtTime(vol, audioCtx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur)
    o.connect(g).connect(audioCtx.destination)
    o.start()
    o.stop(audioCtx.currentTime + dur)
  } catch { /* audio unavailable */ }
}

class GameScene extends Phaser.Scene {
  constructor() {
    super('Game')
    this.gameState = 'menu' // menu | idle | charging | jumping | shifting | over
    this.paused = false
    this.score = 0
    this.best = loadBest()
    this.power = 0
    this.chargeStart = 0
    this.vx = 0
    this.vy = 0
    this.prevBottom = 0
    this.platforms = []
    this.activePointerId = null
  }

  create() {
    this.makeTextures()
    this.buildBackground()
    this.platforms = []
    this.player = this.add.image(START_X, BASE_Y - BALL_R, 'ball').setDepth(5)
    this.player.setScale(1)
    this.score = 0
    this.gameState = 'menu'
    this.syncHud()

    // First two platforms: fixed first gap so the first jump is learnable.
    this.addPlatform(START_X, BASE_Y, 150, 0x00f0ff)
    this.spawnNext(true)

    // Floating hint text
    this.hintText = this.add.text(W / 2, 560, '按住蓄力 · 松手起跳', {
      fontSize: '30px', color: '#9aa7c7', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(4)
    this.tweens.add({ targets: this.hintText, alpha: 0.35, duration: 900, yoyo: true, repeat: -1 })

    this.perfectText = this.add.text(W / 2, 420, '', {
      fontSize: '44px', color: '#ffe600', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(6).setAlpha(0)

    // Input: touch / mouse via Phaser pointer events (single active pointer only).
    this.input.on('pointerdown', (p) => {
      if (this.activePointerId !== null) return
      if (this.gameState !== 'idle') return
      this.activePointerId = p.id
      this.startCharge()
    })
    this.input.on('pointerup', (p) => {
      if (p.id !== this.activePointerId) return
      this.activePointerId = null
      if (this.gameState === 'charging') this.releaseJump()
    })
    this.input.on('pointerupoutside', (p) => {
      if (p.id !== this.activePointerId) return
      this.activePointerId = null
      if (this.gameState === 'charging') this.releaseJump()
    })
    // Keyboard: Space to charge / jump.
    this.input.keyboard.on('keydown-SPACE', (e) => {
      e.preventDefault()
      if (this.gameState === 'idle') this.startCharge()
    })
    this.input.keyboard.on('keyup-SPACE', (e) => {
      e.preventDefault()
      if (this.gameState === 'charging') this.releaseJump()
    })
    // Note: input.mouse.preventDefaultWheel is a boolean property in
    // Phaser 3.80, not a method — do not call it. Wheel handling is
    // unnecessary for this game; touch scrolling is blocked in CSS/DOM.

    // Expose a small test hook for Playwright (does not affect normal play).
    window.NEON_JUMP = {
      getScore: () => this.score,
      getBest: () => this.best,
      getState: () => (this.paused ? 'paused' : this.gameState),
      getPower: () => this.power,
      getPlayer: () => ({ x: this.player.x, y: this.player.y }),
      getPlatforms: () => this.platforms.map((p) => ({ x: p.x, y: p.y, w: p.w })),
      start: () => this.startGame(),
      restart: () => this.startGame(),
      debugJump: (power) => this.debugJump(power),
      forceNext: (dx, dy = 0) => this.forceNext(dx, dy)
    }
  }

  makeTextures() {
    if (!this.textures.exists('ball')) {
      const g = this.make.graphics({ x: 0, y: 0, add: false })
      g.fillStyle(0x00f0ff, 1); g.fillCircle(32, 32, 28)
      g.fillStyle(0xffffff, 1); g.fillCircle(24, 24, 10)
      g.generateTexture('ball', 64, 64)
      g.destroy()
    }
    if (!this.textures.exists('dot')) {
      const g = this.make.graphics({ x: 0, y: 0, add: false })
      g.fillStyle(0xffffff, 1); g.fillCircle(4, 4, 4)
      g.generateTexture('dot', 8, 8)
      g.destroy()
    }
    if (!this.textures.exists('star')) {
      const g = this.make.graphics({ x: 0, y: 0, add: false })
      g.fillStyle(0xffffff, 1); g.fillCircle(3, 3, 2)
      g.generateTexture('star', 6, 6)
      g.destroy()
    }
  }

  buildBackground() {
    this.add.rectangle(0, 0, W, H, 0x070714).setOrigin(0).setDepth(0)
    // Stars (parallax layer, static positions, subtle twinkle via alpha tween on a few).
    this.stars = []
    for (let i = 0; i < 70; i++) {
      const s = this.add.image(
        Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), 'star'
      ).setAlpha(Phaser.Math.FloatBetween(0.25, 0.9)).setDepth(1)
      const scale = Phaser.Math.FloatBetween(0.6, 1.8)
      s.setScale(scale)
      this.stars.push(s)
    }
    // Distant neon grid glow at the bottom.
    const glow = this.add.rectangle(0, H - 130, W, 260, 0x0d0d2e).setOrigin(0).setDepth(1)
    glow.setAlpha(0.9)
  }

  platformColor() {
    const colors = [0x00f0ff, 0xff2ea6, 0xffe600, 0x7c5cff]
    return colors[this.score % colors.length]
  }

  addPlatform(x, y, w, color) {
    const body = this.add.rectangle(x, y, w, 26, 0x1a1a3d).setDepth(2)
    body.setStrokeStyle(2, color, 1)
    const top = this.add.rectangle(x, y - 13, w, 6, color).setDepth(3)
    const p = { x, y, w, body, top, color }
    this.platforms.push(p)
    return p
  }

  removePlatform(p) {
    p.body.destroy()
    p.top.destroy()
    this.platforms = this.platforms.filter((q) => q !== p)
  }

  gapForScore(score) {
    if (score < 5) return Phaser.Math.Between(180, 220)
    if (score < 10) return Phaser.Math.Between(200, 240)
    if (score < 20) return Phaser.Math.Between(210, 250)
    return Phaser.Math.Between(220, 260)
  }

  widthForScore(score) {
    return Math.max(90, 150 - score * 2)
  }

  spawnNext(isFirst = false) {
    const last = this.platforms[this.platforms.length - 1]
    const gap = isFirst ? 200 : this.gapForScore(this.score)
    const w = isFirst ? 130 : this.widthForScore(this.score)
    let y = last.y
    if (!isFirst) {
      y = Phaser.Math.Clamp(last.y + Phaser.Math.Between(-60, 60), 820, 1080)
    }
    return this.addPlatform(last.x + gap, y, w, this.platformColor())
  }

  startGame() {
    // Reset platforms and player.
    for (const p of [...this.platforms]) this.removePlatform(p)
    this.player.setPosition(START_X, BASE_Y - BALL_R).setScale(1).setAlpha(1).clearTint()
    this.score = 0
    this.power = 0
    this.vx = 0
    this.vy = 0
    this.paused = false
    this.gameState = 'idle'
    this.addPlatform(START_X, BASE_Y, 150, 0x00f0ff)
    this.spawnNext(true)
    this.hintText.setAlpha(1)
    this.perfectText.setAlpha(0)
    powerWrap.hidden = true
    overlayStart.hidden = true
    overlayOver.hidden = true
    overlayPause.hidden = true
    this.syncHud()
    beep(520, 0.08, 'sine', 0.06)
  }

  syncHud() {
    scoreEl.textContent = String(this.score)
    bestEl.textContent = String(this.best)
  }

  startCharge() {
    if (this.gameState !== 'idle' || this.paused) return
    this.gameState = 'charging'
    this.chargeStart = this.time.now
    this.power = 0
    powerWrap.hidden = false
    powerFill.style.width = '0%'
    beep(220, 0.06, 'sine', 0.04)
  }

  updateCharge() {
    const elapsed = this.time.now - this.chargeStart
    // 1.1s to full, then hold at 100 (no ping-pong: less frustration on mobile).
    this.power = Math.min(100, (elapsed / 1100) * 100)
    powerFill.style.width = `${this.power}%`
    // Squash: the harder you press, the flatter the ball.
    const s = this.power / 100
    this.player.setScale(1 + s * 0.22, 1 - s * 0.35)
  }

  releaseJump() {
    if (this.gameState !== 'charging') return
    const p = this.power
    powerWrap.hidden = true
    this.vx = 300 + p * 4.0
    this.vy = -(550 + p * 5.0)
    this.prevBottom = this.player.y + BALL_R
    this.gameState = 'jumping'
    this.player.setScale(0.85, 1.25) // stretch in the air
    beep(300, 0.14, 'sine', 0.08, 720)
    vibrate(8)
  }

  // Test helper: jump with an exact power from idle, bypassing pointer timing.
  debugJump(power) {
    if (this.gameState === 'menu' || this.gameState === 'over') this.startGame()
    if (this.gameState !== 'idle') return false
    this.power = Phaser.Math.Clamp(power, 0, 100)
    this.gameState = 'charging'
    this.releaseJump()
    return true
  }

  // Test helper: place the next platform at an exact offset from the current one.
  forceNext(dx, dy = 0) {
    const cur = this.platforms[0]
    const nxt = this.platforms[1]
    if (!cur || !nxt) return false
    nxt.x = cur.x + dx
    nxt.y = Phaser.Math.Clamp(cur.y + dy, 820, 1080)
    nxt.body.setPosition(nxt.x, nxt.y)
    nxt.top.setPosition(nxt.x, nxt.y - 13)
    return true
  }

  burst(x, y, color, count = 16) {
    try {
      const emitter = this.add.particles(x, y, 'dot', {
        speed: { min: 60, max: 260 },
        angle: { min: 0, max: 360 },
        scale: { start: 1.6, end: 0 },
        lifespan: 500,
        quantity: count,
        tint: color,
        emitting: false
      })
      emitter.explode(count, x, y)
      this.time.delayedCall(600, () => emitter.destroy())
    } catch { /* particles are cosmetic */ }
  }

  landOn(platform, isNext) {
    this.player.y = platform.y - 13 - BALL_R
    this.vx = 0
    this.vy = 0
    this.player.setScale(1.15, 0.8)
    this.tweens.add({ targets: this.player, scaleX: 1, scaleY: 1, duration: 160, ease: 'Back.easeOut' })
    this.burst(this.player.x, this.player.y + BALL_R, 0x00f0ff, 10)
    beep(180, 0.09, 'triangle', 0.09, 120)

    if (!isNext) {
      this.gameState = 'idle'
      return
    }
    const dist = Math.abs(this.player.x - platform.x)
    const perfect = dist < 12
    this.score += perfect ? 2 : 1
    if (this.score > this.best) {
      this.best = this.score
      saveBest(this.best)
    }
    this.syncHud()
    if (perfect) {
      this.perfectText.setText('PERFECT +2')
      this.perfectText.setAlpha(1)
      this.tweens.add({ targets: this.perfectText, y: 380, alpha: 0, duration: 700, onComplete: () => this.perfectText.setY(420) })
      this.burst(this.player.x, this.player.y, 0xffe600, 22)
      beep(880, 0.1, 'sine', 0.09)
      this.time.delayedCall(90, () => beep(1320, 0.12, 'sine', 0.08))
      vibrate(30)
    } else {
      vibrate(15)
    }
    this.hintText.setAlpha(0)
    this.shiftWorld(platform)
  }

  shiftWorld(landed) {
    this.gameState = 'shifting'
    const shift = landed.x - START_X
    // Spawn the following platform before shifting so it slides in from the right.
    const following = this.spawnNext(false)
    void following
    const targets = []
    for (const p of this.platforms) {
      targets.push({ obj: p.body, to: p.x - shift })
      targets.push({ obj: p.top, to: p.x - shift })
    }
    targets.push({ obj: this.player, to: this.player.x - shift })
    const tweens = targets.map(({ obj, to }) =>
      new Promise((resolve) => {
        this.tweens.add({ targets: obj, x: to, duration: 280, ease: 'Cubic.easeInOut', onComplete: resolve })
      })
    )
    Promise.all(tweens).then(() => {
      for (const p of this.platforms) p.x -= shift
      // Drop the platform that slid off-screen left.
      const old = this.platforms.find((p) => p.x < -100)
      if (old) this.removePlatform(old)
      if (this.gameState === 'shifting') this.gameState = 'idle'
    })
  }

  gameOver(reason) {
    if (this.gameState === 'over') return
    this.gameState = 'over'
    this.player.setAlpha(0.35)
    beep(320, 0.35, 'sawtooth', 0.06, 90)
    vibrate([40, 40, 60])
    const isRecord = this.score > 0 && this.score >= this.best
    $('final-score').textContent = String(this.score)
    $('final-best').textContent = String(this.best)
    $('new-record').hidden = !isRecord
    overlayOver.hidden = false
    void reason
  }

  update(time, delta) {
    if (this.paused) return
    if (this.gameState === 'charging') this.updateCharge()
    if (this.gameState !== 'jumping') return

    // Clamp at 50ms so slow devices / background tabs still progress
    // instead of stalling the fall (at <20fps game time runs slower).
    const dt = Math.min(delta / 1000, 0.05)
    this.vy += GRAVITY * dt
    this.prevBottom = this.player.y + BALL_R
    this.player.x += this.vx * dt
    this.player.y += this.vy * dt
    this.player.rotation += dt * 2.2
    const bottom = this.player.y + BALL_R

    // Landing check, only while falling.
    if (this.vy > 0) {
      for (const p of this.platforms) {
        const top = p.y - 13
        const withinX = this.player.x > p.x - p.w / 2 - BALL_R * 0.4 &&
          this.player.x < p.x + p.w / 2 + BALL_R * 0.4
        if (withinX && this.prevBottom <= top + 8 && bottom >= top) {
          this.player.rotation = 0
          this.landOn(p, p !== this.platforms[0])
          return
        }
      }
    }
    // Fell out of the world.
    if (bottom > H + 80 || this.player.x < -80 || this.player.x > W + 80) {
      this.gameOver('fall')
    }
  }
}

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: W,
  height: H,
  backgroundColor: '#070714',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: GameScene,
  physics: { default: 'arcade' },
  banner: false
}

const game = new Phaser.Game(config)
window.__neonGame = game

// DOM wiring (buttons live outside the canvas so they are easy to tap and test).
$('btn-start').addEventListener('click', () => {
  game.scene.scenes[0].startGame()
})
$('btn-restart').addEventListener('click', () => {
  game.scene.scenes[0].startGame()
})
$('btn-resume').addEventListener('click', () => {
  const s = game.scene.scenes[0]
  s.paused = false
  overlayPause.hidden = true
})
$('btn-pause').addEventListener('click', () => {
  const s = game.scene.scenes[0]
  if (s.gameState === 'menu' || s.gameState === 'over') return
  s.paused = !s.paused
  overlayPause.hidden = !s.paused
  $('btn-pause').textContent = s.paused ? '▶' : '⏸'
})
$('btn-mute').addEventListener('click', (e) => {
  muted = !muted
  e.currentTarget.textContent = muted ? '🔇' : '🔊'
})

// Keep best score visible before the first game.
bestEl.textContent = String(loadBest())
// Block page scroll / pull-to-refresh gestures over the stage on touch devices.
document.getElementById('stage').addEventListener('touchmove', (e) => e.preventDefault(), { passive: false })
document.getElementById('stage').addEventListener('contextmenu', (e) => e.preventDefault())
