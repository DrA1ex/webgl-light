import {Light} from "./objects/light.js";
import {Vector2} from "./vector.js";
import {m4} from "./utils/m4.js";
import * as WebglUtils from "./utils/webgl.js";
import {generateMaze, shuffle, solveMaze, Symbols} from "./maze/maze.js";
import {MazeChamber, MazeSide} from "./maze/chamber.js";
import {MovementControl} from "./maze/movement.js";
import {RectObject} from "./objects/rect.js";

function _sum(collection, fn) { return collection.reduce((p, c) => p + fn(c), 0); }

function prepareObjectsData(objects) {
    const indexesCount = _sum(objects, o => o.indexesCount);
    const pointsCount = _sum(objects, o => o.polyPointsCount);

    const indexes = new Uint16Array(indexesCount);
    const points = new Float32Array(pointsCount * 2);
    const positions = new Float32Array(pointsCount * 2);
    const sizes = new Float32Array(pointsCount * 2);
    const colors = new Float32Array(pointsCount * 4);

    let indexOffset = 0;
    let lastIndex = 0;
    let pointOffset = 0;
    let colorOffset = 0;

    for (const obj of objects) {
        const objIndexes = obj.indexes();
        for (let i = 0; i < objIndexes.length; i++) {
            indexes[indexOffset + i] = lastIndex + objIndexes[i];
        }

        lastIndex += obj.polyPointsCount;
        indexOffset += objIndexes.length;

        const objPoints = obj.polyPoints();
        for (let i = 0; i < objPoints.length; i++) {
            points[pointOffset + i] = objPoints[i];
        }

        const objColor = obj.colorComponents;
        for (let i = 0; i < obj.polyPointsCount; i++) {
            sizes[pointOffset + i * 2] = obj.size.x;
            sizes[pointOffset + i * 2 + 1] = obj.size.y;

            positions[pointOffset + i * 2] = obj.position.x;
            positions[pointOffset + i * 2 + 1] = obj.position.y;

            colors[colorOffset + i * 4] = objColor[0]
            colors[colorOffset + i * 4 + 1] = objColor[1]
            colors[colorOffset + i * 4 + 2] = objColor[2]
            colors[colorOffset + i * 4 + 3] = obj.opacity;
        }

        pointOffset += 2 * obj.polyPointsCount;
        colorOffset += 4 * obj.polyPointsCount;
    }

    return {
        indexes,
        points,
        positions,
        sizes,
        colors
    };
}

function prepareLightData(objects) {
    const indexesPerObject = 6;
    const valuesPerPoint = 6;

    const indexesCount = _sum(objects, o => o.pointsCount) * indexesPerObject;
    const pointsCount = _sum(objects, o => o.pointsCount);

    const indexes = new Uint16Array(indexesCount);
    const points = new Float32Array(pointsCount * valuesPerPoint);

    let indexOffset = 0;
    let lastIndex = 0;
    let pointOffset = 0;

    for (const obj of objects) {
        const objPoints = obj.points();
        for (let i = 0; i < obj.pointsCount; i++) {
            const inIndexOffset = i * 2;
            const outIndexOffset = pointOffset + i * valuesPerPoint;

            points[outIndexOffset] = objPoints[inIndexOffset];
            points[outIndexOffset + 1] = objPoints[inIndexOffset + 1];
            points[outIndexOffset + 2] = 0;

            points[outIndexOffset + 3] = objPoints[inIndexOffset];
            points[outIndexOffset + 4] = objPoints[inIndexOffset + 1];
            points[outIndexOffset + 5] = 1;
        }

        pointOffset += obj.pointsCount * valuesPerPoint;

        for (let i = 0; i < obj.pointsCount; i++) {
            const outIndexOffset = indexOffset + i * indexesPerObject;

            const currentPointIndex = lastIndex + i * 2;
            const nextPointIndex = lastIndex + ((i + 1) % obj.pointsCount) * 2;

            indexes[outIndexOffset] = currentPointIndex;
            indexes[outIndexOffset + 1] = nextPointIndex;
            indexes[outIndexOffset + 2] = nextPointIndex + 1;

            indexes[outIndexOffset + 3] = currentPointIndex;
            indexes[outIndexOffset + 4] = nextPointIndex + 1;
            indexes[outIndexOffset + 5] = currentPointIndex + 1;
        }

        lastIndex += obj.pointsCount * 2;
        indexOffset += obj.pointsCount * indexesPerObject;
    }

    return {
        indexes,
        points,
    };
}


