(function () {
    'use strict';

    var canvas = document.getElementById('gameCanvas');
    var ctx = canvas.getContext('2d');
    var scoreElement = document.getElementById('score');
    var bestElement = document.getElementById('best');
    var levelElement = document.getElementById('level');
    var livesElement = document.getElementById('lives');
    var overlay = document.getElementById('startOverlay');
    var overlayTitle = document.getElementById('overlayTitle');
    var overlayText = document.getElementById('overlayText');
    var startButton = document.getElementById('startButton');
    var soundButton = document.getElementById('soundButton');
    var leftButton = document.getElementById('leftButton');
    var rightButton = document.getElementById('rightButton');
    var dropButton = document.getElementById('dropButton');

    var WIDTH = canvas.width;
    var HEIGHT = canvas.height;
    var LANE_CENTERS = [120, 360, 600];
    var SHAPES = [
        {name: 'circle', color: '#ff5c8a'},
        {name: 'triangle', color: '#ffd447'},
        {name: 'square', color: '#4cc9f0'}
    ];

    var state = {
        running: false,
        score: 0,
        best: readBest(),
        level: 1,
        lives: 3,
        streak: 0,
        sorted: 0,
        lane: 1,
        shape: 0,
        nextShape: 1,
        y: 92,
        dropping: false,
        lastTime: 0,
        flash: 0,
        flashColor: '#ffffff',
        shake: 0,
        particles: [],
        stacks: [0, 0, 0],
        sound: true
    };

    var audioContext = null;
    var pointerStartX = null;

    bestElement.textContent = state.best;
    draw();

    function readBest() {
        try {
            return parseInt(window.localStorage.getItem('shapeStackBest'), 10) || 0;
        } catch (error) {
            return 0;
        }
    }

    function saveBest() {
        try {
            window.localStorage.setItem('shapeStackBest', String(state.best));
        } catch (error) {
            // The game still works when storage is unavailable.
        }
    }

    function resetGame() {
        state.running = true;
        state.score = 0;
        state.level = 1;
        state.lives = 3;
        state.streak = 0;
        state.sorted = 0;
        state.lane = 1;
        state.shape = randomShape(-1);
        state.nextShape = randomShape(state.shape);
        state.y = 92;
        state.dropping = false;
        state.lastTime = performance.now();
        state.flash = 0;
        state.shake = 0;
        state.particles = [];
        state.stacks = [0, 0, 0];
        updateScoreboard();
        overlay.hidden = true;
        requestAnimationFrame(gameLoop);
    }

    function randomShape(previous) {
        var result = Math.floor(Math.random() * SHAPES.length);
        if (result === previous && Math.random() < 0.65) {
            result = (result + 1 + Math.floor(Math.random() * 2)) % SHAPES.length;
        }
        return result;
    }

    function gameLoop(timestamp) {
        if (!state.running) {
            return;
        }

        var delta = Math.min((timestamp - state.lastTime) / 1000, 0.05);
        state.lastTime = timestamp;
        update(delta);
        draw();
        requestAnimationFrame(gameLoop);
    }

    function update(delta) {
        var speed = state.dropping ? 1250 : 105 + (state.level - 1) * 18;
        state.y += speed * delta;

        if (state.flash > 0) {
            state.flash = Math.max(0, state.flash - delta);
        }
        if (state.shake > 0) {
            state.shake = Math.max(0, state.shake - delta);
        }

        updateParticles(delta);

        if (state.y >= landingY()) {
            state.y = landingY();
            resolveShape();
        }
    }

    function landingY() {
        return 604 - Math.min(state.stacks[state.lane], 5) * 8;
    }

    function resolveShape() {
        var correct = state.lane === state.shape;

        if (correct) {
            state.streak += 1;
            state.sorted += 1;
            state.stacks[state.lane] = (state.stacks[state.lane] + 1) % 7;
            state.level = 1 + Math.floor(state.sorted / 8);
            state.score += 10 * state.level + Math.min(state.streak - 1, 5) * 2;
            state.flashColor = SHAPES[state.shape].color;
            state.flash = 0.2;
            burst(LANE_CENTERS[state.lane], 620, SHAPES[state.shape].color, 18);
            tone(480 + state.streak * 22, 0.07, 'sine');
        } else {
            state.lives -= 1;
            state.streak = 0;
            state.flashColor = '#ff416c';
            state.flash = 0.28;
            state.shake = 0.3;
            burst(LANE_CENTERS[state.lane], 620, '#ff416c', 12);
            tone(150, 0.16, 'sawtooth');
        }

        if (state.score > state.best) {
            state.best = state.score;
            saveBest();
        }
        updateScoreboard();

        if (state.lives <= 0) {
            endGame();
            return;
        }

        state.shape = state.nextShape;
        state.nextShape = randomShape(state.shape);
        state.y = 92;
        state.dropping = false;
    }

    function endGame() {
        state.running = false;
        draw();
        overlayTitle.textContent = 'Stack complete!';
        overlayText.textContent = 'You sorted ' + state.sorted + ' shape' + (state.sorted === 1 ? '' : 's') + ' and scored ' + state.score + ' points.';
        startButton.textContent = 'Play again';
        overlay.hidden = false;
    }

    function move(direction) {
        if (!state.running || state.dropping) {
            return;
        }
        var nextLane = Math.max(0, Math.min(2, state.lane + direction));
        if (nextLane !== state.lane) {
            state.lane = nextLane;
            tone(260 + nextLane * 35, 0.025, 'square', 0.025);
        }
    }

    function drop() {
        if (!state.running || state.dropping) {
            return;
        }
        state.dropping = true;
        tone(330, 0.035, 'triangle', 0.035);
    }

    function updateScoreboard() {
        scoreElement.textContent = state.score;
        bestElement.textContent = state.best;
        levelElement.textContent = state.level;
        livesElement.textContent = repeatSymbol('\u25cf', state.lives) || '\u2014';
        livesElement.setAttribute('aria-label', state.lives + (state.lives === 1 ? ' life' : ' lives'));
    }

    function repeatSymbol(symbol, count) {
        var result = [];
        var i;
        for (i = 0; i < count; i += 1) {
            result.push(symbol);
        }
        return result.join(' ');
    }

    function draw() {
        ctx.clearRect(0, 0, WIDTH, HEIGHT);
        ctx.save();

        if (state.shake > 0) {
            ctx.translate((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 8);
        }

        drawBackground();
        drawBins();
        drawStacks();
        drawNextShape();

        if (state.running) {
            drawShape(ctx, SHAPES[state.shape].name, LANE_CENTERS[state.lane], state.y, 46, SHAPES[state.shape].color, true);
            drawGuide();
        }

        drawParticles();

        if (state.flash > 0) {
            ctx.fillStyle = rgba(state.flashColor, state.flash * 0.28);
            ctx.fillRect(0, 0, WIDTH, HEIGHT);
        }
        ctx.restore();
    }

    function drawBackground() {
        var gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
        gradient.addColorStop(0, '#202a4c');
        gradient.addColorStop(0.72, '#11172b');
        gradient.addColorStop(1, '#0b1020');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        ctx.strokeStyle = 'rgba(255,255,255,0.055)';
        ctx.lineWidth = 2;
        ctx.setLineDash([7, 12]);
        ctx.beginPath();
        ctx.moveTo(240, 72);
        ctx.lineTo(240, 710);
        ctx.moveTo(480, 72);
        ctx.lineTo(480, 710);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('MATCH THE SHAPE', WIDTH / 2, 45);
    }

    function drawBins() {
        var i;
        for (i = 0; i < 3; i += 1) {
            var x = LANE_CENTERS[i];
            var active = state.running && state.lane === i;
            ctx.fillStyle = active ? 'rgba(255,255,255,0.11)' : 'rgba(255,255,255,0.055)';
            roundedRect(ctx, x - 94, 625, 188, 122, 20);
            ctx.fill();
            ctx.strokeStyle = active ? SHAPES[i].color : 'rgba(255,255,255,0.12)';
            ctx.lineWidth = active ? 5 : 3;
            ctx.stroke();

            drawShape(ctx, SHAPES[i].name, x, 701, 25, SHAPES[i].color, false);
            ctx.fillStyle = '#f7f8ff';
            ctx.font = 'bold 17px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(SHAPES[i].name.toUpperCase(), x, 736);
        }
    }

    function drawStacks() {
        var lane;
        var item;
        for (lane = 0; lane < 3; lane += 1) {
            for (item = 0; item < state.stacks[lane]; item += 1) {
                drawShape(
                    ctx,
                    SHAPES[lane].name,
                    LANE_CENTERS[lane],
                    608 - item * 23,
                    17,
                    SHAPES[lane].color,
                    true
                );
            }
        }
    }

    function drawNextShape() {
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        roundedRect(ctx, 574, 22, 124, 74, 15);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.62)';
        ctx.font = 'bold 13px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('NEXT', 589, 50);
        drawShape(ctx, SHAPES[state.nextShape].name, 665, 59, 20, SHAPES[state.nextShape].color, false);
    }

    function drawGuide() {
        ctx.strokeStyle = rgba(SHAPES[state.shape].color, 0.2);
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 10]);
        ctx.beginPath();
        ctx.moveTo(LANE_CENTERS[state.lane], state.y + 53);
        ctx.lineTo(LANE_CENTERS[state.lane], 548);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    function drawShape(context, name, x, y, size, color, shadow) {
        context.save();
        if (shadow) {
            context.shadowColor = 'rgba(0,0,0,0.38)';
            context.shadowBlur = 16;
            context.shadowOffsetY = 8;
        }
        context.fillStyle = color;
        context.strokeStyle = 'rgba(255,255,255,0.42)';
        context.lineWidth = Math.max(2, size * 0.07);
        context.beginPath();

        if (name === 'circle') {
            context.arc(x, y, size, 0, Math.PI * 2);
        } else if (name === 'triangle') {
            context.moveTo(x, y - size);
            context.lineTo(x + size * 0.96, y + size * 0.78);
            context.lineTo(x - size * 0.96, y + size * 0.78);
            context.closePath();
        } else {
            roundedRect(context, x - size, y - size, size * 2, size * 2, size * 0.2);
        }

        context.fill();
        context.shadowColor = 'transparent';
        context.stroke();
        context.restore();
    }

    function roundedRect(context, x, y, width, height, radius) {
        var r = Math.min(radius, width / 2, height / 2);
        context.beginPath();
        context.moveTo(x + r, y);
        context.arcTo(x + width, y, x + width, y + height, r);
        context.arcTo(x + width, y + height, x, y + height, r);
        context.arcTo(x, y + height, x, y, r);
        context.arcTo(x, y, x + width, y, r);
        context.closePath();
    }

    function burst(x, y, color, amount) {
        var i;
        for (i = 0; i < amount; i += 1) {
            state.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 320,
                vy: -80 - Math.random() * 240,
                life: 0.55 + Math.random() * 0.35,
                maxLife: 0.9,
                size: 4 + Math.random() * 7,
                color: color
            });
        }
    }

    function updateParticles(delta) {
        var i;
        for (i = state.particles.length - 1; i >= 0; i -= 1) {
            state.particles[i].life -= delta;
            state.particles[i].x += state.particles[i].vx * delta;
            state.particles[i].y += state.particles[i].vy * delta;
            state.particles[i].vy += 470 * delta;
            if (state.particles[i].life <= 0) {
                state.particles.splice(i, 1);
            }
        }
    }

    function drawParticles() {
        var i;
        for (i = 0; i < state.particles.length; i += 1) {
            var particle = state.particles[i];
            ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
            ctx.fillStyle = particle.color;
            ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
        }
        ctx.globalAlpha = 1;
    }

    function rgba(hex, alpha) {
        var value = hex.replace('#', '');
        var red = parseInt(value.substring(0, 2), 16);
        var green = parseInt(value.substring(2, 4), 16);
        var blue = parseInt(value.substring(4, 6), 16);
        return 'rgba(' + red + ',' + green + ',' + blue + ',' + alpha + ')';
    }

    function tone(frequency, duration, type, volume) {
        if (!state.sound || !window.AudioContext && !window.webkitAudioContext) {
            return;
        }
        try {
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            var oscillator = audioContext.createOscillator();
            var gain = audioContext.createGain();
            var now = audioContext.currentTime;
            oscillator.type = type || 'sine';
            oscillator.frequency.setValueAtTime(frequency, now);
            gain.gain.setValueAtTime(volume || 0.045, now);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
            oscillator.connect(gain);
            gain.connect(audioContext.destination);
            oscillator.start(now);
            oscillator.stop(now + duration);
        } catch (error) {
            state.sound = false;
            updateSoundButton();
        }
    }

    function updateSoundButton() {
        soundButton.textContent = state.sound ? 'Sound on' : 'Sound off';
        soundButton.setAttribute('aria-pressed', state.sound ? 'true' : 'false');
        soundButton.setAttribute('aria-label', state.sound ? 'Turn sound off' : 'Turn sound on');
    }

    function bindControl(button, action) {
        button.addEventListener('pointerdown', function (event) {
            event.preventDefault();
            button.classList.add('is-pressed');
            action();
        });
        button.addEventListener('pointerup', function () {
            button.classList.remove('is-pressed');
        });
        button.addEventListener('pointercancel', function () {
            button.classList.remove('is-pressed');
        });
        button.addEventListener('pointerleave', function () {
            button.classList.remove('is-pressed');
        });
    }

    startButton.addEventListener('click', function () {
        startButton.textContent = 'Start game';
        resetGame();
    });

    soundButton.addEventListener('click', function () {
        state.sound = !state.sound;
        updateSoundButton();
        if (state.sound) {
            tone(440, 0.06, 'sine');
        }
    });

    bindControl(leftButton, function () { move(-1); });
    bindControl(rightButton, function () { move(1); });
    bindControl(dropButton, drop);

    window.addEventListener('keydown', function (event) {
        var key = event.key.toLowerCase();
        if (key === 'arrowleft' || key === 'a') {
            event.preventDefault();
            move(-1);
        } else if (key === 'arrowright' || key === 'd') {
            event.preventDefault();
            move(1);
        } else if (key === 'arrowdown' || key === 's' || key === ' ' || key === 'enter') {
            event.preventDefault();
            if (state.running) {
                drop();
            } else {
                resetGame();
            }
        }
    });

    canvas.addEventListener('pointerdown', function (event) {
        pointerStartX = event.clientX;
    });

    canvas.addEventListener('pointerup', function (event) {
        if (!state.running || pointerStartX === null) {
            return;
        }
        var distance = event.clientX - pointerStartX;
        var bounds = canvas.getBoundingClientRect();
        var x = event.clientX - bounds.left;
        pointerStartX = null;

        if (Math.abs(distance) > 35) {
            move(distance > 0 ? 1 : -1);
        } else {
            var tappedLane = Math.max(0, Math.min(2, Math.floor(x / (bounds.width / 3))));
            if (tappedLane === state.lane) {
                drop();
            } else {
                state.lane = tappedLane;
            }
        }
    });

    canvas.addEventListener('pointercancel', function () {
        pointerStartX = null;
    });

    document.addEventListener('visibilitychange', function () {
        if (!document.hidden && state.running) {
            state.lastTime = performance.now();
        }
    });
}());
