import {Vector2} from "./vector.js";

const pFps = document.getElementById("fps");
const pDelta = document.getElementById("delta");
const canvas = document.getElementById("canvas");

const bRect = canvas.getBoundingClientRect();
canvas.width = bRect.width;
canvas.height = bRect.height;

const auxCanvas = new OffscreenCanvas(canvas.width, canvas.height);

const ctx = canvas.getContext("2d", {willReadFrequently: true});
const aCtx = auxCanvas.getContext("2d", {willReadFrequently: true});

const objs = [
    {x: 100, y: 100, w: 50, h: 50},
    {x: 400, y: 100, w: 50, h: 50},
    {x: 600, y: 500, w: 50, h: 50},
    {x: 200, y: 500, w: 50, h: 50},
]

const lightRadius = 400;
const defaultIntensity = 1;

const lights = [
    {x: 400, y: 300, color: "#ff0000", intensity: defaultIntensity},
    {x: 600, y: 300, color: "#00ff00", intensity: defaultIntensity},
    {x: 500, y: 500, color: "#0000ff", intensity: defaultIntensity},
    // {x: 400, y: 800, color: "cyan", intensity: defaultIntensity},
    // {x: 200, y: 100, color: "magenta", intensity: defaultIntensity},
    // {x: 800, y: 600, color: "yellow", intensity: defaultIntensity},
]


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

        const src = aCtx.getImageData(0, 0, canvas.width, canvas.height);
        const dst = ctx.getImageData(0, 0, canvas.width, canvas.height);

        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const offset = (y * canvas.width + x) * 4;

                for (let i = 0; i < 4; i++) {
                    const index = offset + i;
                    dst.data[index] = dst.data[index] + src.data[index];
                }
            }
        }

        ctx.putImageData(dst, 0, 0);
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
    pDelta.textContent = Math.ceil((performance.now() - t)).toString();

    requestAnimationFrame(render);
}

render(0);