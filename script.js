const robot = document.querySelector('#robot');
const stage = document.querySelector('#robot-stage');
const caption = document.querySelector('#action-caption');
const bubble = document.querySelector('#speech-bubble');
const powerStatus = document.querySelector('#power-status');
const statusLight = document.querySelector('#status-light');
const stageHud = document.querySelector('#stage-hud');
const buttons = document.querySelectorAll('.command-button[data-action]');
const canvas = document.querySelector('#fx-canvas');
const ctx = canvas.getContext('2d');

let isOn = true;
let bubbleTimer;
let actionTimer;
let activeSound;
let soundStopCleanup;
let soundStopTimer;
let scheduled = [];

// Add matching MP3 files inside a "sounds" folder to enable each command sound.
const sounds = {
    dance: 'sounds/dance.mp3',
    'self-destruct': 'sounds/self-destruct.mp3',
    secret: 'sounds/secret.mp3',
    shoot: 'sounds/shoot.mp3',
    'turn-on': 'sounds/turn-on.mp3',
    'turn-off': 'sounds/turn-off.mp3',
    flip: 'sounds/flip.mp3',
    greeting: 'sounds/greeting.mp3',
    jump: 'sounds/jump.mp3',
    laser: 'sounds/laser.mp3'
};

const robotName = 'Botsilichpsteindiddykirktron';

const messages = {
    dance: `${robotName} is showing off some moves!`,
    'self-destruct': 'Self-destruct sequence activated!',
    secret: `${robotName} is playing a mysterious sound...`,
    shoot: `Pew! ${robotName} fired a shot.`,
    'turn-on': 'Power systems online.',
    'turn-off': 'Powering down. See you soon!',
    flip: 'That was a perfect flip!',
    greeting: `A message from ${robotName}.`,
    jump: `Look how high ${robotName} can jump!`,
    laser: 'Laser eyes activated!'
};

const robotClasses = [
    'dance', 'jump', 'flip', 'shoot', 'greeting', 'secret', 'laser', 'powering-on',
    'denied', 'alarm', 'exploding', 'wrecked', 'reassemble'
];

/* ---------- Sound ---------- */

function playSound(action) {
    stopSound();
    activeSound = new Audio(sounds[action]);
    activeSound.play().catch(() => {
        // Sound files are optional until they are added to the sounds folder.
    });
}

function stopSound() {
    window.clearTimeout(soundStopTimer);
    soundStopCleanup?.();
    soundStopCleanup = undefined;

    if (!activeSound) {
        return;
    }

    activeSound.pause();
    activeSound.currentTime = 0;
    activeSound = undefined;
}

function stopSoundWhen(target, eventName, isActionEnd) {
    soundStopCleanup?.();
    const handleActionEnd = (event) => {
        if (event.target === target && isActionEnd(event)) {
            stopSound();
        }
    };
    target.addEventListener(eventName, handleActionEnd);
    soundStopCleanup = () => target.removeEventListener(eventName, handleActionEnd);
}

function stopSoundOnAnimationEnd(target, animationName) {
    stopSoundWhen(target, 'animationend', (event) => event.animationName === animationName);
}

function stopSoundAfter(duration) {
    soundStopTimer = window.setTimeout(stopSound, duration);
}

/* ---------- Effects engine ---------- */

const fx = {
    particles: [],
    bolts: [],
    scorches: [],
    beam: null,
    running: false,
    last: 0,
    width: 0,
    height: 0
};

