import {BoundaryBox} from "./utils/boundary.js";

export function step(player, tree) {
    if (!tree) return;

    const collisions = _walkTree(player, tree.root) || [];

    for (const collision of collisions) {
        resolveCollision(player.object, collision);
    }
}

function _walkTree(player, node) {
    if (BoundaryBox.isCollide(node.boundary, player.boundary)) {
        if (node.leafs.length > 0) {
            const result = [];
            for (const leaf of node.leafs) {
                const res = _walkTree(player, leaf)
                if (res && res.length > 0) {
                    result.push(...res);
                }
            }

            return result;
        }

        return node.items.filter(item => item.opacity > 0 && BoundaryBox.isCollide(item.boundary, player.boundary));
    }
}

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