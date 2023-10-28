import {Light} from "./objects/light.js";
import {Vector2} from "./vector.js";
import {m4} from "./utils/m4.js";
import * as WebglUtils from "./utils/webgl.js";
import {generateMaze, shuffle, solveMaze, Symbols} from "./maze/maze.js";
import {MazeChamber, MazeSide} from "./maze/chamber.js";
import {MovementControl, SpecialKeys} from "./maze/movement.js";
import {RectObject} from "./objects/rect.js";
import {SpatialTree} from "./utils/tree.js";
import {BoundaryBox} from "./utils/boundary.js";
import {GameStats} from "./maze/stats.js";

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
const pTreeDelta = document.getElementById("tree");
const pPhysics = document.getElementById("physics");
const canvas = document.getElementById("canvas");

const bRect = canvas.getClientRects()[0];
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
        program: "special_fx",
        vs: await fetch("./shaders/special_fx.vert").then(f => f.text()),
        fs: await fetch("./shaders/special_fx.frag").then(f => f.text()),
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

function physics() {
    if (!staticTree) return;

    function _walk(node) {
        if (BoundaryBox.isCollide(node.boundary, player.boundary)) {
            if (node.leafs.length > 0) {
                const result = [];
                for (const leaf of node.leafs) {
                    const res = _walk(leaf)
                    if (res && res.length > 0) {
                        result.push(...res);
                    }
                }

                return result;
            }

            return node.items.filter(item => item.opacity > 0 && BoundaryBox.isCollide(item.boundary, player.boundary));
        }
    }

    const collisions = _walk(staticTree.root) || [];

    function resolveCollision(body1, body2) {
        // Calculate the distance between the centers
        const dx = body2.x - body1.x;
        const dy = body2.y - body1.y;

        const box2 = body2.boundary;

        // Calculate the minimum distance before collision occurs
        const minDistanceX = body1.radius + box2.width / 2;
        const minDistanceY = body1.radius + box2.height / 2;

        // Check if collision is happening
        if (Math.abs(dx) < minDistanceX && Math.abs(dy) < minDistanceY) {
            // Calculate the overlap
            const overlapX = minDistanceX - Math.abs(dx);
            const overlapY = minDistanceY - Math.abs(dy);

            // Determine the side of collision and update velocity accordingly
            if (overlapX < overlapY) {
                if (dx > 0) {
                    body1.impulse.x = -Math.abs(body1.impulse.x);
                } else {
                    body1.impulse.x = Math.abs(body1.impulse.x);
                }

                body1.position.x += overlapX * Math.sign(body1.impulse.x);
                body1.impulse.x = 0.7;
            } else {
                if (dy > 0) {
                    body1.impulse.y = -Math.abs(body1.impulse.y);
                } else {
                    body1.impulse.y = Math.abs(body1.impulse.y);
                }

                body1.position.y += overlapY * Math.sign(body1.impulse.y);
                body1.impulse.y *= 0.7;
            }
        }
    }

    for (const collision of collisions) {
        resolveCollision(player.object, collision);
    }
}

function move(delta) {
    Movement.moveHandler(null, delta);

    const collisions = new Set();
    for (const light of Lights) {
        if (light === player || light.ignore) continue;

        const distance = player.position.delta(light.object.position).length();
        const collDistance = player.object.radius + light.object.radius
        if (distance < collDistance) {
            collisions.add(light);
            player.color = light.color;
        }
    }

    for (const collision of collisions) {
        const lIndex = Lights.indexOf(collision);
        Lights.splice(lIndex, 1);

        const oIndex = Objects.indexOf(collision.object);
        Objects.splice(oIndex, 1);

        Stats.lights -= 1;
        Stats.score += Math.pow(Stats.health, 2) / 100;
        Stats.health = Math.min(100, Stats.health + 50);

        if (collision.finish) {
            count += 2;
            setTimeout(regenerateMaze, 0);
        }
    }

    if (Movement.specialKeys & SpecialKeys.Hint) {
        Movement.specialKeys &= ~SpecialKeys.Hint;

        if (Stats.health >= 20) {
            const hint = new Light(player.x, player.y);
            hint.object = new RectObject(player.x, player.y, 20, 20);
            hint.object.castShadows = false;
            hint.color = player.color;
            hint.ignore = true;

            Lights.push(hint);
            Objects.push(hint.object);

            Stats.health = Math.max(0, Stats.health - 20);
        }
    }
}

let staticTree;