function resizeCanvas() {
    const ratio = window.devicePixelRatio || 1;
    fx.width = stage.clientWidth;
    fx.height = stage.clientHeight;
    canvas.width = Math.round(fx.width * ratio);
    canvas.height = Math.round(fx.height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

new ResizeObserver(resizeCanvas).observe(stage);
resizeCanvas();

const floorY = () => fx.height - 30;
const rand = (min, max) => min + Math.random() * (max - min);

function pointOf(element) {
    const box = element.getBoundingClientRect();
    const stageBox = stage.getBoundingClientRect();
    return {
        x: box.left + box.width / 2 - stageBox.left,
        y: box.top + box.height / 2 - stageBox.top
    };
}

function glowColor() {
    return getComputedStyle(robot).getPropertyValue('--glow').trim() || '#6fe6ff';
}

function startFx() {
    if (!fx.running) {
        fx.running = true;
        fx.last = performance.now();
        requestAnimationFrame(renderFx);
    }
}

function spawn(options) {
    fx.particles.push({
        vx: 0, vy: 0, gravity: 0, drag: 0.98, size: 2, rotation: 0, spin: 0, bounce: false,
        ...options,
        age: 0
    });
    startFx();
}

function sparks(x, y, count, color = '#ffd27a', speed = 260) {
    for (let i = 0; i < count; i += 1) {
        const angle = rand(0, Math.PI * 2);
        const velocity = rand(0.3, 1) * speed;
        spawn({
            type: 'spark', x, y, color,
            vx: Math.cos(angle) * velocity,
            vy: Math.sin(angle) * velocity - speed * 0.3,
            gravity: 700, drag: 0.96, life: rand(0.25, 0.6), size: rand(1, 2.2)
        });
    }
}

function dust(x, y, count = 14) {
    for (let i = 0; i < count; i += 1) {
        const side = i % 2 ? 1 : -1;
        spawn({
            type: 'smoke', x: x + side * rand(10, 40), y,
            vx: side * rand(30, 110), vy: rand(-30, -8),
            drag: 0.93, life: rand(0.5, 0.9), size: rand(6, 12), color: '150, 165, 170', opacity: 0.22
        });
    }
}

function explosion(x, y) {
    fx.particles.push({ type: 'ring', x, y, age: 0, life: 0.55, size: 10 });
    for (let i = 0; i < 34; i += 1) {
        const angle = rand(0, Math.PI * 2);
        const velocity = rand(40, 230);
        spawn({
            type: 'fire', x: x + rand(-20, 20), y: y + rand(-40, 40),
            vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity - 60,
            drag: 0.9, life: rand(0.35, 0.8), size: rand(14, 30)
        });
    }
    for (let i = 0; i < 26; i += 1) {
        spawn({
            type: 'smoke', x: x + rand(-30, 30), y: y + rand(-30, 30),
            vx: rand(-60, 60), vy: rand(-90, -20),
            drag: 0.96, life: rand(1.2, 2.2), size: rand(16, 32), color: '45, 50, 54', opacity: 0.5, grow: 26
        });
    }
    const metals = ['#a7b0b4', '#6e787d', '#c8cfd1', '#a4561f', '#3a4247'];
    for (let i = 0; i < 30; i += 1) {
        const angle = rand(-Math.PI * 0.95, -Math.PI * 0.05);
        const velocity = rand(180, 520);
        spawn({
            type: 'debris', x: x + rand(-25, 25), y: y + rand(-50, 40),
            vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity,
            gravity: 900, drag: 0.995, life: rand(1.8, 2.8), size: rand(3, 9),
            rotation: rand(0, Math.PI), spin: rand(-14, 14), bounce: true,
            color: metals[i % metals.length]
        });
    }
    sparks(x, y, 70, '#ffcf6b', 520);
}

function fireBolt(origin) {
    fx.bolts.push({ x: origin.x, y: origin.y, vx: 1500, trail: [] });
    for (let i = 0; i < 12; i += 1) {
        spawn({
            type: 'spark', x: origin.x, y: origin.y, color: '#ffe0a0',
            vx: rand(60, 380), vy: rand(-120, 120), drag: 0.88, life: rand(0.08, 0.2), size: rand(1, 2.5)
        });
    }
    spawn({ type: 'flash', x: origin.x, y: origin.y, life: 0.12, size: 26 });
    startFx();
}

function startLaser(duration) {
    fx.beam = { start: performance.now(), duration };
    startFx();
}

function stopEffects() {
    fx.beam = null;
    fx.bolts = [];
    robot.style.setProperty('--head-tilt', '0deg');
}

function updateBeam(now, dt) {
    const beam = fx.beam;
    const progress = (now - beam.start) / beam.duration;
    if (progress >= 1 || !isOn) {
        fx.beam = null;
        robot.style.setProperty('--head-tilt', '0deg');
        return;
    }

    const ease = 0.5 - Math.cos(Math.min(progress / 0.85, 1) * Math.PI) / 2;
    const target = { x: fx.width * (0.1 + 0.8 * ease), y: floorY() + 6 };
    const envelope = Math.min(progress / 0.1, 1, (1 - progress) / 0.12);
    const eyes = robot.querySelectorAll('.eye');
    robot.style.setProperty('--head-tilt', `${(ease - 0.5) * 14}deg`);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    eyes.forEach((eye, index) => {
        const from = pointOf(eye);
        const to = { x: target.x + (index ? 7 : -7), y: target.y };
        ctx.globalAlpha = envelope;
        ctx.lineCap = 'round';
        ctx.shadowColor = '#ff4a2a';
        ctx.shadowBlur = 18;
        ctx.strokeStyle = 'rgba(255, 70, 40, 0.55)';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#fff1e6';
        ctx.lineWidth = 1.8;
        ctx.stroke();
    });
    const glow = ctx.createRadialGradient(target.x, target.y, 0, target.x, target.y, 30);
    glow.addColorStop(0, 'rgba(255, 240, 220, 0.95)');
    glow.addColorStop(0.3, 'rgba(255, 110, 50, 0.6)');
    glow.addColorStop(1, 'rgba(255, 60, 20, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(target.x, target.y, 30, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (envelope > 0.5) {
        fx.scorches.push({ x: target.x + rand(-3, 3), y: target.y + rand(-2, 2), age: 0, life: 3.5 });
        if (Math.random() < dt * 40) {
            sparks(target.x, target.y, 3, '#ffb35c', 220);
        }
        if (Math.random() < dt * 8) {
            spawn({
                type: 'smoke', x: target.x, y: target.y, vx: rand(-15, 15), vy: rand(-50, -25),
                drag: 0.97, life: rand(0.7, 1.2), size: rand(5, 9), color: '70, 76, 80', opacity: 0.35, grow: 14
            });
        }
    }
}

function drawParticle(particle) {
    const t = particle.age / particle.life;
    const fade = 1 - t;

    switch (particle.type) {
        case 'spark': {
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = particle.color;
            ctx.globalAlpha = fade;
            ctx.lineWidth = particle.size;
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(particle.x - particle.vx * 0.03, particle.y - particle.vy * 0.03);
            ctx.stroke();
            break;
        }
        case 'fire': {
            ctx.globalCompositeOperation = 'lighter';
            const radius = particle.size * (0.6 + t);
            const gradient = ctx.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, radius);
            gradient.addColorStop(0, `rgba(255, 245, 210, ${fade})`);
            gradient.addColorStop(0.35, `rgba(255, 150, 50, ${fade * 0.8})`);
            gradient.addColorStop(1, 'rgba(200, 40, 10, 0)');
            ctx.globalAlpha = 1;
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
            ctx.fill();
            break;
        }
        case 'smoke': {
            ctx.globalCompositeOperation = 'source-over';
            const radius = particle.size + (particle.grow || 8) * t;
            ctx.globalAlpha = particle.opacity * Math.sin(Math.PI * Math.min(t * 1.4, 1)) ;
            ctx.fillStyle = `rgb(${particle.color})`;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
            ctx.fill();
            break;
        }
        case 'debris': {
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = Math.min(1, fade * 3);
            ctx.save();
            ctx.translate(particle.x, particle.y);
            ctx.rotate(particle.rotation);
            ctx.fillStyle = particle.color;
            ctx.fillRect(-particle.size, -particle.size * 0.45, particle.size * 2, particle.size * 0.9);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.fillRect(-particle.size, -particle.size * 0.45, particle.size * 2, particle.size * 0.25);
            ctx.restore();
            break;
        }
        case 'ring': {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = fade * 0.8;
            ctx.strokeStyle = '#ffd9a8';
            ctx.lineWidth = 3 * fade + 0.5;
            ctx.beginPath();
            ctx.ellipse(particle.x, particle.y, 10 + t * 260, 4 + t * 70, 0, 0, Math.PI * 2);
            ctx.stroke();
            break;
        }
        case 'flash': {
            ctx.globalCompositeOperation = 'lighter';
            const gradient = ctx.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, particle.size);
            gradient.addColorStop(0, `rgba(255, 250, 230, ${fade})`);
            gradient.addColorStop(0.4, `rgba(255, 170, 80, ${fade * 0.7})`);
            gradient.addColorStop(1, 'rgba(255, 120, 40, 0)');
            ctx.globalAlpha = 1;
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            ctx.fill();
            break;
        }
        case 'note': {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = Math.sin(Math.PI * t);
            ctx.fillStyle = particle.color;
            ctx.shadowColor = particle.color;
            ctx.shadowBlur = 10;
            ctx.font = `${particle.size}px sans-serif`;
            ctx.fillText(particle.glyph, particle.x, particle.y);
            ctx.shadowBlur = 0;
            break;
        }
        default:
            break;
    }
}