const GL = WebGL2RenderingContext;

const pFps = document.getElementById("fps");
const pDelta = document.getElementById("delta");
const canvas = document.getElementById("canvas");

const bRect = canvas.getBoundingClientRect();
canvas.width = bRect.width * devicePixelRatio;
canvas.height = bRect.height * devicePixelRatio;

const Config = [{
    program: "main",
    vs: await fetch("./shaders/body.vert").then(f => f.text()),
    fs: await fetch("./shaders/body.frag").then(f => f.text()),
    attributes: [
        {name: "point"},
        {name: "position"},
        {name: "size"},
        {name: "color"},
    ],
    uniforms: [
        {name: "projection", type: "uniformMatrix4fv"},
    ],
    buffers: [
        {name: "point", usageHint: GL.STATIC_DRAW},
        {name: "position", usageHint: GL.STATIC_DRAW},
        {name: "size", usageHint: GL.STATIC_DRAW},
        {name: "color", usageHint: GL.STATIC_DRAW},

        {name: "indexed", usageHint: GL.STATIC_DRAW, type: GL.ELEMENT_ARRAY_BUFFER},
    ],
    vertexArrays: [{
        name: "body", entries: [
            {name: "point", type: GL.FLOAT, size: 2},
            {name: "position", type: GL.FLOAT, size: 2},
            {name: "size", type: GL.FLOAT, size: 2},
            {name: "color", type: GL.FLOAT, size: 4},
        ]
    }],
}, {
    program: "light",
    vs: await fetch("./shaders/light.vert").then(f => f.text()),
    fs: await fetch("./shaders/light.frag").then(f => f.text()),
    attributes: [
        {name: "point"},
    ],
    uniforms: [
        {name: "projection", type: "uniformMatrix4fv"},
        {name: "light_pos", type: "uniform2f"},
        {name: "light_radius", type: "uniform1f"},
    ],
    buffers: [
        {name: "point", usageHint: GL.DYNAMIC_DRAW},

        {name: "indexed", usageHint: GL.STATIC_DRAW, type: GL.ELEMENT_ARRAY_BUFFER},
    ],
    vertexArrays: [{
        name: "body", entries: [
            {name: "point", type: GL.FLOAT, size: 3},
        ]
    }],
}]

{
    const mainConfig = Config.find(c => c.program === "main");
    Config.push({
        program: "light_overlay",
        vs: await fetch("./shaders/light_overlay.vert").then(f => f.text()),
        fs: await fetch("./shaders/light_overlay.frag").then(f => f.text()),
        attributes: mainConfig.attributes,
        buffers: mainConfig.buffers,
        uniforms: [
            ...mainConfig.uniforms,
            {name: "effect", type: "uniform1ui"},
            {name: "resolution", type: "uniform2f"},
        ],
        vertexArrays: mainConfig.vertexArrays,
        textures: [{
            name: "texture_0",
            width: canvas.width,
            height: canvas.height,
            format: GL.RGBA,
            internalFormat: GL.RGBA,
            type: GL.UNSIGNED_BYTE,
            params: {
                min: GL.NEAREST,
                mag: GL.NEAREST,
                wrapS: GL.CLAMP_TO_EDGE,
                wrapT: GL.CLAMP_TO_EDGE,
            },
            generateMipmap: false
        }, {
            name: "texture_1",
            width: canvas.width,
            height: canvas.height,
            format: GL.RGBA,
            internalFormat: GL.RGBA,
            type: GL.UNSIGNED_BYTE,
            params: {
                min: GL.NEAREST,
                mag: GL.NEAREST,
                wrapS: GL.CLAMP_TO_EDGE,
                wrapT: GL.CLAMP_TO_EDGE,
            },
            generateMipmap: false
        }],
        frameBuffers: [
            {name: "fb_0", texture: "texture_0", attachment: GL.COLOR_ATTACHMENT0, stencil: true},
            {name: "fb_1", texture: "texture_1", attachment: GL.COLOR_ATTACHMENT0, stencil: true},
        ]
    });
}

