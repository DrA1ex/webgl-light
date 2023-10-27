import {MazeSide} from "./chamber.js";
import {Vector2} from "../vector.js";

export const Symbols = {
    start: "*",
    finish: "+",
    wall: "#",
}

export function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (0 !== currentIndex) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }

    return array;
}

export function generateMaze(width, height) {
    if (width < 2 || height < 2) {
        throw new Error("Maze is too small");
    }

    const map = new Array(width);
    for (let i = 0; i < map.length; i++) {
        map[i] = new Array(height);
        map[i].fill(Symbols.wall);
    }

    const seen = new Array(width);
    for (let i = 0; i < seen.length; i++) {
        seen[i] = new Array(height);
        seen[i].fill(false);
    }

    const stack = [];

    function storeNode(x, y, char) {
        stack.push(new Vector2(x, y));
        seen[x][y] = true;
        map[x][y] = char;
    }

    const start = new Vector2(Math.floor(Math.random() * width), Math.floor(Math.random() * height));
    storeNode(start.x, start.y, Symbols.start);

    let finish;
    do {
        finish = new Vector2(Math.floor(Math.random() * width), Math.floor(Math.random() * height));
    } while (seen[finish.x][finish.y] === true);

    while (stack.length > 0) {
        const index = Math.floor(stack.length * (2 / 3) + Math.random() * stack.length / 3);
        const [{x, y}] = stack.splice(index, 1);

        const neighbors = [
            x > 0 && [x - 1, y, MazeSide.right],
            x + 1 < width && [x + 1, y, MazeSide.left],
            y > 0 && [x, y - 1, MazeSide.bottom],
            y + 1 < height && [x, y + 1, MazeSide.top],
        ]

        shuffle(neighbors);

        let cnt = 0;
        for (let i = 0; i < neighbors.length && cnt < 2; i++) {
            const neighbor = neighbors[i];
            if (neighbor === false) continue;

            const [nx, ny, direction] = neighbor;
            if (!seen[nx][ny]) {
                storeNode(nx, ny, direction)
                cnt++;
            }
        }
    }

    return {map, start, finish};
}

export async function solveMaze(map, start, finish, cb) {
    const width = map.length;
    const height = map[0].length;

    const seen = new Array(height);
    for (let i = 0; i < seen.length; i++) {
        seen[i] = new Array(width);
        seen[i].fill(false);
    }

    const stack = [start];

    let found = null;
    const path = new Map();
    while (stack.length > 0) {
        const pos = stack.pop();
        if (cb) await cb(pos);

        const neighbors = [
            pos.x > 0 && [pos.x - 1, pos.y, MazeSide.right],
            pos.x + 1 < width && [pos.x + 1, pos.y, MazeSide.left],
            pos.y > 0 && [pos.x, pos.y - 1, MazeSide.bottom],
            pos.y + 1 < height && [pos.x, pos.y + 1, MazeSide.top],
        ]

        for (let i = 0; i < neighbors.length; i++) {
            const neighbor = neighbors[i];
            if (neighbor === false) continue;
            if (pos.x === finish.x && pos.y === finish.y) {
                found = pos;
                stack.splice(0, stack.length);
                break;
            }

            const [nx, ny, direction] = neighbor;
            if (!seen[nx][ny] && map[nx][ny] === direction) {
                seen[nx][ny] = true;

                const dst = new Vector2(nx, ny);
                stack.unshift(dst);
                path.set(dst, pos);
            }
        }
    }

    if (found) {
        const pathLst = [];

        let point = found;
        while (point) {
            pathLst.push(point);
            point = path.get(point);
        }

        return pathLst.reverse();
    }

    return null;
}