function renderFx(now) {
    const dt = Math.min((now - fx.last) / 1000, 0.05);
    fx.last = now;
    ctx.clearRect(0, 0, fx.width, fx.height);

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    fx.scorches = fx.scorches.filter((mark) => (mark.age += dt) < mark.life);
    fx.scorches.forEach((mark) => {
        const heat = Math.max(0, 1 - mark.age * 2.5);
        ctx.globalAlpha = 0.5 * (1 - mark.age / mark.life);
        ctx.fillStyle = heat > 0 ? `rgb(${120 + 135 * heat}, ${40 + 80 * heat}, 20)` : '#050505';
        ctx.beginPath();
        ctx.ellipse(mark.x, mark.y, 4, 1.6, 0, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();

    if (fx.beam) {
        updateBeam(now, dt);
    }

    ctx.save();
    fx.bolts = fx.bolts.filter((bolt) => {
        bolt.trail.unshift({ x: bolt.x, y: bolt.y });
        bolt.trail.length = Math.min(bolt.trail.length, 6);
        bolt.x += bolt.vx * dt;
        if (bolt.x > fx.width - 4) {
            sparks(fx.width - 4, bolt.y, 22, '#ffd07a', 300);
            spawn({ type: 'flash', x: fx.width - 4, y: bolt.y, life: 0.18, size: 34 });
            fx.scorches.push({ x: fx.width - 5, y: bolt.y, age: 0, life: 3 });
            return false;
        }
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        ctx.shadowColor = '#ff8a3a';
        ctx.shadowBlur = 14;
        ctx.strokeStyle = 'rgba(255, 140, 60, 0.85)';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(bolt.x, bolt.y);
        ctx.lineTo(bolt.x - 46, bolt.y);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#fff4e0';
        ctx.lineWidth = 2;
        ctx.stroke();
        return true;
    });
    ctx.restore();

    ctx.save();
    fx.particles = fx.particles.filter((particle) => {
        particle.age += dt;
        if (particle.age >= particle.life) {
            return false;
        }
        const drag = Math.pow(particle.drag, dt * 60);
        particle.vx *= drag;
        particle.vy = particle.vy * drag + particle.gravity * dt;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.rotation += particle.spin * dt;
        if (particle.bounce && particle.y > floorY() + rand(0, 14)) {
            particle.y = Math.min(particle.y, floorY() + 14);
            particle.vy *= -0.35;
            particle.vx *= 0.6;
            particle.spin *= 0.5;
        }
        drawParticle(particle);
        return true;
    });
    ctx.restore();

    if (fx.particles.length || fx.bolts.length || fx.scorches.length || fx.beam) {
        requestAnimationFrame(renderFx);
    } else {
        fx.running = false;
        ctx.clearRect(0, 0, fx.width, fx.height);
    }
}

/* ---------- Eye tracking ---------- */

let lastPointerMove = 0;

function lookAt(clientX, clientY) {
    if (!isOn || fx.beam) {
        return;
    }
    const head = robot.querySelector('.head').getBoundingClientRect();
    const dx = clientX - (head.left + head.width / 2);
    const dy = clientY - (head.top + head.height * 0.4);
    const nx = Math.max(-1, Math.min(1, dx / 260));
    const ny = Math.max(-1, Math.min(1, dy / 220));
    robot.style.setProperty('--look-x', `${(nx * 3.5).toFixed(2)}px`);
    robot.style.setProperty('--look-y', `${(ny * 2).toFixed(2)}px`);
    robot.style.setProperty('--head-tilt', `${(nx * 4).toFixed(2)}deg`);
}

window.addEventListener('pointermove', (event) => {
    lastPointerMove = performance.now();
    lookAt(event.clientX, event.clientY);
});

window.setInterval(() => {
    if (performance.now() - lastPointerMove < 4000 || !isOn || fx.beam) {
        return;
    }
    const box = stage.getBoundingClientRect();
    lookAt(box.left + rand(0, box.width), box.top + rand(0, box.height));
}, 2200);

/* ---------- Robot state ---------- */

function showBubble(text, duration = 2600, alert = false) {
    window.clearTimeout(bubbleTimer);
    bubble.textContent = text;
    bubble.classList.toggle('alert', alert);
    bubble.classList.add('visible');
    bubbleTimer = window.setTimeout(() => bubble.classList.remove('visible'), duration);
}

function restartAnimation(element, className) {
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
}

function schedule(callback, delay) {
    scheduled.push(window.setTimeout(callback, delay));
}

function clearScheduled() {
    scheduled.forEach((timer) => window.clearTimeout(timer));
    scheduled = [];
}

function clearActionClasses() {
    robot.classList.remove(...robotClasses);
    stage.classList.remove('alarm-active', 'explosion-active', 'shake');
}

function setPower(on, hudText) {
    isOn = on;
    statusLight.classList.toggle('offline', !on);
    powerStatus.textContent = on ? 'SYSTEM ONLINE' : 'SYSTEM OFFLINE';
    stageHud.textContent = hudText || (on ? 'BAY 01 · CORE 100%' : 'BAY 01 · CORE 0%');
    if (!on) {
        robot.style.setProperty('--look-x', '0px');
        robot.style.setProperty('--look-y', '0px');
        robot.style.setProperty('--head-tilt', '0deg');
    }
}

function feetPoint() {
    const box = robot.getBoundingClientRect();
    const stageBox = stage.getBoundingClientRect();
    return { x: box.left + box.width / 2 - stageBox.left, y: floorY() };
}

function runSelfDestruct() {
    setPower(false, 'BAY 01 · CORE CRITICAL');
    robot.classList.add('alarm');
    stage.classList.add('alarm-active');
    showBubble('SELF-DESTRUCT IN 3', 2600, true);
    schedule(() => showBubble('SELF-DESTRUCT IN 2', 2600, true), 400);
    schedule(() => showBubble('SELF-DESTRUCT IN 1', 2600, true), 800);

    schedule(() => {
        robot.classList.remove('alarm');
        stage.classList.remove('alarm-active');
        restartAnimation(robot, 'exploding');
        showBubble('Goodbye, little robot!', 2400, true);
    }, 1200);

    schedule(() => {
        const center = pointOf(robot.querySelector('.core'));
        stage.classList.add('explosion-active');
        restartAnimation(stage, 'shake');
        stopSoundOnAnimationEnd(document.querySelector('#blast-label'), 'boom');
        explosion(center.x, center.y);
        robot.classList.add('wrecked');
    }, 1500);

    schedule(() => {
        robot.classList.remove('exploding', 'wrecked');
        robot.classList.add('power-off');
        restartAnimation(robot, 'reassemble');
        stage.classList.remove('explosion-active', 'shake');
        setPower(false);
    }, 3800);
}

function runAction(action) {
    if (action !== 'turn-on' && !isOn) {
        caption.textContent = `${robotName} is powered off. Turn it on first.`;
        if (!robot.classList.contains('wrecked') && !robot.classList.contains('alarm')) {
            restartAnimation(robot, 'denied');
        }
        return;
    }

    playSound(action);
    caption.textContent = messages[action];
    window.clearTimeout(actionTimer);
    clearScheduled();
    stopEffects();

    if (action === 'turn-on') {
        clearActionClasses();
        setPower(true);
        robot.classList.remove('power-off');
        restartAnimation(robot, 'powering-on');
        showBubble('Hello! I am back.');
        actionTimer = window.setTimeout(clearActionClasses, 1200);
        return;
    }

    if (action === 'turn-off') {
        clearActionClasses();
        setPower(false);
        robot.classList.add('power-off');
        bubble.classList.remove('visible');
        return;
    }

    if (action === 'self-destruct') {
        clearActionClasses();
        runSelfDestruct();
        return;
    }

    clearActionClasses();

    if (action === 'greeting') {
        const greeting = 'Hola Ilich, ¿Cómo estás?';
        showBubble(greeting);
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const spokenGreeting = new SpeechSynthesisUtterance(greeting);
            spokenGreeting.lang = 'es-ES';
            spokenGreeting.onend = stopSound;
            spokenGreeting.onerror = stopSound;
            //window.speechSynthesis.speak(spokenGreeting);
        } else {
            stopSoundAfter(2600);
        }
        robot.classList.add('greeting');
    } else if (action === 'secret') {
        showBubble('♪  ♪  ♪');
        stopSoundAfter(2600);
        robot.classList.add('secret');
        const head = pointOf(robot.querySelector('.head'));
        for (let i = 0; i < 9; i += 1) {
            schedule(() => spawn({
                type: 'note', glyph: ['♪', '♫', '♩'][i % 3], x: head.x + rand(-60, 50), y: head.y + rand(-10, 20),
                vx: rand(-25, 25), vy: rand(-70, -45), drag: 0.99, life: rand(1.2, 1.7), size: rand(14, 20),
                color: `hsl(${rand(0, 360)}, 90%, 70%)`
            }), i * 220);
        }
    } else {
        showBubble(messages[action]);
    }

    if (['dance', 'jump', 'flip', 'shoot'].includes(action)) {
        restartAnimation(robot, action);
        const animatedElement = action === 'shoot' ? robot.querySelector('.arm-right') : robot;
        const animationName = action === 'shoot' ? 'shoot-arm' : action;
        stopSoundOnAnimationEnd(animatedElement, animationName);
    }

    if (action === 'jump') {
        [100, 690, 900, 1490].forEach((delay) => schedule(() => {
            const feet = feetPoint();
            dust(feet.x, feet.y, 10);
        }, delay));
    } else if (action === 'flip') {
        schedule(() => {
            const feet = feetPoint();
            dust(feet.x, feet.y, 16);
        }, 860);
    } else if (action === 'shoot') {
        schedule(() => fireBolt(pointOf(robot.querySelector('.muzzle'))), 210);
    } else if (action === 'laser') {
        robot.classList.add('laser');
        startLaser(2000);
        stopSoundAfter(2000);
    }

    actionTimer = window.setTimeout(() => {
        clearActionClasses();
    }, 2200);
}

buttons.forEach((button) => {
    const action = button.dataset.action;
    if (button.dataset.gesture === 'double') {
        button.addEventListener('dblclick', () => runAction(action));
    } else {
        button.addEventListener('click', () => runAction(action));
    }
});

/* ---------- Background music ---------- */

const soundtrackSrc = 'sounds/soundtrack.mp3';
const music = new Audio(soundtrackSrc);
music.loop = true;
music.volume = 0.04;

function startMusic() {
    if (rhythm.open) {
        return;
    }
    music.play().catch(() => {
        // Browsers block autoplay until the first click or key press.
    });
}

function unlockMusic() {
    window.removeEventListener('pointerdown', unlockMusic);
    window.removeEventListener('keydown', unlockMusic);
    startMusic();
}

window.addEventListener('pointerdown', unlockMusic);
window.addEventListener('keydown', unlockMusic);

/* ---------- Rhythm game ---------- */

const rhythmKeys = ['d', 'f', 'j', 'k'];
const laneColors = ['#6fe6ff', '#b8ef72', '#b8ef72', '#6fe6ff'];
const hitWindows = [
    { name: 'PERFECT', range: 0.04, points: 300, color: '#ffe48a' },
    { name: 'GREAT', range: 0.075, points: 200, color: '#b8ef72' },
    { name: 'GOOD', range: 0.11, points: 100, color: '#6fe6ff' }
];
const missWindow = 0.11;
const approachTime = 0.55; // Seconds a note takes to fall to the hit line.
const leadIn = 1.6;
const maxLives = 5;
const comboForLife = 30;
// About 5.6 notes per second with frequent chords feels like a 4★ osu!mania map.
const notesPerSecond = 5.6;
const minNoteGap = 0.09;

const rhythmButton = document.querySelector('#rhythm-button');
const rhythmOverlay = document.querySelector('#rhythm');
const rhythmStage = document.querySelector('#rhythm-stage');
const rhythmCanvas = document.querySelector('#rhythm-canvas');
const rctx = rhythmCanvas.getContext('2d');
const rhythmScreen = document.querySelector('#rhythm-screen');
const rhythmScreenTitle = document.querySelector('#rhythm-screen-title');
const rhythmScreenText = document.querySelector('#rhythm-screen-text');
const rhythmStart = document.querySelector('#rhythm-start');
const rhythmLives = document.querySelector('#rhythm-lives');
const rhythmScore = document.querySelector('#rhythm-score');

const rhythm = {
    open: false,
    state: 'idle',
    song: null,
    audio: null,
    source: null,
    player: null,
    notes: [],
    next: 0,
    lives: maxLives,
    combo: 0,
    maxCombo: 0,
    score: 0,
    judged: 0,
    popup: null,
    lanesDown: [false, false, false, false],
    laneFlash: [0, 0, 0, 0],
    pointers: new Map(),
    width: 0,
    height: 0
};

let songPromise;

function mulberry32(seed) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function assignLanes(events, chordCut, tripleCut) {
    const random = mulberry32(35);
    const notes = [];
    let previous = [];
    let previousTime = -1;

    events.forEach(({ time, strength }) => {
        const gap = time - previousTime;
        let size = 1;
        if (strength >= tripleCut && gap >= 0.3) {
            size = 3;
        } else if (strength >= chordCut && gap >= 0.15) {
            size = 2;
        }
        // Keep quick notes off the key that was just pressed so there are no fast jacks.
        const pool = [0, 1, 2, 3].filter((lane) => gap >= 0.2 || !previous.includes(lane));
        for (let i = pool.length - 1; i > 0; i -= 1) {
            const j = Math.floor(random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        const lanes = pool.slice(0, size);
        lanes.forEach((lane) => notes.push({ time, lane }));
        previous = lanes;
        previousTime = time;
    });
    return notes;
}

// Finds the beats of the song (kicks, snares, hats) and turns the strongest ones into notes.
function buildChart(buffer) {
    const rate = buffer.sampleRate;
    const hop = Math.round(rate * 0.005);
    const frameTime = hop / rate;
    const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
    const frames = Math.floor(buffer.length / hop);
    const energy = new Float32Array(frames * 3);
    const loudness = new Float32Array(frames);
    const lowCoef = Math.exp(-2 * Math.PI * 160 / rate);
    const midCoef = Math.exp(-2 * Math.PI * 2500 / rate);
    let low = 0;
    let mid = 0;

    for (let f = 0; f < frames; f += 1) {
        let eLow = 0;
        let eMid = 0;
        let eHigh = 0;
        for (let i = f * hop, end = i + hop; i < end; i += 1) {
            let x = 0;
            for (const data of channels) {
                x += data[i];
            }
            x /= channels.length;
            low = low * lowCoef + x * (1 - lowCoef);
            mid = mid * midCoef + x * (1 - midCoef);
            eLow += low * low;
            eMid += (mid - low) * (mid - low);
            eHigh += (x - mid) * (x - mid);
        }
        energy[f * 3] = eLow;
        energy[f * 3 + 1] = eMid;
        energy[f * 3 + 2] = eHigh;
        loudness[f] = eLow + eMid + eHigh;
    }

    const quiet = [...loudness].sort((a, b) => a - b)[Math.floor(frames / 2)] * 0.02;
    const eps = hop * 1e-5;
    const weights = [1.2, 1, 0.8];
    const flux = new Float32Array(frames);
    let activeFrames = 0;
    for (let f = 2; f < frames; f += 1) {
        if (loudness[f] < quiet) {
            continue;
        }
        activeFrames += 1;
        for (let b = 0; b < 3; b += 1) {
            const rise = Math.log(energy[f * 3 + b] + eps) - Math.log(energy[(f - 2) * 3 + b] + eps);
            flux[f] += Math.max(0, rise) * weights[b];
        }
    }

    const sums = new Float64Array(frames + 1);
    flux.forEach((value, f) => {
        sums[f + 1] = sums[f] + value;
    });
    const candidates = [];
    const span = 100;
    const peakSpan = 10;
    for (let f = peakSpan; f < frames - peakSpan; f += 1) {
        const from = Math.max(0, f - span);
        const to = Math.min(frames, f + span);
        const mean = (sums[to] - sums[from]) / (to - from);
        if (flux[f] <= mean * 1.5 + 0.05) {
            continue;
        }
        let isPeak = true;
        for (let k = f - peakSpan; k <= f + peakSpan && isPeak; k += 1) {
            isPeak = flux[k] < flux[f] || (flux[k] === flux[f] && k >= f);
        }
        if (isPeak) {
            candidates.push({ frame: f, strength: flux[f] - mean });
        }
    }

    candidates.sort((a, b) => b.strength - a.strength);
    const target = Math.round(activeFrames * frameTime * notesPerSecond);
    const gapFrames = Math.round(minNoteGap / frameTime);
    const taken = new Uint8Array(frames);
    const chosen = [];
    for (const candidate of candidates) {
        if (chosen.length >= target) {
            break;
        }
        if (taken[candidate.frame]) {
            continue;
        }
        chosen.push(candidate);
        for (let k = Math.max(0, candidate.frame - gapFrames + 1); k < Math.min(frames, candidate.frame + gapFrames); k += 1) {
            taken[k] = 1;
        }
    }

    const chordCut = chosen[Math.floor(chosen.length * 0.25)]?.strength ?? Infinity;
    const tripleCut = chosen[Math.floor(chosen.length * 0.04)]?.strength ?? Infinity;
    chosen.sort((a, b) => a.frame - b.frame);
    const events = chosen.map(({ frame, strength }) => ({ time: frame * frameTime, strength }));
    return assignLanes(events, chordCut, tripleCut);
}

function buildFallbackChart(duration) {
    const step = 60 / 160 / 2;
    const events = [];
    for (let i = 0, time = 1; time < duration - 2; i += 1, time += step) {
        events.push({ time, strength: i % 8 === 0 ? 2 : i % 4 === 0 ? 1 : 0 });
    }
    return assignLanes(events, 1, 2);
}

function mediaDuration() {
    if (Number.isFinite(music.duration)) {
        return Promise.resolve(music.duration);
    }
    return new Promise((resolve) => {
        music.addEventListener('loadedmetadata', () => resolve(music.duration), { once: true });
        window.setTimeout(() => resolve(180), 4000);
    });
}

function loadSong() {
    songPromise ??= (async () => {
        try {
            rhythm.audio ??= new AudioContext();
            const response = await fetch(soundtrackSrc);
            const buffer = await rhythm.audio.decodeAudioData(await response.arrayBuffer());
            return { buffer, notes: buildChart(buffer), synced: true, duration: buffer.duration };
        } catch {
            // Pages opened straight from disk (file://) cannot read audio data, so use a fixed-tempo chart.
            const duration = await mediaDuration();
            return { notes: buildFallbackChart(duration), synced: false, duration };
        }
    })();
    return songPromise;
}

function songTime() {
    if (rhythm.song.synced) {
        return rhythm.audio.currentTime - rhythm.startAt - (rhythm.audio.outputLatency || 0);
    }
    return (performance.now() - rhythm.startPerf) / 1000;
}

function updateRhythmHud() {
    rhythmLives.textContent = '♥'.repeat(rhythm.lives) + '♡'.repeat(maxLives - rhythm.lives);
    rhythmLives.setAttribute('aria-label', `${rhythm.lives} lives`);
    rhythmScore.textContent = rhythm.score.toLocaleString('en-US');
}

function showRhythmScreen(title, text, buttonLabel) {
    rhythmScreen.hidden = false;
    rhythmScreenTitle.textContent = title;
    rhythmScreenText.textContent = text;
    rhythmStart.hidden = !buttonLabel;
    if (buttonLabel) {
        rhythmStart.textContent = buttonLabel;
        rhythmStart.focus();
    }
}

function showRhythmReady() {
    rhythm.state = 'ready';
    const sync = rhythm.song.synced
        ? ''
        : ' (Open the site from a local server so the notes follow the music.)';
    showRhythmScreen(
        'Ready?',
        `Hit the notes with D F J K when they reach the line. 5 misses and you lose, every ${comboForLife} combo gives you a life back.${sync}`,
        'Start'
    );
}

function resizeRhythm() {
    const ratio = window.devicePixelRatio || 1;
    rhythm.width = rhythmStage.clientWidth;
    rhythm.height = rhythmStage.clientHeight;
    rhythmCanvas.width = Math.round(rhythm.width * ratio);
    rhythmCanvas.height = Math.round(rhythm.height * ratio);
    rctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (rhythm.state !== 'playing') {
        drawRhythm(-leadIn);
    }
}

function openRhythm() {
    rhythm.open = true;
    music.pause();
    stopSound();
    rhythmOverlay.hidden = false;
    document.body.classList.add('rhythm-open');
    rhythm.notes = [];
    rhythm.state = 'loading';
    rhythm.lives = maxLives;
    rhythm.score = 0;
    updateRhythmHud();
    resizeRhythm();
    showRhythmScreen('Loading song…', 'Mapping the beats of the soundtrack.');
    loadSong().then((song) => {
        rhythm.song = song;
        if (rhythm.open && rhythm.state === 'loading') {
            showRhythmReady();
        }
    });
}

function stopSong() {
    window.cancelAnimationFrame(rhythm.frame);
    window.clearTimeout(rhythm.playTimer);
    try {
        rhythm.source?.stop();
    } catch {
        // The source may already be stopped.
    }
    rhythm.source = null;
    rhythm.player?.pause();
}

function closeRhythm() {
    stopSong();
    rhythm.open = false;
    rhythm.state = 'idle';
    rhythmOverlay.hidden = true;
    document.body.classList.remove('rhythm-open');
    startMusic();
    rhythmButton.focus();
}

function startRhythm() {
    const song = rhythm.song;
    stopSong();
    rhythm.notes = song.notes.map((note) => ({ ...note, judged: false }));
    rhythm.next = 0;
    rhythm.lives = maxLives;
    rhythm.combo = 0;
    rhythm.maxCombo = 0;
    rhythm.score = 0;
    rhythm.judged = 0;
    rhythm.popup = null;
    rhythm.end = Math.min(song.duration, (rhythm.notes.at(-1)?.time ?? 0) + 2);
    rhythm.state = 'playing';
    rhythmScreen.hidden = true;
    updateRhythmHud();

    if (song.synced) {
        const ac = rhythm.audio;
        ac.resume();
        const gain = ac.createGain();
        gain.gain.value = 0.7;
        rhythm.source = ac.createBufferSource();
        rhythm.source.buffer = song.buffer;
        rhythm.source.connect(gain).connect(ac.destination);
        rhythm.startAt = ac.currentTime + leadIn;
        rhythm.source.start(rhythm.startAt);
    } else {
        rhythm.player ??= new Audio(soundtrackSrc);
        rhythm.player.volume = 0.7;
        rhythm.player.currentTime = 0;
        rhythm.startPerf = performance.now() + leadIn * 1000;
        rhythm.playTimer = window.setTimeout(() => rhythm.player.play().catch(() => {}), leadIn * 1000);
    }

    rhythm.frame = window.requestAnimationFrame(rhythmLoop);
}

function finishRhythm(cleared) {
    stopSong();
    rhythm.state = 'over';
    const accuracy = rhythm.judged ? (rhythm.score / (rhythm.judged * 300)) * 100 : 0;
    showRhythmScreen(
        cleared ? 'Song cleared!' : 'Game over',
        `Score ${rhythm.score.toLocaleString('en-US')} · Accuracy ${accuracy.toFixed(1)}% · Max combo ${rhythm.maxCombo}`,
        'Play again'
    );
    drawRhythm(songTime());
}

function judge(note, grade) {
    note.judged = true;
    rhythm.judged += 1;
    const now = performance.now();

    if (!grade) {
        rhythm.combo = 0;
        rhythm.lives -= 1;
        rhythm.popup = { text: 'MISS', color: '#f2785d', at: now };
        updateRhythmHud();
        if (rhythm.lives <= 0) {
            finishRhythm(false);
        }
        return;
    }

    rhythm.score += grade.points;
    rhythm.combo += 1;
    rhythm.maxCombo = Math.max(rhythm.maxCombo, rhythm.combo);
    rhythm.laneFlash[note.lane] = now;
    rhythm.popup = { text: grade.name, color: grade.color, at: now };
    if (rhythm.combo % comboForLife === 0 && rhythm.lives < maxLives) {
        rhythm.lives += 1;
        rhythm.popup = { text: '+1 LIFE', color: '#ff8fa3', at: now };
    }
    updateRhythmHud();
}

function pressLane(lane) {
    rhythm.lanesDown[lane] = true;
    if (rhythm.state !== 'playing') {
        return;
    }
    const now = songTime();
    for (let i = rhythm.next; i < rhythm.notes.length; i += 1) {
        const note = rhythm.notes[i];
        if (note.time - now > missWindow) {
            return;
        }
        if (!note.judged && note.lane === lane) {
            const offset = Math.abs(note.time - now);
            judge(note, hitWindows.find((window) => offset <= window.range));
            return;
        }
    }
}

function releaseLane(lane) {
    rhythm.lanesDown[lane] = false;
}

function rhythmLoop() {
    const now = songTime();
    const { notes } = rhythm;

    for (let i = rhythm.next; i < notes.length && notes[i].time < now - missWindow; i += 1) {
        if (!notes[i].judged) {
            judge(notes[i], null);
            if (rhythm.state !== 'playing') {
                return;
            }
        }
    }
    while (rhythm.next < notes.length && notes[rhythm.next].judged) {
        rhythm.next += 1;
    }

    if (now > rhythm.end) {
        finishRhythm(true);
        return;
    }

    drawRhythm(now);
    rhythm.frame = window.requestAnimationFrame(rhythmLoop);
}

function drawRhythm(now) {
    const { width, height } = rhythm;
    const laneWidth = width / 4;
    const hitY = height - 92;
    const speed = hitY / approachTime;
    const clock = performance.now();

    rctx.clearRect(0, 0, width, height);
    rctx.fillStyle = '#0d1417';
    rctx.fillRect(0, 0, width, height);

    for (let lane = 0; lane < 4; lane += 1) {
        const x = lane * laneWidth;
        rctx.fillStyle = lane % 2 ? '#0f181b' : '#111c20';
        rctx.fillRect(x, 0, laneWidth, height);
        if (rhythm.lanesDown[lane]) {
            const glow = rctx.createLinearGradient(0, hitY, 0, hitY - 260);
            glow.addColorStop(0, `${laneColors[lane]}40`);
            glow.addColorStop(1, `${laneColors[lane]}00`);
            rctx.fillStyle = glow;
            rctx.fillRect(x, hitY - 260, laneWidth, 260);
        }
        rctx.fillStyle = '#1f2c33';
        rctx.fillRect(x, 0, 1, height);
    }

    rctx.fillStyle = 'rgba(232, 240, 234, 0.55)';
    rctx.fillRect(0, hitY - 1, width, 2);

    rctx.textAlign = 'center';
    rctx.textBaseline = 'middle';
    for (let lane = 0; lane < 4; lane += 1) {
        const cx = lane * laneWidth + laneWidth / 2;
        const color = laneColors[lane];
        const flash = Math.max(0, 1 - (clock - rhythm.laneFlash[lane]) / 160);

        rctx.lineWidth = 2;
        rctx.strokeStyle = color;
        rctx.fillStyle = rhythm.lanesDown[lane] ? color : '#0d1417';
        rctx.globalAlpha = rhythm.lanesDown[lane] ? 0.9 : 0.6;
        rctx.beginPath();
        rctx.roundRect(cx - laneWidth / 2 + 8, hitY - 9, laneWidth - 16, 18, 5);
        rctx.fill();
        rctx.stroke();
        rctx.globalAlpha = 1;

        if (flash > 0) {
            const burst = rctx.createRadialGradient(cx, hitY, 0, cx, hitY, laneWidth * 0.7);
            burst.addColorStop(0, `rgba(255, 255, 255, ${0.8 * flash})`);
            burst.addColorStop(0.4, `${color}${Math.round(flash * 120).toString(16).padStart(2, '0')}`);
            burst.addColorStop(1, `${color}00`);
            rctx.fillStyle = burst;
            rctx.fillRect(cx - laneWidth, hitY - laneWidth, laneWidth * 2, laneWidth * 2);
        }

        rctx.fillStyle = rhythm.lanesDown[lane] ? '#e8f0ea' : '#738078';
        rctx.font = '500 15px "DM Mono", Consolas, monospace';
        rctx.fillText(rhythmKeys[lane].toUpperCase(), cx, hitY + 46);
    }

    for (let i = rhythm.next; i < rhythm.notes.length; i += 1) {
        const note = rhythm.notes[i];
        const y = hitY - (note.time - now) * speed;
        if (y < -20) {
            break;
        }
        if (note.judged) {
            continue;
        }
        const x = note.lane * laneWidth;
        rctx.shadowColor = laneColors[note.lane];
        rctx.shadowBlur = 12;
        rctx.fillStyle = laneColors[note.lane];
        rctx.beginPath();
        rctx.roundRect(x + 6, y - 9, laneWidth - 12, 18, 5);
        rctx.fill();
        rctx.shadowBlur = 0;
        rctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        rctx.fillRect(x + 12, y - 6, laneWidth - 24, 3);
    }

    if (rhythm.state !== 'playing') {
        return;
    }

    if (now < 0) {
        rctx.fillStyle = '#e8f0ea';
        rctx.font = '700 22px "Space Grotesk", sans-serif';
        rctx.fillText(now < -0.6 ? 'GET READY' : 'GO!', width / 2, height * 0.38);
    }

    if (rhythm.combo >= 2) {
        rctx.fillStyle = 'rgba(232, 240, 234, 0.9)';
        rctx.font = '700 40px "Space Grotesk", sans-serif';
        rctx.fillText(rhythm.combo, width / 2, height * 0.32);
    }

    if (rhythm.popup) {
        const age = (clock - rhythm.popup.at) / 450;
        if (age < 1) {
            rctx.globalAlpha = 1 - age;
            rctx.fillStyle = rhythm.popup.color;
            rctx.font = '600 17px "DM Mono", Consolas, monospace';
            rctx.fillText(rhythm.popup.text, width / 2, height * 0.32 + 38 - age * 8);
            rctx.globalAlpha = 1;
        }
    }
}

rhythmButton.addEventListener('click', openRhythm);
document.querySelector('#rhythm-close').addEventListener('click', closeRhythm);
rhythmStart.addEventListener('click', () => {
    rhythmStart.blur();
    startRhythm();
});
new ResizeObserver(() => rhythm.open && resizeRhythm()).observe(rhythmStage);

window.addEventListener('keydown', (event) => {
    if (!rhythm.open) {
        return;
    }
    if (event.key === 'Escape') {
        closeRhythm();
        return;
    }
    const lane = rhythmKeys.indexOf(event.key.toLowerCase());
    if (lane >= 0) {
        event.preventDefault();
        if (!event.repeat) {
            pressLane(lane);
        }
    }
});

window.addEventListener('keyup', (event) => {
    const lane = rhythmKeys.indexOf(event.key.toLowerCase());
    if (lane >= 0) {
        releaseLane(lane);
    }
});

rhythmCanvas.addEventListener('pointerdown', (event) => {
    const lane = Math.min(3, Math.floor(event.offsetX / (rhythm.width / 4)));
    rhythm.pointers.set(event.pointerId, lane);
    pressLane(lane);
});

['pointerup', 'pointercancel', 'pointerleave'].forEach((eventName) => {
    rhythmCanvas.addEventListener(eventName, (event) => {
        if (rhythm.pointers.has(event.pointerId)) {
            releaseLane(rhythm.pointers.get(event.pointerId));
            rhythm.pointers.delete(event.pointerId);
        }
    });
});