const projection = m4.projection(bRect.width, bRect.height, 2);
const gl = canvas.getContext("webgl2", {premultipliedAlpha: true, stencil: true});

gl.viewport(0, 0, canvas.width, canvas.height);
gl.clearColor(0, 0, 0, 1);
gl.clear(gl.COLOR_BUFFER_BIT);

gl.enable(gl.BLEND);
gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

gl.enable(gl.DEPTH_TEST);
gl.depthFunc(gl.LEQUAL);

const glConfig = {};
WebglUtils.createFromConfig(gl, Config, glConfig);

WebglUtils.loadDataFromConfig(gl, glConfig, Config.map(s => ({
    program: s.program,
    uniforms: [
        {name: "projection", values: [false, projection]},
    ]
})));

const Lights = []
const Objects = []

let lastTime = 0;

function move(delta) {
    Movement.moveHandler(null, delta);

    const collisions = new Set();
    for (const light of Lights) {
        if (light === player) continue;

        const distance = player.position.delta(light.object.position).length();
        const collDistance = player.object.radius + light.object.radius
        if (distance < collDistance) {
            collisions.add(light);
        }
    }

    for (const collision of collisions) {
        const lIndex = Lights.indexOf(collision);
        Lights.splice(lIndex, 1);

        const oIndex = Objects.indexOf(collision.object);
        Objects.splice(oIndex, 1);
    }
}

function render(time) {
    const delta = Math.min(0.1, (time - lastTime) / 1000);
    pFps.textContent = Math.ceil(1 / delta).toString();
    lastTime = time;

    const t = performance.now();

    move(delta);

    const scale = 0.8;
    const cameraPosition = player.position.delta(worldCenter).scale(-1);

    let projMatrix = m4.projection(canvas.width, canvas.height, 2);
    projMatrix = m4.translate(projMatrix, cameraPosition.x, cameraPosition.y, 0);
    projMatrix = m4.inverse(m4.scale(m4.inverse(projMatrix), scale, scale, 1));
    WebglUtils.loadDataFromConfig(gl, glConfig, Config.map(s => ({
        program: s.program,
        uniforms: [
            {name: "projection", values: [false, projMatrix]},
        ]
    })));

    gl.clearColor(0, 0, 0, 1);
    gl.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);

    gl.bindFramebuffer(GL.FRAMEBUFFER, glConfig["light_overlay"].frameBuffers["fb_0"]);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT | GL.STENCIL_BUFFER_BIT);

    renderLights();
    renderBodies();

    gl.bindFramebuffer(GL.FRAMEBUFFER, null);
    gl.useProgram(glConfig["light_overlay"].program);
    gl.bindTexture(GL.TEXTURE_2D, glConfig["light_overlay"].textures["texture_0"]);

    renderFx();

    gl.bindTexture(GL.TEXTURE_2D, null);

    pDelta.textContent = (performance.now() - t).toFixed(2);

    requestAnimationFrame(render);
}

function renderBodies() {
    const objData = prepareObjectsData(Objects);

    WebglUtils.loadDataFromConfig(gl, glConfig, [{
        program: "main",
        buffers: [
            {name: "point", data: objData.points},
            {name: "position", data: objData.positions},
            {name: "size", data: objData.sizes},
            {name: "color", data: objData.colors},

            {name: "indexed", data: objData.indexes},
        ]
    }]);

    gl.useProgram(glConfig["main"].program);
    gl.bindVertexArray(glConfig["main"].vertexArrays["body"]);
    gl.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, glConfig["main"].buffers["indexed"]);
    gl.drawElements(GL.TRIANGLES, objData.indexes.length, GL.UNSIGNED_SHORT, 0);
}

function renderLights() {
    gl.enable(gl.STENCIL_TEST);
    gl.blendFunc(gl.ONE, gl.ONE);

    const lightData = prepareLightData(
        Objects.filter(obj => obj.castShadows && obj.opacity !== 0));

    for (const light of Lights) {
        renderSingleLight(light, lightData);
    }

    gl.disable(gl.STENCIL_TEST);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
}

