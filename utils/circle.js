import {Vector2} from "../vector.js";

export function generateDiskMesh(cnt) {
    const result = new Float32Array((cnt + 1) * 2);
    result[0] = 0;
    result[1] = 0;

    const step = 2 * Math.PI / cnt;
    for (let i = 1; i <= cnt; i++) {
        const point = Vector2.fromAngle(-step * i);
        result[i * 2] = point.x / 2;
        result[i * 2 + 1] = point.y / 2;
    }

    return result;
}

export function generateDiskIndexed(cnt) {
    const result = new Uint16Array(cnt * 3);
    for (let k = 0; k < cnt; k++) {
        result[k * 3] = 0;
        result[k * 3 + 1] = k % cnt + 1;
        result[k * 3 + 2] = (k + 1) % cnt + 1;
    }

    return result;
}