function render(time) {
    const delta = Math.min(0.1, (time - lastTime) / 1000);
    pFps.textContent = Math.ceil(1 / delta).toString();
    lastTime = time;

    const t = performance.now();

    move(delta);
    physics(delta);

    Stats.health = Math.max(0, Stats.health - delta * 100 / 60);
    player.intensity = 0.6 * Stats.health / 100;
    player.object.radius = 10 + 20 * Stats.health / 100;

    pPhysics.textContent = (performance.now() - t).toFixed(2);

    const scale = 1.6 / devicePixelRatio;
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


    const tTree = performance.now();

    if (!staticTree) staticTree = new SpatialTree(Objects.filter(o => o instanceof RectObject), 2, 16);
    const dynamicTree = new SpatialTree(Lights.map(l => l.object), 2, 64);
    const lightsTree = new SpatialTree(Lights, 2, 64);

    pTreeDelta.textContent = (performance.now() - tTree).toFixed(2);

    const invProj = m4.inverse(projMatrix);
    const leftTop = m4.transformPoint({x: -1, y: 1, z: 0}, invProj);
    const rightBottom = m4.transformPoint({x: 1, y: -1, z: 0}, invProj);

    const projWidth = rightBottom[0] - leftTop[0];
    const projHeight = rightBottom[1] - leftTop[1];

    const clipBoundary = new BoundaryBox(
        leftTop[0] - projWidth * 0.3, rightBottom[0] + projWidth * 0.3,
        leftTop[1] - projHeight * 0.3, rightBottom[1] + projHeight * 0.3
    );
    const lightClipBoundary = new BoundaryBox(
        leftTop[0] - projWidth, rightBottom[0] + projWidth,
        leftTop[1] - projHeight, rightBottom[1] + projHeight
    );

    const lights = lightsTree.getSegmentBodies(lightClipBoundary).filter(l => l.intensity > 0);
    const staticObjects = staticTree.getSegmentBodies(clipBoundary).filter(o => o.opacity > 0);
    const dynObjects = dynamicTree.getSegmentBodies(clipBoundary).filter(o => o.opacity > 0);
    const objects = staticObjects.concat(dynObjects);

    gl.clearColor(0, 0, 0, 1);
    gl.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);

    gl.bindFramebuffer(GL.FRAMEBUFFER, glConfig["special_fx"].frameBuffers["fb_0"]);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT | GL.STENCIL_BUFFER_BIT);

    renderLights(objects, lights);
    renderBodies(objects);

    gl.bindFramebuffer(GL.FRAMEBUFFER, null);
    gl.useProgram(glConfig["special_fx"].program);
    gl.bindTexture(GL.TEXTURE_2D, glConfig["special_fx"].textures["texture_0"]);

    renderFx();

    gl.bindTexture(GL.TEXTURE_2D, null);

    pDelta.textContent = (performance.now() - t).toFixed(2);

    requestAnimationFrame(render);
}

function renderBodies(objects) {
    const objData = prepareObjectsData(objects.filter(o => o.opacity > 0));

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

function renderLights(objects, lights) {
    gl.enable(gl.STENCIL_TEST);
    gl.blendFunc(gl.ONE, gl.ONE);

    const lightData = prepareLightData(
        objects.filter(obj => obj.castShadows && obj.opacity !== 0));

    for (const light of lights) {
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
        program: "special_fx",
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

    gl.useProgram(glConfig["special_fx"].program);
    gl.bindVertexArray(glConfig["special_fx"].vertexArrays["body"]);
    gl.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, glConfig["special_fx"].buffers["indexed"]);
    gl.drawElements(GL.TRIANGLES, maskData.indexes.length, GL.UNSIGNED_SHORT, 0);
}

requestAnimationFrame(render);


const player = new Light(0, 0, "#ff5100", 0.4, 600);
player.object.radius = 30;

const Movement = new MovementControl(player.object, canvas);
Movement.setup();

const Stats = new GameStats();

const worldCenter = new Vector2(canvas.width / 2, canvas.height / 2);
let count = 5;

async function regenerateMaze() {
    staticTree = null;
    Lights.splice(0);
    Objects.splice(0);

    Lights.push(player);
    Objects.push(player.object);

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
                light.finish = true;

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
                "#5e26ea",
                "#ea266b",
                "#26a5ea",
                "#26ea6b",
                "#b9ea26",
            ][Math.floor(Math.random() * 4)];

            const light = new Light(worldPos.x, worldPos.y, color, 0.3, 300);
            light.object.radius = 20;

            Lights.push(light);
            Objects.push(light.object);
        }
    }

    Stats.health = 100;
    Stats.count = count;
    Stats.lights = hintCount + 1;
}


await regenerateMaze();
