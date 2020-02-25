import cv, { Vec3, Vec } from 'opencv4nodejs';
import express from 'express';
import bodyParser from 'body-parser';
import { isEqual } from 'lodash';
import WebSocket from 'ws';

import { Observable, OperatorFunction, combineLatest } from 'rxjs';
import { map, publishReplay, refCount, first, switchMap, distinctUntilChanged, withLatestFrom, scan, tap } from 'rxjs/operators';
import { config$, updateConfig } from './config';

function getCaptureDevice(): Observable<cv.VideoCapture> {
    return config$.pipe(
        map(({ capture: { size, fps, device } }) => ({ size, fps, device })),
        distinctUntilChanged((a, b) => isEqual(a, b)),
        switchMap(({ size, fps, device }) => new Observable<cv.VideoCapture>(observer => {
            const capture = typeof device === 'string' ?
                new cv.VideoCapture(device) :
                new cv.VideoCapture(device ?? 0);

            capture.set(cv.CAP_PROP_FRAME_WIDTH, size.width);
            capture.set(cv.CAP_PROP_FRAME_HEIGHT, size.height);
            capture.set(cv.CAP_PROP_FPS, fps);
            observer.next(capture);

            return () => capture.release();
        })),
    );
}

function getFrames(): OperatorFunction<cv.VideoCapture, cv.Mat> {
    return source => source.pipe(
        switchMap(device => new Observable<cv.Mat>(observer => {
            let stop = false;

            async function captureFrame() {
                try {
                    const frame = await device.readAsync();
                    if (!frame.empty) observer.next(frame);
                    if (!stop) captureFrame();
                } catch (err) {
                    observer.error(err);
                }
            }

            captureFrame();
            return () => stop = true;
        }))
    );
}

const frames$ = getCaptureDevice()
    .pipe(
        getFrames(),
        publishReplay(1),
        refCount()
    );

const info = config$.pipe(
    map(({ samplePoints, capture: { size } }) => ({ samplePoints, size })),
    distinctUntilChanged((a, b) => isEqual(a, b)),
    map(({ samplePoints, size: { width, height } }) => ({
        samplePoints: samplePoints.map(p => ({
            x: Math.round(p.x / 100 * width),
            y: Math.round(p.y / 100 * height),
        })),
        buffer: new Uint8Array(samplePoints.length * 3)
    }))
);

const ws$ = new Observable<WebSocket>(observer => {
    const ws = new WebSocket('ws://192.168.1.54:81/');
    ws.on('open', () => observer.next(ws));
    ws.on('error', err => observer.error(err));
    ws.on('close', () => observer.complete());
    return () => ws.close();
});

const sampleData$ = combineLatest([frames$, info])
    .pipe(
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
        publishReplay(1),
        refCount(),
    );

function applyCorrection(arr: Uint8Array, offset: number, correction: { a: number, b: number }) {
    let value = arr[offset];
    value = value * correction.a + correction.b;
    if (value < 0) value = 0;
    if (value > 255) value = 255;
    arr[offset] = value;
}

const correction$ = config$.pipe(
    map(c => c.correction),
    distinctUntilChanged((a, b) => isEqual(a, b)),
);

const GAMMA_LUT = [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2,
    2, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 5, 5, 5,
    5, 6, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8, 9, 9, 9, 10,
    10, 10, 11, 11, 11, 12, 12, 13, 13, 13, 14, 14, 15, 15, 16, 16,
    17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22, 23, 24, 24, 25,
    25, 26, 27, 27, 28, 29, 29, 30, 31, 32, 32, 33, 34, 35, 35, 36,
    37, 38, 39, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 50,
    51, 52, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 66, 67, 68,
    69, 70, 72, 73, 74, 75, 77, 78, 79, 81, 82, 83, 85, 86, 87, 89,
    90, 92, 93, 95, 96, 98, 99, 101, 102, 104, 105, 107, 109, 110, 112, 114,
    115, 117, 119, 120, 122, 124, 126, 127, 129, 131, 133, 135, 137, 138, 140, 142,
    144, 146, 148, 150, 152, 154, 156, 158, 160, 162, 164, 167, 169, 171, 173, 175,
    177, 180, 182, 184, 186, 189, 191, 193, 196, 198, 200, 203, 205, 208, 210, 213,
    215, 218, 220, 223, 225, 228, 231, 233, 236, 239, 241, 244, 247, 249, 252, 255
];

const subscription = combineLatest([sampleData$, correction$])
    .pipe(
        map(([data, correction]) => {
            if (correction?.length === data.length) {
                data = data.slice(0);
                for (let i = 0; i < correction.length; i++) {
                    applyCorrection(data, i, correction[i]);
                }
            }
            return data;
        }),
        scan((acc, frame) => {
            if (acc.length != frame.length) {
                acc = frame.slice();
            } else {
                for (let i = 0; i < frame.length; i++) {
                    acc[i] = acc[i] * 0.4 + frame[i] * 0.6;
                }
            }
            return acc;
        }, new Uint8Array()),
        map(frame => {
            const clone = frame.slice(0);
            for (let i = 0; i < clone.length; i++) {
                clone[i] = GAMMA_LUT[clone[i]];
            }
            return clone;
        }),
        withLatestFrom(ws$),
        switchMap(([data, ws]) => new Promise((resolve, reject) => ws.send(data, err => {
            if (err) reject(err); else resolve();
        }))),
    ).subscribe();

const app = express();
app.use(bodyParser.json());
app.get('/frame', async (_req, res) => {
    const frame = await frames$.pipe(first()).toPromise();
    const buffer = await cv.imencodeAsync('.png', frame);
    res.type('png').end(buffer);
});
app.get('/samples', async (_req, res) => {
    const samples = await sampleData$.pipe(first()).toPromise();
    const array = Array.from(samples);
    res.json(array);
});
app.get('/settings', async (_req, res) => {
    const config = await config$.pipe(first()).toPromise();
    res.json(config);
});
app.patch('/settings', async (req, res) => {
    await updateConfig(cfg => ({ ...cfg, ...req.body }));
    res.status(204).send();
});
app.use(express.static('./src/client'));

const server = app.listen(3000);

process.on('SIGINT', () => {
    subscription.unsubscribe();
    server.close();
});
