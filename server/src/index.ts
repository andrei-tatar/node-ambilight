import cv, { Vec3 } from 'opencv4nodejs';
import express from 'express';
import bodyParser from 'body-parser';
import { isEqual } from 'lodash';
import WebSocket from 'ws';

import { Observable, OperatorFunction, combineLatest } from 'rxjs';
import { map, publishReplay, refCount, first, switchMap, distinctUntilChanged, sample, withLatestFrom, scan } from 'rxjs/operators';
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
    map(({ samplePoints, size }) => ({ samplePoints, size, buffer: new Uint8Array(samplePoints.length * 3) }))
);

const ws$ = new Observable<WebSocket>(observer => {
    const ws = new WebSocket('ws://192.168.1.54:81/');
    ws.on('open', () => observer.next(ws));
    ws.on('error', err => observer.error(err));
    ws.on('close', () => observer.complete());
    return () => ws.close();
});

const subscription = combineLatest([frames$, info])
    .pipe(
        map(([frame, { samplePoints, size: { width, height }, buffer }]) => {
            for (let i = 0; i < samplePoints.length; i++) {
                const point = samplePoints[i];
                const x = Math.round(point.x / 100 * width);
                const y = Math.round(point.y / 100 * height);
                const color: Vec3 = frame.at(y, x) as any;
                buffer[i * 3 + 0] = color.z;
                buffer[i * 3 + 1] = color.y;
                buffer[i * 3 + 2] = color.x;
            }
            return buffer;
        }),
        scan((last, buf) => {
            if (last == null || last.length != buf.length) {
                last = new Uint8Array(buf.length);
                for (let i = 0; i < buf.length; i++) {
                    last[i] = buf[i];
                }
            } else {
                for (let i = 0; i < buf.length; i++) {
                    last[i] = (last[i] + buf[i]) / 2;
                }
            }
            return last;
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