function renderSingleLight(light, lightData) {
    gl.clear(GL.STENCIL_BUFFER_BIT);

    gl.colorMask(false, false, false, false);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
    gl.stencilFunc(gl.ALWAYS, 1, 0xff);
    renderLightMask(light, lightData);

    gl.colorMask(true, true, true, true);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    gl.stencilFunc(gl.EQUAL, 0, 0xff);
    renderLightBackground(light);
}

function renderLightMask(light, lightData) {
    gl.useProgram(glConfig["light"].program);
    gl.bindVertexArray(glConfig["light"].vertexArrays["body"]);

    WebglUtils.loadDataFromConfig(gl, glConfig, [{
        program: "light",
        uniforms: [
            {name: "light_pos", values: [light.x, light.y]},
            {name: "light_radius", values: [light.radius]}
        ],
        buffers: [
            {name: "point", data: lightData.points},
            {name: "indexed", data: lightData.indexes},
        ]
    }]);

    gl.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, glConfig["light"].buffers["indexed"]);
    gl.drawElements(GL.TRIANGLES, lightData.indexes.length, GL.UNSIGNED_SHORT, 0);
}

function renderLightBackground(light) {
    const mask = light.mask;
    mask.opacity = 0;
    const maskData = prepareObjectsData([mask]);
    maskData.colors[3] = light.intensity;

    gl.useProgram(glConfig["main"].program);
    gl.bindVertexArray(glConfig["main"].vertexArrays["body"]);

    WebglUtils.loadDataFromConfig(gl, glConfig, [{
        program: "main",
        buffers: [
            {name: "point", data: new Float32Array(maskData.points)},
            {name: "position", data: new Float32Array(maskData.positions)},
            {name: "size", data: new Float32Array(maskData.sizes)},
            {name: "color", data: new Float32Array(maskData.colors)},

            {name: "indexed", data: new Uint16Array(maskData.indexes)},
        ]
    }]);

    gl.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, glConfig["main"].buffers["indexed"]);
    gl.drawElements(GL.TRIANGLES, maskData.indexes.length, GL.UNSIGNED_SHORT, 0);
}

function renderFx() {
    const dummyObj = new RectObject(bRect.width / 2, bRect.height / 2, bRect.width, bRect.height);
    dummyObj.color = "#000000";
    dummyObj.opacity = 0;

    const maskData = prepareObjectsData([dummyObj]);
    WebglUtils.loadDataFromConfig(gl, glConfig, [{
        program: "light_overlay",
        uniforms: [{
            name: "projection",
            values: [false, m4.projection(bRect.width, bRect.height, 2)]
        }, {
            name: "effect",
            values: [1]
        }, {
            name: "resolution",
            values: [canvas.width, canvas.height]
        }],
        buffers: [
            {name: "point", data: new Float32Array(maskData.points)},
            {name: "position", data: new Float32Array(maskData.positions)},
            {name: "size", data: new Float32Array(maskData.sizes)},
            {name: "color", data: new Float32Array(maskData.colors)},

            {name: "indexed", data: new Uint16Array(maskData.indexes)},
        ]
    }]);

    gl.useProgram(glConfig["light_overlay"].program);
    gl.bindVertexArray(glConfig["light_overlay"].vertexArrays["body"]);
    gl.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, glConfig["light_overlay"].buffers["indexed"]);
    gl.drawElements(GL.TRIANGLES, maskData.indexes.length, GL.UNSIGNED_SHORT, 0);
}

requestAnimationFrame(render);


const player = new Light(0, 0, "#ff5100", 0.4, 600);
player.object.radius = 30;
Lights.push(player);
Objects.push(player.object);

const Movement = new MovementControl(player.object, canvas);
Movement.setup();

const worldCenter = new Vector2(canvas.width / 2, canvas.height / 2);
const count = 10;
const minLength = 2 * count;

let mazeGenResult;
let solvedPath;
do {
    mazeGenResult = generateMaze(count, count);
    solvedPath = await solveMaze(mazeGenResult.map, mazeGenResult.start, mazeGenResult.finish);

} while (solvedPath?.length < minLength)

const {map: maze, start: mazeStart, finish: mazeFinish} = mazeGenResult;

