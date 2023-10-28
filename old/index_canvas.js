import {Vector2} from "./vector.js";

const pFps = document.getElementById("fps");
const pDelta = document.getElementById("delta");
const canvas = document.getElementById("canvas");

const bRect = canvas.getBoundingClientRect();
canvas.width = bRect.width * devicePixelRatio;
canvas.height = bRect.height * devicePixelRatio;

const shadowScale = 1;
const auxCanvas = new OffscreenCanvas(canvas.width * shadowScale, canvas.height * shadowScale);

const ctx = canvas.getContext("2d");
const aCtx = auxCanvas.getContext("2d");

const objs = [
    {x: 100, y: 100, w: 50, h: 50},
    {x: 400, y: 100, w: 50, h: 50},
    {x: 600, y: 400, w: 50, h: 50},
    {x: 200, y: 500, w: 50, h: 50},

    {x: 380, y: 400, w: 10, h: 20},
    {x: 400, y: 400, w: 10, h: 20},
    {x: 420, y: 400, w: 10, h: 20},
    {x: 440, y: 400, w: 10, h: 20},
    {x: 460, y: 400, w: 10, h: 20},
    {x: 480, y: 400, w: 10, h: 20},

    {x: 500, y: 500, w: 20, h: 100},
    {x: 520, y: 580, w: 100, h: 20},
    {x: 620, y: 500, w: 20, h: 100},
]

const lightRadius = 400;
const defaultIntensity = 0.8;

const lights = [
    {x: 420, y: 250, color: "red", intensity: defaultIntensity},
    {x: 800, y: 200, color: "green", intensity: defaultIntensity},
    {x: 100, y: 600, color: "blue", intensity: defaultIntensity},
    {x: 400, y: 800, color: "cyan", intensity: defaultIntensity},
    {x: 200, y: 100, color: "magenta", intensity: defaultIntensity},
    {x: 800, y: 600, color: "yellow", intensity: defaultIntensity},
]

ctx.scale(devicePixelRatio, devicePixelRatio);
aCtx.scale(devicePixelRatio * shadowScale, devicePixelRatio * shadowScale);

function renderBodies() {
    ctx.fillStyle = "#131313";

    for (const {x, y, w, h} of objs) {
        ctx.fillRect(x, y, w, h);
    }

    for (const {x, y, color} of lights) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fill();
    }
}

function renderLights() {
    for (const {x, y, color, intensity} of lights) {
        const origin = new Vector2(x, y);

        aCtx.globalCompositeOperation = "source-over";
        aCtx.globalAlpha = intensity;
        aCtx.clearRect(0, 0, canvas.width, canvas.height);

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, lightRadius);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, "transparent");

        aCtx.fillStyle = gradient;

        aCtx.beginPath();
        aCtx.arc(x, y, lightRadius, 0, Math.PI * 2);
        aCtx.fill()

        // TODO: Wrong silhouette with group of bodies
        // aCtx.strokeStyle = gradient;
        // aCtx.lineWidth = 4;
        // for (const obj of objs) {
        //     aCtx.strokeRect(obj.x, obj.y, obj.w, obj.h);
        // }

        aCtx.globalAlpha = 1;
        aCtx.globalCompositeOperation = "destination-out";
        aCtx.fillStyle = "black";
        for (const obj of objs) {
            aCtx.fillRect(obj.x, obj.y, obj.w, obj.h);

            const vertices = [
                [obj.x, obj.y],
                [obj.x + obj.w, obj.y],
                [obj.x + obj.w, obj.y + obj.h],
                [obj.x, obj.y + obj.h],
            ].map(([vx, vy]) => new Vector2(vx, vy));

            const eVertices = vertices.map(
                vert => vert.delta(origin).normalize().scale(lightRadius * 1.1).add(origin)
            );

            const segments = [];
            for (let i = 0; i < vertices.length; i++) {
                segments.push([
                    vertices[i],
                    vertices[(i + 1) % vertices.length],
                    eVertices[(i + 1) % vertices.length],
                    eVertices[i],
                ])
            }

            for (const segment of segments) {
                aCtx.beginPath();
                for (let i = 0; i < segment.length; i++) {
                    const s = segment[i];

                    if (i === 0) {
                        aCtx.moveTo(s.x, s.y);
                    } else {
                        aCtx.lineTo(s.x, s.y);
                    }
                }

                aCtx.fill();
            }
        }

        ctx.save();

        ctx.globalCompositeOperation = "screen";
        ctx.scale(1 / devicePixelRatio, 1 / devicePixelRatio);
        ctx.drawImage(auxCanvas, 0, 0, canvas.width, canvas.height);
        ctx.restore();
    }
}

let lastTime = 0;

function render(time) {
    const delta = Math.min(0.1, (time - lastTime) / 1000);
    pFps.textContent = Math.ceil(1 / delta).toString();
    lastTime = time;

    const t = performance.now();

    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    renderLights();
    renderBodies();

    for (let i = 0; i < lights.length; i++) {
        if (!("_direction" in lights[i])) {
            const dir = i % 2 === 0 ? 1 : -1;
            lights[i]._direction = {x: dir, y: dir};
        }

        lights[i].x += 15 * lights[i]._direction.x * delta;
        lights[i].y += 15 * lights[i]._direction.y * delta;

        if (lights[i].x <= 0) lights[i]._direction.x = 1;
        else if (lights[i].x >= bRect.width) lights[i]._direction.x = -1;

        if (lights[i].y <= 0) lights[i]._direction.y = 1;
        else if (lights[i].y >= bRect.height) lights[i]._direction.y = -1;
    }

    pDelta.textContent = Math.ceil((performance.now() - t)).toString();

    requestAnimationFrame(render);
}

render(0);