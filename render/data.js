function _sum(collection, fn) { return collection.reduce((p, c) => p + fn(c), 0); }

export function prepareObjectsData(objects) {
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

export function prepareLightData(objects) {
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