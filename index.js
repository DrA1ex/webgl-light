import {Light} from "./objects/light.js";
import {RectObject} from "./objects/rect.js";

import {MazeChamber, MazeSide} from "./maze/chamber.js";
import {generateMaze, shuffle, solveMaze, Symbols} from "./maze/maze.js";
import {MovementControl, SpecialKeys} from "./maze/movement.js";

import {GameStats} from "./maze/stats.js";
import {Renderer} from "./render/renderer.js";
import * as Physics from "./physics.js";

import {Vector2} from "./vector.js";
import {m4} from "./utils/m4.js";
import {SpatialTree} from "./utils/tree.js";
import {BoundaryBox} from "./utils/boundary.js";

const MazeLightColors = [
    "#5e26ea",
    "#ea266b",
    "#26a5ea",
    "#26ea6b",
    "#b9ea26",
]

const Zoom = 1.6;

const HintRadius = 20;
const PlayerRadius = 30;
const FinishRadius = 40;

const HintLightDistanceRadius = 400;
const PlayerLightDistanceRadius = 600;
const FinishLightDistanceRadius = 800;

const HintLightIntensity = 0.4;
const PlayerLightIntensity = 0.4;
const FinishLightIntensity = 0.4;

const HintCost = 50;
const HintHealthCost = 20;

const urlSearchParams = new URLSearchParams(window.location.search);
const queryParams = Object.fromEntries(urlSearchParams.entries());

if (queryParams["stats"] === "1") {
    document.getElementById("stats").style.visibility = "visible";
}

const RenderScale = Number.parseFloat(queryParams["render_scale"] || devicePixelRatio);

const pFps = document.getElementById("fps");
const pDelta = document.getElementById("delta");
const pTreeDelta = document.getElementById("tree");
const pPhysics = document.getElementById("physics");
const pResolution = document.getElementById("resolution");
const canvas = document.getElementById("canvas");

const Render = new Renderer(canvas, RenderScale);
await Render.init();

pResolution.textContent = `${Render.width} x ${Render.height}`;

const player = new Light(0, 0, "#ff5100", PlayerLightIntensity, PlayerLightDistanceRadius);

const Movement = new MovementControl(player.object, canvas);
Movement.setup();

const Stats = new GameStats();
const WorldCenter = new Vector2(canvas.width / 2, canvas.height / 2);
let MazeSize = 5;

const Lights = []
const Objects = []

let lastTime = 0;
let staticTree;

function render(time) {
    const delta = Math.min(0.1, (time - lastTime) / 1000);
    pFps.textContent = Math.ceil(1 / delta).toString();
    lastTime = time;

    const t = performance.now();

    move(delta);
    Physics.step(player, staticTree);

    Stats.health = Math.max(0, Stats.health - delta * 100 / 60);
    player.intensity = PlayerLightIntensity * Stats.health / 100;
    player.object.radius = 10 + (PlayerRadius - 10) * Stats.health / 100;

    pPhysics.textContent = (performance.now() - t).toFixed(2);

    const scale = Zoom / Render.resolutionScale;
    const cameraPosition = player.position.delta(WorldCenter).scale(-1);

    let projMatrix = m4.projection(canvas.width, canvas.height, 2);
    projMatrix = m4.translate(projMatrix, cameraPosition.x, cameraPosition.y, 0);
    projMatrix = m4.inverse(m4.scale(m4.inverse(projMatrix), scale, scale, 1));
    Render.setProjectionMatrix(projMatrix);

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

    Render.render(delta, objects, lights);

    pDelta.textContent = (performance.now() - t).toFixed(2);

    requestAnimationFrame(render);
}

requestAnimationFrame(render);

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
        Stats.health = Math.min(100, Stats.health + HintCost);

        if (collision.finish) {
            MazeSize += 2;
            setTimeout(regenerateMaze, 0);
        }
    }

    if (Movement.specialKeys & SpecialKeys.Hint) {
        Movement.specialKeys &= ~SpecialKeys.Hint;

        if (Stats.health >= HintHealthCost) {
            const hint = new Light(player.x, player.y);
            hint.object = new RectObject(player.x, player.y, 20, 20);
            hint.object.castShadows = false;
            hint.color = player.color;
            hint.ignore = true;

            Lights.push(hint);
            Objects.push(hint.object);

            Stats.health = Math.max(0, Stats.health - HintHealthCost);
        }
    }
}

async function regenerateMaze() {
    staticTree = null;

    Lights.splice(0);
    Objects.splice(0);

    Lights.push(player);
    Objects.push(player.object);

    const minLength = 2 * MazeSize;

    let mazeGenResult;
    let solvedPath;
    do {
        mazeGenResult = generateMaze(MazeSize, MazeSize);
        solvedPath = await solveMaze(mazeGenResult.map, mazeGenResult.start, mazeGenResult.finish);
    } while (solvedPath?.length < minLength);

    const {map: maze, start: mazeStart, finish: mazeFinish} = mazeGenResult;

    const chambers = new Array(MazeSize);
    for (let blockX = 0; blockX < MazeSize; blockX++) {
        chambers[blockX] = new Array(MazeSize);
        for (let blockY = 0; blockY < MazeSize; blockY++) {
            const blockValue = maze[blockX][blockY];
            const worldPos = new Vector2(
                WorldCenter.x + MazeChamber.size * (blockX - MazeSize / 2),
                WorldCenter.y + MazeChamber.size * (blockY - MazeSize / 2)
            );

            const chamber = new MazeChamber(Objects, worldPos.x, worldPos.y);

            if (blockX > 0) chamber.setSide(MazeSide.left, false);
            if (blockY > 0) chamber.setSide(MazeSide.top, false);

            if (blockX === mazeStart.x && blockY === mazeStart.y) {
                player.position.x = worldPos.x;
                player.position.y = worldPos.y;
            } else if (blockX === mazeFinish.x && blockY === mazeFinish.y) {
                const light = new Light(worldPos.x, worldPos.y, "#e905fc");

                light.radius = FinishLightDistanceRadius;
                light.intensity = FinishLightIntensity;
                light.object.radius = FinishRadius;
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
            WorldCenter.x + MazeChamber.size * (point.x - MazeSize / 2),
            WorldCenter.y + MazeChamber.size * (point.y - MazeSize / 2)
        );

        if (hints[i]) {
            const color = MazeLightColors[Math.floor(Math.random() * 4)];

            const light = new Light(worldPos.x, worldPos.y, color, HintLightIntensity);
            light.radius = HintLightDistanceRadius;
            light.object.radius = HintRadius;

            Lights.push(light);
            Objects.push(light.object);
        }
    }

    Stats.health = 100;
    Stats.count = MazeSize;
    Stats.lights = hintCount + 1;
}


await regenerateMaze();
