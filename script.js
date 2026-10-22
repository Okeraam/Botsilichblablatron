const robot = document.querySelector('#robot');
const stage = document.querySelector('#robot-stage');
const caption = document.querySelector('#action-caption');
const bubble = document.querySelector('#speech-bubble');
const powerStatus = document.querySelector('#power-status');
const statusLight = document.querySelector('#status-light');
const stageHud = document.querySelector('#stage-hud');
const buttons = document.querySelectorAll('.command-button');
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
