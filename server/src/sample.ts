import cv, { Vec3 } from 'opencv4nodejs';
import { OperatorFunction } from 'rxjs';
import { map, publish, refCount, tap, withLatestFrom } from 'rxjs/operators';

import { configMap } from './settings';

const samplePoints$ = configMap(({ interpolate, samplePoints, capture: { size } }) => ({ samplePoints, size, interpolate }))
    .pipe(
        map(({ samplePoints, size: { width, height }, interpolate }) => ({
            samplePoints: samplePoints.map(p => ({
                x: Math.round(p.x / 100 * width),
                y: Math.round(p.y / 100 * height),
            })),
            buffer: new Uint8Array(samplePoints.length * 3),
            interpolate,
        })),
        tap(({ samplePoints, interpolate }) => console.log(`using ${samplePoints.length} sample points; interpolate: ${interpolate ?? false}`))
    );

export function sampleFrame(): OperatorFunction<cv.Mat, Uint8Array> {
    return source => source.pipe(
        withLatestFrom(samplePoints$),
        map(([frame, { samplePoints, buffer, interpolate }]) => {
            if (interpolate) {
                for (let i = 0; i < samplePoints.length; i++) {
                    const prev = i === 0 ? samplePoints[samplePoints.length - 1] : samplePoints[i - 1]
                    const current = samplePoints[i];
                    const next = i === samplePoints.length - 1 ? samplePoints[0] : samplePoints[i + 1];

                    const { x: prevx, y: prevy, z: prevz } = frame.at(prev.y, prev.x) as any as Vec3;
                    const { x: currentx, y: currenty, z: currentz } = frame.at(current.y, current.x) as any as Vec3;
                    const { x: nextx, y: nexty, z: nextz } = frame.at(next.y, next.x) as any as Vec3;

                    buffer[i / 2 * 3 + 0] = prevz * .25 + currentz * .5 + nextz * .25;
                    buffer[i / 2 * 3 + 1] = prevy * .25 + currenty * .5 + nexty * .25;
                    buffer[i / 2 * 3 + 2] = prevx * .25 + currentx * .5 + nextx * .25;
                }
            } else {
                for (let i = 0; i < samplePoints.length; i++) {
                    const { x: px, y: py } = samplePoints[i];
                    const { x, y, z } = frame.at(py, px) as any as Vec3;
                    buffer[i * 3 + 0] = z;
                    buffer[i * 3 + 1] = y;
                    buffer[i * 3 + 2] = x;
                }
            }

            return buffer;
        }),
        publish(),
        refCount(),
    )
}