const chambers = new Array(count);
for (let blockX = 0; blockX < count; blockX++) {
    chambers[blockX] = new Array(count);
    for (let blockY = 0; blockY < count; blockY++) {
        const blockValue = maze[blockX][blockY];
        const worldPos = new Vector2(
            worldCenter.x + MazeChamber.size * (blockX - count / 2),
            worldCenter.y + MazeChamber.size * (blockY - count / 2)
        );

        const chamber = new MazeChamber(Objects, worldPos.x, worldPos.y);

        if (blockX > 0) chamber.setSide(MazeSide.left, false);
        if (blockY > 0) chamber.setSide(MazeSide.top, false);

        if (blockX === mazeStart.x && blockY === mazeStart.y) {
            player.position.x = worldPos.x;
            player.position.y = worldPos.y;
        } else if (blockX === mazeFinish.x && blockY === mazeFinish.y) {
            const light = new Light(worldPos.x, worldPos.y, "#e905fc");
            light.object.radius = 40;

            Lights.push(light);
            Objects.push(light.object);
        }

        if (blockValue !== Symbols.start) {
            if (blockX > 0 && blockValue === MazeSide.left) {
                chambers[blockX - 1][blockY].setDoor(MazeSide.right, false);
            } else if (blockY > 0 && blockValue === MazeSide.top) {
                chambers[blockX][blockY - 1].setDoor(MazeSide.bottom, false);
            } else {
                chamber.setDoor(blockValue, false);
            }
        }

        chambers[blockX][blockY] = chamber;
    }
}

const effectivePathLength = solvedPath.length - 2;
const hintCount = Math.floor(effectivePathLength * 0.4);
const hints = new Array(hintCount).fill(true)
    .concat(new Array(effectivePathLength - hintCount).fill(false));

shuffle(hints);

// Start and finish
hints.unshift(false);
hints.push(false);

for (let i = 0; i < solvedPath.length; i++) {
    const point = solvedPath[i];
    const worldPos = new Vector2(
        worldCenter.x + MazeChamber.size * (point.x - count / 2),
        worldCenter.y + MazeChamber.size * (point.y - count / 2)
    );

    if (hints[i]) {
        const color = [
            "#5026ea",
            "#ea266b",
            "#2688ea",
            "#26ea81"
        ][Math.floor(Math.random() * 4)];

        const light = new Light(worldPos.x, worldPos.y, color, 0.3, 300);
        light.object.radius = 40;

        Lights.push(light);
        Objects.push(light.object);
    }
}

//
// Lights.splice(0);
// Objects.splice(0);
//
// const defaultIntensity = 0.6;
// Lights.push(...[
//     new Light(400, 300, ColorUtils.rgbToHex(1, 0, 0), defaultIntensity),
//     new Light(600, 300, ColorUtils.rgbToHex(0, 1, 0), defaultIntensity),
//     new Light(500, 500, ColorUtils.rgbToHex(0, 0, 1), defaultIntensity),
//     // new Light(400, 800, ColorUtils.rgbToHex(0, 1, 1), defaultIntensity),
//     // new Light(200, 100, ColorUtils.rgbToHex(1, 0, 1), defaultIntensity),
//     // new Light(800, 600, ColorUtils.rgbToHex(1, 1, 0), defaultIntensity),
// ]);
//
// Objects.push(...[
//     new RectObject(100, 100, 50, 50),
//     new RectObject(400, 100, 50, 50),
//     new RectObject(600, 500, 50, 50),
//     new RectObject(200, 500, 50, 50),
//
//     // new RectObject(380, 400, 10, 20),
//     // new RectObject(400, 400, 10, 20),
//     // new RectObject(420, 400, 10, 20),
//     // new RectObject(440, 400, 10, 20),
//     // new RectObject(460, 400, 10, 20),
//     // new RectObject(480, 400, 10, 20),
//     //
//     // new RectObject(510, 550, 20, 100),
//     // new RectObject(570, 590, 100, 20),
//     // new RectObject(630, 550, 20, 100),
//
//     // new CircleObject(200, 250, 25),
//     // new CircleObject(600, 200, 25),
// ])
//
// for (const obj of Objects) {
//     obj.color = "#232323"
// }
//
// Objects.push(...Lights.map(l => l.object));
