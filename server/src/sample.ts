import cv, { Vec3 } from 'opencv4nodejs';
import { OperatorFunction } from 'rxjs';
import { map, withLatestFrom } from 'rxjs/operators';

import { configMap } from './settings';

const samplePoints$ = configMap(({ samplePoints, capture: { size } }) => ({ samplePoints, size }))
    .pipe(
        map(({ samplePoints, size: { width, height } }) => ({
            samplePoints: samplePoints.map(p => ({
                x: Math.round(p.x / 100 * width),
                y: Math.round(p.y / 100 * height),
            })),
            buffer: new Uint8Array(samplePoints.length * 3)
        }))
    );

export function sampleFrame(): OperatorFunction<cv.Mat, Uint8Array> {
    return source => source.pipe(
        withLatestFrom(samplePoints$),
        map(([frame, { samplePoints, buffer }]) => {
            for (let i = 0; i < samplePoints.length; i++) {
                const { x: px, y: py } = samplePoints[i];
                const { x, y, z } = frame.at(py, px) as any as Vec3;
                buffer[i * 3 + 0] = z;
                buffer[i * 3 + 1] = y;
                buffer[i * 3 + 2] = x;
            }
            return buffer;
        }),
    )
}